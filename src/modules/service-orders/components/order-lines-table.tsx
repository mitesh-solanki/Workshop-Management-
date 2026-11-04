"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  createPartByNameAction,
  getPartEditValuesAction,
} from "@/app/actions/inventory";
import {
  deleteServiceOrderLineAction,
  updateServiceOrderLineAction,
  type ServiceOrderActionState,
} from "@/app/actions/service-orders";
import {
  SyncInvoicePrompt,
  useInvoiceSyncPrompt,
  type BillSyncMode,
} from "@/modules/billing/components/sync-invoice-prompt";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import {
  formatRupees,
  isZeroRupeesInput,
  multiplyByQuantity,
  paiseToRupeesInput,
  parseRupeesToPaise,
  sanitizeRupeesTyping,
  type Paise,
} from "@/lib/money";
import {
  CreatePartModal,
  type CreatedPartSummary,
} from "@/modules/inventory/components/create-part-modal";
import {
  EditPartModal,
  type EditPartValues,
} from "@/modules/inventory/components/edit-part-modal";
import {
  PartPickerSelect,
  type PartPickerItem,
} from "@/modules/inventory/components/part-picker-select";
import { QuantityStepper } from "@/modules/inventory/components/quantity-stepper";
import { cn } from "@/lib/utils";

type Line = {
  id: string;
  type: string;
  description: string;
  quantity: number;
  unitPricePaise: number;
  partId?: string | null;
  /** Catalogue selling price; Needs Pricing only when this is also 0. */
  catalogueSellingPricePaise?: number | null;
};

type Props = {
  orderId: string;
  canMutate: boolean;
  lines: Line[];
  hidePrices?: boolean;
  /** Outside work: no type badge column. */
  hideType?: boolean;
  /** Outside work: description + amount only. */
  hideQuantity?: boolean;
  /** Optional label for the unit-price column (e.g. Amount). */
  amountLabel?: string;
  /** Draft syncs quietly; finalized asks Yes/No. */
  billSyncMode?: BillSyncMode;
};

const initial: ServiceOrderActionState = { ok: false };

const MD_BREAKPOINT = 768;

const controlClass =
  "h-11 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] shadow-xs focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/25";

const actionBtnClass =
  "inline-flex size-11 min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-300 bg-white p-0 leading-none shadow-xs [&_svg]:size-5 [&_svg]:shrink-0";

/** Matches QuantityStepper (h-11) width so view/edit columns stay put. */
const qtyColClass = "w-[9.5rem] min-w-[9.5rem] max-w-[9.5rem]";
/** Type badge column — same width in view and edit. */
const typeColClass = "w-24 min-w-24 max-w-24";
/** Unit price input column — locked so edit mode does not reflow. */
const priceColClass = "w-36 min-w-36 max-w-36";
/** Subtotal text column. */
const subtotalColClass = "w-28 min-w-28 max-w-28";
/** Two size-11 action buttons + gap-3. */
const actionsColClass = "w-[7.25rem] min-w-[7.25rem] max-w-[7.25rem]";

function useIsMdDown() {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(`(max-width: ${MD_BREAKPOINT - 1}px)`);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.innerWidth < MD_BREAKPOINT,
    () => false,
  );
}

function parsePricePaise(raw: string, fallback: Paise): Paise {
  const parsed = parseRupeesToPaise(raw);
  return parsed === null ? fallback : parsed;
}

function TypeBadge({ type }: { type: string }) {
  const t = useTranslations("orders");
  const typeKey =
    type === "PART" || type === "LABOUR" || type === "OUTSIDE"
      ? type
      : "LABOUR";

  return (
    <span
      className={cn(
        "inline-flex w-max rounded-md border px-2 py-0.5 text-[11px] font-semibold",
        typeKey === "PART"
          ? "border-blue-200 bg-blue-50 text-blue-800"
          : typeKey === "OUTSIDE"
            ? "border-violet-200 bg-violet-50 text-violet-800"
            : "border-orange-200 bg-orange-50 text-orange-800",
      )}
    >
      {t(`lineTypes.${typeKey}`)}
    </span>
  );
}

function LineStat({
  value,
  label,
  emphasize = false,
}: {
  value: string;
  label: string;
  emphasize?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[13px] font-semibold text-slate-600">{label}</p>
      <p
        className={cn(
          "text-[15px] font-extrabold tabular-nums text-slate-900",
          emphasize && "text-slate-950",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function OrderLineItem({
  orderId,
  canMutate,
  hidePrices,
  hideType = false,
  hideQuantity = false,
  amountLabel,
  billSyncMode = "none",
  line,
  layout,
}: {
  orderId: string;
  canMutate: boolean;
  hidePrices: boolean;
  hideType?: boolean;
  hideQuantity?: boolean;
  amountLabel?: string;
  billSyncMode?: BillSyncMode;
  line: Line;
  layout: "card" | "table";
}) {
  const t = useTranslations("orders");
  const tc = useTranslations("common");
  const ti = useTranslations("inventory");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [removing, startRemove] = useTransition();
  const { syncOpen, setSyncOpen, offerSync } = useInvoiceSyncPrompt(
    orderId,
    billSyncMode,
  );
  const bound = useMemo(
    () => updateServiceOrderLineAction.bind(null, orderId, line.id),
    [orderId, line.id],
  );
  const [state, formAction, pending] = useActionState(bound, initial);
  const wasPending = useRef(false);
  const [saving, setSaving] = useState(false);
  const savePending = pending || saving;
  /** Keep last saved values until router.refresh brings matching props (no flicker). */
  const [optimistic, setOptimistic] = useState<{
    description: string;
    quantity: number;
    unitPricePaise: number;
    partId: string | null;
  } | null>(null);

  useEffect(() => {
    if (!optimistic) return;
    if (
      line.description === optimistic.description &&
      line.quantity === optimistic.quantity &&
      line.unitPricePaise === optimistic.unitPricePaise &&
      (line.partId ?? null) === optimistic.partId
    ) {
      setOptimistic(null);
    }
  }, [line, optimistic]);

  const displayDescription = optimistic?.description ?? line.description;
  const displayQuantity = optimistic?.quantity ?? line.quantity;
  const displayUnitPricePaise =
    optimistic?.unitPricePaise ?? line.unitPricePaise;
  const savedTotal = multiplyByQuantity(
    displayUnitPricePaise as Paise,
    displayQuantity,
  );

  const [draftQty, setDraftQty] = useState(line.quantity);
  const [draftPricePaise, setDraftPricePaise] = useState(
    line.unitPricePaise as Paise,
  );
  /** Remount price input when price is set programmatically (prefill / part pick). */
  const [priceInputKey, setPriceInputKey] = useState(0);
  const [editPartId, setEditPartId] = useState(line.partId ?? "");
  const [editDescription, setEditDescription] = useState(line.description);
  const [createOpen, setCreateOpen] = useState(false);
  const [createInitialName, setCreateInitialName] = useState("");
  const [creatingPart, setCreatingPart] = useState(false);
  const [applyingPrice, startApplyPrice] = useTransition();
  const [inventoryPart, setInventoryPart] = useState<EditPartValues | null>(
    null,
  );
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [openingInventory, startOpenInventory] = useTransition();
  /** Stock of the part currently chosen in edit; null = still the saved line. */
  const [editPartStock, setEditPartStock] = useState<number | null>(null);
  const [editCataloguePaise, setEditCataloguePaise] = useState(
    line.catalogueSellingPricePaise ?? 0,
  );
  const liveTotal = multiplyByQuantity(draftPricePaise, draftQty);
  const isPart = line.type === "PART";
  const hasQuantity = line.type === "PART" && !hideQuantity;
  const priceLabel = amountLabel ?? t("unitPrice");
  const cataloguePrice = line.catalogueSellingPricePaise ?? 0;
  const activeCataloguePaise =
    editing && editPartStock != null ? editCataloguePaise : cataloguePrice;
  const needsPricing =
    !hidePrices &&
    isPart &&
    displayUnitPricePaise === 0 &&
    Boolean(line.partId || optimistic?.partId) &&
    cataloguePrice <= 0;
  /** Prefill only when stock is available — 0-stock uses the inventory modal instead. */
  const canPrefillFromInventory =
    !hidePrices &&
    isPart &&
    Boolean(editing ? editPartId : line.partId) &&
    activeCataloguePaise > 0 &&
    (editPartStock == null || editPartStock > 0) &&
    (editing ? draftPricePaise === 0 : line.unitPricePaise === 0);
  const formId = `line-edit-${line.id}`;

  function beginEdit() {
    setDraftQty(line.quantity);
    setDraftPricePaise(line.unitPricePaise as Paise);
    setPriceInputKey((key) => key + 1);
    setEditPartId(line.partId ?? "");
    setEditDescription(line.description);
    setEditPartStock(null);
    setEditCataloguePaise(line.catalogueSellingPricePaise ?? 0);
    setEditing(true);
  }

  function openInventoryForPart(partId: string) {
    startOpenInventory(async () => {
      const values = await getPartEditValuesAction(partId);
      if (!values) {
        toast.error(tc("notFound"));
        return;
      }
      setInventoryPart(values);
      setInventoryOpen(true);
    });
  }

  function handleEditPartChange(nextId: string, part: PartPickerItem | null) {
    setEditPartId(nextId);
    if (!part) {
      setEditPartStock(null);
      return;
    }
    setEditDescription(part.name);
    setEditPartStock(part.quantityOnHand);
    setEditCataloguePaise(part.sellingPricePaise);
    if (!hidePrices) {
      if (part.quantityOnHand <= 0) {
        setDraftPricePaise(0 as Paise);
        setPriceInputKey((key) => key + 1);
        openInventoryForPart(part.id);
        return;
      }
      setDraftPricePaise(part.sellingPricePaise as Paise);
      setPriceInputKey((key) => key + 1);
    }
  }

  function openCreatePartModal(name: string) {
    setCreateInitialName(name.trim());
    setCreateOpen(true);
  }

  function handlePartCreated(part: CreatedPartSummary) {
    setEditPartId(part.id);
    setEditDescription(part.name);
    setEditPartStock(0);
    setEditCataloguePaise(0);
    if (!hidePrices) {
      setDraftPricePaise(0 as Paise);
      setPriceInputKey((key) => key + 1);
    }
    setCreateOpen(false);
    setCreateInitialName("");
  }

  async function handleCreateFromQuery(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!hidePrices) {
      openCreatePartModal(trimmed);
      return;
    }
    if (creatingPart) return;
    setCreatingPart(true);
    try {
      const result = await createPartByNameAction(trimmed);
      if (result.ok && result.part) {
        toast.success(result.message ?? ti("createdByName"));
        handlePartCreated({
          id: result.part.id,
          name: result.part.name,
          sku: result.part.sku,
          unit: result.part.unit,
        });
        return;
      }
      toast.error(result.message ?? tc("error"));
    } catch {
      toast.error(tc("error"));
    } finally {
      setCreatingPart(false);
    }
  }

  async function applySellingPriceFromPart(part: {
    name: string;
    sellingPricePaise: number;
  }) {
    if (!line.partId) return;
    if (part.sellingPricePaise <= 0) {
      toast.error(t("inventoryPriceMissing"));
      return;
    }
    if (editing) {
      setEditDescription(part.name);
      setDraftPricePaise(part.sellingPricePaise as Paise);
      setPriceInputKey((key) => key + 1);
      toast.success(t("inventoryPricePrefill"));
      return;
    }
    const formData = new FormData();
    formData.set("description", part.name || line.description);
    formData.set("quantity", String(line.quantity));
    formData.set(
      "unitPriceRupees",
      paiseToRupeesInput(part.sellingPricePaise),
    );
    formData.set("partId", line.partId);
    const result = await updateServiceOrderLineAction(
      orderId,
      line.id,
      { ok: false },
      formData,
    );
    if (result.ok) {
      toast.success(result.message ?? t("inventoryPriceApplied"));
      offerSync();
      router.refresh();
      return;
    }
    toast.error(result.message ?? t("errors.deleteFailed"));
  }

  function applyInventoryPrice() {
    if (!line.partId) return;
    startApplyPrice(async () => {
      const part = await getPartEditValuesAction(line.partId!);
      if (!part) {
        toast.error(tc("notFound"));
        return;
      }
      await applySellingPriceFromPart(part);
    });
  }

  function openInventoryEditor() {
    const partId = editing ? editPartId || line.partId : line.partId;
    if (!partId) return;
    openInventoryForPart(partId);
  }

  async function handleInventorySaved() {
    const partId = editing ? editPartId || line.partId : line.partId;
    if (!partId) return;
    const part = await getPartEditValuesAction(partId);
    if (!part) {
      toast.error(tc("notFound"));
      return;
    }
    setInventoryPart(part);
    if (editing) {
      setEditDescription(part.name);
      setEditPartStock(part.quantityOnHand);
      setEditCataloguePaise(part.sellingPricePaise);
      if (part.sellingPricePaise > 0) {
        setDraftPricePaise(part.sellingPricePaise as Paise);
        setPriceInputKey((key) => key + 1);
        toast.success(t("inventoryPricePrefill"));
      }
      return;
    }
    await applySellingPriceFromPart(part);
  }

  const needsPricingHint = needsPricing ? (
    <p
      id={`line-price-hint-${line.id}`}
      className="text-[12px] leading-snug text-amber-900"
    >
      {t("setPriceHereOrInventory")}{" "}
      <button
        type="button"
        disabled={openingInventory}
        onClick={openInventoryEditor}
        className="font-semibold text-blue-700 underline-offset-2 hover:underline disabled:opacity-60"
      >
        {openingInventory ? t("saving") : t("openInventory")}
      </button>
    </p>
  ) : null;

  const inventoryEditModal =
    !hidePrices && inventoryPart ? (
      <EditPartModal
        part={inventoryPart}
        trigger={null}
        open={inventoryOpen}
        onOpenChange={setInventoryOpen}
        onSaved={handleInventorySaved}
        resetPrices
      />
    ) : null;

  useEffect(() => {
    const finished = wasPending.current && !pending;
    wasPending.current = pending;
    if (!finished) return;
    if (state.ok) {
      if (state.message) toast.success(state.message);
      setOptimistic({
        description: editDescription.trim() || line.description,
        quantity: hasQuantity ? draftQty : 1,
        unitPricePaise: hidePrices ? line.unitPricePaise : draftPricePaise,
        partId: isPart ? editPartId || null : null,
      });
      setEditing(false);
      offerSync();
      router.refresh();
      return;
    }
    if (state.message) toast.error(state.message);
  }, [
    pending,
    state,
    editDescription,
    draftQty,
    draftPricePaise,
    editPartId,
    hidePrices,
    hasQuantity,
    isPart,
    line.description,
    line.unitPricePaise,
    offerSync,
    router,
  ]);

  async function saveEdit() {
    if (isPart && !editPartId) return;
    if (saving) return;
    setSaving(true);
    const nextDescription = editDescription.trim() || line.description;
    const nextQuantity = hasQuantity ? draftQty : 1;
    const nextPricePaise = hidePrices ? line.unitPricePaise : draftPricePaise;
    try {
      const formData = new FormData();
      formData.set("description", nextDescription);
      formData.set("quantity", String(nextQuantity));
      formData.set("unitPriceRupees", paiseToRupeesInput(nextPricePaise));
      formData.set("partId", isPart ? editPartId : "");
      const result = await updateServiceOrderLineAction(
        orderId,
        line.id,
        { ok: false },
        formData,
      );
      if (result.ok) {
        toast.success(result.message ?? t("lineUpdated"));
        setOptimistic({
          description: nextDescription,
          quantity: nextQuantity,
          unitPricePaise: nextPricePaise,
          partId: isPart ? editPartId || null : null,
        });
        setEditing(false);
        offerSync();
        router.refresh();
        return;
      }
      toast.error(result.message ?? t("errors.deleteFailed"));
    } catch {
      toast.error(t("errors.deleteFailed"));
    } finally {
      setSaving(false);
    }
  }

  function onConfirmDelete() {
    startRemove(async () => {
      const result = await deleteServiceOrderLineAction(orderId, line.id);
      if (result.ok) {
        setDeleteOpen(false);
        toast.success(result.message ?? t("lineRemoved"));
        offerSync();
        return;
      }
      toast.error(result.message ?? t("errors.deleteFailed"));
    });
  }

  const actions = canMutate ? (
    <div className="flex shrink-0 items-center justify-end gap-3">
      {editing ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="icon"
            loading={savePending}
            disabled={isPart && !editPartId}
            className={cn(
              actionBtnClass,
              "text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800",
            )}
            aria-label={t("saveLine")}
            title={t("saveLine")}
            onClick={saveEdit}
          >
            <Check className="size-5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={savePending || removing}
            className={cn(actionBtnClass, "text-slate-700 hover:bg-slate-50")}
            aria-label={t("cancelEdit")}
            title={t("cancelEdit")}
            onClick={() => setEditing(false)}
          >
            <X className="size-5" />
          </Button>
        </>
      ) : (
        <>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn(
              actionBtnClass,
              "text-blue-700 hover:border-blue-300 hover:bg-blue-50",
            )}
            aria-label={t("editLine")}
            title={t("editLine")}
            onClick={beginEdit}
          >
            <Pencil className="size-5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn(
              actionBtnClass,
              "text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700",
            )}
            aria-label={t("removeLine")}
            title={t("removeLine")}
            disabled={removing || savePending}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-5" />
          </Button>
        </>
      )}
    </div>
  ) : null;

  const deleteDialog = (
    <Dialog
      open={deleteOpen}
      onOpenChange={(next) => {
        if (removing) return;
        setDeleteOpen(next);
      }}
    >
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle>{t("deleteLineTitle")}</DialogTitle>
          <DialogDescription>{t("deleteLineConfirm")}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 px-5 py-4 sm:justify-end">
          <DialogClose asChild>
            <Button
              type="button"
              variant="secondary"
              size="md"
              disabled={removing}
            >
              {tc("cancel")}
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="danger"
            size="md"
            loading={removing}
            onClick={onConfirmDelete}
          >
            {t("removeLine")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const createPartModal = !hidePrices ? (
    <CreatePartModal
      trigger={null}
      open={createOpen}
      onOpenChange={(next) => {
        setCreateOpen(next);
        if (!next) setCreateInitialName("");
      }}
      navigateOnSuccess={false}
      shopReceive
      initialName={createInitialName}
      onCreated={handlePartCreated}
    />
  ) : null;

  const editFormFields = (
    <form
      id={formId}
      key={`edit-${line.id}-${line.quantity}-${line.unitPricePaise}`}
      action={formAction}
      className="space-y-3"
    >
      <div
        className={
          hidePrices
            ? "grid grid-cols-1 items-end gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] lg:items-center"
            : "grid grid-cols-1 items-end gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_auto] lg:items-center"
        }
      >
        <div className="flex min-h-7 flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-1">
          <p className="text-[13px] font-semibold text-slate-600">
            {isPart ? ti("part") : t("lineDescription")}
          </p>
          {!hidePrices && !hideType ? <TypeBadge type={line.type} /> : null}
        </div>
        {hasQuantity ? (
          <p className="hidden min-h-7 items-center text-[13px] font-semibold text-slate-600 lg:flex">
            {t("quantity")}
          </p>
        ) : hideQuantity ? null : (
          <div className="hidden min-h-7 lg:block" aria-hidden />
        )}
        {!hidePrices ? (
          <>
            <p className="hidden min-h-7 items-center text-[13px] font-semibold text-slate-600 lg:flex">
              {priceLabel}
            </p>
            {hideQuantity ? null : (
              <p className="hidden min-h-7 items-center text-[13px] font-semibold text-slate-600 lg:flex">
                {t("lineSubtotal")}
              </p>
            )}
          </>
        ) : null}
        <div className="hidden min-h-7 lg:block" aria-hidden />

        <div className="min-w-0 sm:col-span-2 lg:col-span-1">
          {isPart ? (
            <>
              <PartPickerSelect
                id={`line-part-${line.id}`}
                name="partId"
                value={editPartId}
                onChange={handleEditPartChange}
                onCreateFromQuery={handleCreateFromQuery}
                clearable={false}
                initialLabel={line.description}
                disabled={creatingPart || savePending}
                nameOnlyLabels={hidePrices}
              />
              <input
                type="hidden"
                name="description"
                value={editDescription}
              />
            </>
          ) : line.type === "OUTSIDE" ? (
            <>
              <Input
                id={`line-desc-${line.id}`}
                name="description"
                required
                maxLength={500}
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                className={controlClass}
                placeholder={t("outsideWorkDescriptionPlaceholder")}
              />
              <input type="hidden" name="partId" value="" />
            </>
          ) : (
            <>
              <Input
                id={`line-desc-${line.id}`}
                name="description"
                required
                maxLength={500}
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                className={controlClass}
                aria-label={t("lineDescription")}
              />
              <input type="hidden" name="partId" value="" />
            </>
          )}
        </div>

        {hasQuantity ? (
          <div className="min-w-0">
            <p className="mb-1.5 text-[13px] font-semibold text-slate-600 lg:hidden">
              {t("quantity")}
            </p>
            <QuantityStepper
              id={`line-qty-${line.id}`}
              name="quantity"
              label={t("quantity")}
              defaultValue={line.quantity}
              min={1}
              hideLabel
              onValueChange={setDraftQty}
            />
          </div>
        ) : (
          <input type="hidden" name="quantity" value="1" />
        )}

        {hidePrices ? (
          <input
            type="hidden"
            name="unitPriceRupees"
            value={paiseToRupeesInput(line.unitPricePaise)}
          />
        ) : (
          <>
            <div className="min-w-0">
              <label
                htmlFor={`line-price-${line.id}`}
                className="mb-1.5 block text-[13px] font-semibold text-slate-600 lg:hidden"
              >
                {priceLabel}
              </label>
              <Input
                key={`line-price-${line.id}-${editPartId}-${priceInputKey}`}
                id={`line-price-${line.id}`}
                name="unitPriceRupees"
                type="text"
                inputMode="decimal"
                required
                defaultValue={paiseToRupeesInput(draftPricePaise)}
                className={cn(
                  controlClass,
                  "tabular-nums",
                  needsPricing &&
                    "border-amber-400 focus-visible:border-amber-500 focus-visible:ring-amber-500/25",
                )}
                aria-label={priceLabel}
                onFocus={(event) => {
                  if (isZeroRupeesInput(event.currentTarget.value)) {
                    event.currentTarget.select();
                  }
                }}
                onBeforeInput={(event) => {
                  const data = (event.nativeEvent as InputEvent).data;
                  if (data == null || data === "") return;
                  if (!/^[\d.]+$/.test(data)) event.preventDefault();
                }}
                onInput={(event) => {
                  const el = event.currentTarget;
                  const next = sanitizeRupeesTyping(el.value);
                  if (el.value !== next) el.value = next;
                  setDraftPricePaise(parsePricePaise(next, draftPricePaise));
                }}
              />
            </div>

            {hideQuantity ? null : (
              <div className="min-w-0">
                <p className="mb-1.5 text-[13px] font-semibold text-slate-600 lg:hidden">
                  {t("lineSubtotal")}
                </p>
                <p className="flex h-11 min-h-11 items-center text-[15px] font-extrabold tabular-nums text-slate-950">
                  {formatRupees(liveTotal)}
                </p>
              </div>
            )}
          </>
        )}

        <div className="flex h-11 min-h-11 items-center justify-start lg:justify-end">
          {actions}
        </div>
      </div>

      {!hidePrices ? (
        <div className="flex min-h-8 items-center">
          {needsPricing ? (
            <div className="rounded-md bg-amber-50 px-2.5 py-1.5">
              {needsPricingHint}
            </div>
          ) : canPrefillFromInventory ? (
            <button
              type="button"
              disabled={applyingPrice}
              onClick={applyInventoryPrice}
              className="text-left text-[12px] font-medium text-blue-700 underline-offset-2 hover:underline disabled:opacity-60"
            >
              {applyingPrice ? t("saving") : t("prefillFromInventory")}
            </button>
          ) : isPart ? (
            <p className="text-[12px] text-slate-500">{t("editPartQtyHint")}</p>
          ) : null}
        </div>
      ) : null}
    </form>
  );

  if (layout === "table") {
    const inlineEditing = editing && canMutate;
    const cellPad = "align-middle py-2.5";
    const showTypeCol = !hidePrices && !hideType;
    const showQtyCol = !hideQuantity;
    const showSubtotalCol = !hidePrices && !hideQuantity;
    const hintColSpan =
      1 +
      (showTypeCol ? 1 : 0) +
      (showQtyCol ? 1 : 0) +
      (hidePrices ? 0 : 1) +
      (showSubtotalCol ? 1 : 0) +
      (canMutate ? 1 : 0);
    /** Only when a pricing hint or inventory prefill link is actually shown. */
    const showEditFooter =
      inlineEditing &&
      !hidePrices &&
      (needsPricing || canPrefillFromInventory);

    return (
      <>
        {deleteDialog}
        {createPartModal}
        {inventoryEditModal}
        <TableRow
          className={cn(
            needsPricing
              ? "bg-amber-50/60 hover:bg-amber-50/80"
              : inlineEditing
                ? "bg-blue-50/40 hover:bg-blue-50/40"
                : undefined,
            showEditFooter && "border-b-0",
          )}
        >
          {showTypeCol ? (
            <TableCell
              className={cn(typeColClass, cellPad, "whitespace-nowrap")}
            >
              <TypeBadge type={line.type} />
            </TableCell>
          ) : null}
          <TableCell className={cn("min-w-0 max-w-0 whitespace-normal", cellPad)}>
            {inlineEditing ? (
              isPart ? (
                <PartPickerSelect
                  id={`line-part-${line.id}`}
                  value={editPartId}
                  onChange={handleEditPartChange}
                  onCreateFromQuery={handleCreateFromQuery}
                  clearable={false}
                  initialLabel={line.description}
                  disabled={creatingPart || savePending}
                  nameOnlyLabels={hidePrices}
                />
              ) : line.type === "OUTSIDE" ? (
                <Input
                  id={`line-desc-${line.id}`}
                  required
                  maxLength={500}
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                  className={controlClass}
                  placeholder={t("outsideWorkDescriptionPlaceholder")}
                />
              ) : (
                <Input
                  id={`line-desc-${line.id}`}
                  required
                  maxLength={500}
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                  className={controlClass}
                  aria-label={t("lineDescription")}
                />
              )
            ) : (
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="truncate font-medium text-slate-900">
                  {displayDescription}
                </span>
                {needsPricing ? (
                  <Badge variant="warning">{t("needsPricing")}</Badge>
                ) : null}
              </div>
            )}
          </TableCell>
          {showQtyCol ? (
            <TableCell
              className={cn(
                qtyColClass,
                cellPad,
                "text-center tabular-nums text-slate-800",
              )}
            >
              {inlineEditing && hasQuantity ? (
                <div className="flex h-11 min-h-11 items-center justify-center">
                  <QuantityStepper
                    id={`line-qty-${line.id}`}
                    name={`qty-display-${line.id}`}
                    label={t("quantity")}
                    defaultValue={displayQuantity}
                    min={1}
                    hideLabel
                    onValueChange={setDraftQty}
                  />
                </div>
              ) : (
                <span className="inline-flex h-11 min-h-11 w-full items-center justify-center tabular-nums">
                  {hasQuantity ? displayQuantity : "—"}
                </span>
              )}
            </TableCell>
          ) : null}
          {!hidePrices ? (
            <>
              <TableCell
                className={cn(
                  priceColClass,
                  cellPad,
                  "tabular-nums text-slate-800",
                )}
              >
                {inlineEditing ? (
                  <Input
                    key={`line-price-${line.id}-${editPartId}-${priceInputKey}`}
                    id={`line-price-${line.id}`}
                    type="text"
                    inputMode="decimal"
                    required
                    defaultValue={paiseToRupeesInput(draftPricePaise)}
                    className={cn(
                      controlClass,
                      "tabular-nums",
                      needsPricing &&
                        "border-amber-400 focus-visible:border-amber-500 focus-visible:ring-amber-500/25",
                    )}
                    aria-label={priceLabel}
                    aria-describedby={
                      needsPricing ? `line-price-hint-${line.id}` : undefined
                    }
                    title={
                      needsPricing
                        ? `${t("setPriceHereOrInventory")} ${t("openInventory")}`
                        : undefined
                    }
                    onFocus={(event) => {
                      if (isZeroRupeesInput(event.currentTarget.value)) {
                        event.currentTarget.select();
                      }
                    }}
                    onBeforeInput={(event) => {
                      const data = (event.nativeEvent as InputEvent).data;
                      if (data == null || data === "") return;
                      if (!/^[\d.]+$/.test(data)) event.preventDefault();
                    }}
                    onInput={(event) => {
                      const el = event.currentTarget;
                      const next = sanitizeRupeesTyping(el.value);
                      if (el.value !== next) el.value = next;
                      setDraftPricePaise(
                        parsePricePaise(next, draftPricePaise),
                      );
                    }}
                  />
                ) : (
                  <span className="inline-flex h-11 min-h-11 items-center tabular-nums">
                    {formatRupees(displayUnitPricePaise)}
                  </span>
                )}
              </TableCell>
              {showSubtotalCol ? (
                <TableCell
                  className={cn(
                    subtotalColClass,
                    cellPad,
                    "font-semibold tabular-nums text-slate-950",
                  )}
                >
                  <span className="inline-flex h-11 min-h-11 items-center tabular-nums">
                    {inlineEditing
                      ? formatRupees(liveTotal)
                      : formatRupees(savedTotal)}
                  </span>
                </TableCell>
              ) : null}
            </>
          ) : null}
          {canMutate ? (
            <TableCell className={cn(actionsColClass, cellPad, "text-right")}>
              <div className="flex h-11 min-h-11 items-center justify-end">
                {actions}
              </div>
            </TableCell>
          ) : null}
        </TableRow>
        {showEditFooter ? (
          <TableRow
            className={cn(
              "hover:bg-transparent",
              needsPricing
                ? "bg-amber-50/60 hover:bg-amber-50/60"
                : "bg-blue-50/40 hover:bg-blue-50/40",
            )}
          >
            <TableCell
              colSpan={hintColSpan}
              className="border-t-0 py-0"
            >
              <div className="flex items-center pb-2.5">
                {needsPricing ? (
                  needsPricingHint
                ) : (
                  <button
                    type="button"
                    disabled={applyingPrice}
                    onClick={applyInventoryPrice}
                    className="text-left text-[12px] font-medium text-blue-700 underline-offset-2 hover:underline disabled:opacity-60"
                  >
                    {applyingPrice ? t("saving") : t("prefillFromInventory")}
                  </button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ) : null}
      </>
    );
  }

  if (editing && canMutate) {
    return (
      <>
        {deleteDialog}
        {inventoryEditModal}
        <div className="rounded-[10px] border border-blue-200 bg-blue-50/40 p-3.5 sm:p-4">
          {editFormFields}
          {createPartModal}
        </div>
      </>
    );
  }

  return (
    <>
      {deleteDialog}
      {inventoryEditModal}
      <div
        className={cn(
          "rounded-[10px] border p-3.5 sm:p-4",
          needsPricing
            ? "border-amber-300 bg-amber-50/50"
            : "border-[#e8edf5] bg-[#fafcff]",
        )}
      >
        <div
          className={
            hidePrices
              ? "grid grid-cols-1 items-center gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] lg:gap-5"
              : "grid grid-cols-1 items-center gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_auto] lg:gap-5"
          }
        >
          <div className="min-w-0 sm:col-span-2 lg:col-span-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <p className="text-[13px] font-semibold text-slate-600">
                {t("lineDescription")}
              </p>
              {!hidePrices && !hideType ? (
                <TypeBadge type={line.type} />
              ) : null}
              {needsPricing ? (
                <Badge variant="warning">{t("needsPricing")}</Badge>
              ) : null}
            </div>
            <h4 className="text-[15px] font-semibold leading-snug text-slate-900">
              {displayDescription}
            </h4>
          </div>

          {hasQuantity ? (
            <LineStat value={String(displayQuantity)} label={t("quantity")} />
          ) : hideQuantity ? null : (
            <div className="hidden sm:block" aria-hidden />
          )}
          {!hidePrices ? (
            <>
              <LineStat
                value={formatRupees(displayUnitPricePaise)}
                label={priceLabel}
              />
              {hideQuantity ? null : (
                <LineStat
                  value={formatRupees(savedTotal)}
                  label={t("lineSubtotal")}
                  emphasize
                />
              )}
            </>
          ) : null}

          {actions ? (
            <div className="flex items-center justify-start self-center border-t border-slate-200 pt-3 sm:col-span-2 lg:col-span-1 lg:justify-end lg:border-0 lg:pt-0">
              {actions}
            </div>
          ) : null}
        </div>
        {needsPricing ? (
          <div className="mt-2 text-[13px] text-amber-800">
            {needsPricingHint}
          </div>
        ) : null}
      </div>
      <SyncInvoicePrompt
        orderId={orderId}
        open={syncOpen}
        onOpenChange={setSyncOpen}
      />
    </>
  );
}

export function OrderLinesTable({
  orderId,
  canMutate,
  lines,
  hidePrices = false,
  hideType = false,
  hideQuantity = false,
  amountLabel,
  billSyncMode = "none",
}: Props) {
  const t = useTranslations("orders");
  const isMobile = useIsMdDown();
  // Mechanics work parts only — labour stays on the owner/manager card.
  const visibleLines = hidePrices
    ? lines.filter((line) => line.type === "PART")
    : lines;
  const priceHeader = amountLabel ?? t("unitPrice");

  if (isMobile) {
    return (
      <div className="grid gap-2.5">
        {visibleLines.map((line) => (
          <OrderLineItem
            key={line.id}
            orderId={orderId}
            canMutate={canMutate}
            hidePrices={hidePrices}
            hideType={hideType}
            hideQuantity={hideQuantity}
            amountLabel={amountLabel}
            billSyncMode={billSyncMode}
            line={line}
            layout="card"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <Table className="table-fixed">
        <TableHeader className="bg-slate-100 [&_tr]:border-border">
          <TableRow className="hover:bg-transparent">
            {!hidePrices && !hideType ? (
              <TableHead
                className={cn(typeColClass, "text-slate-700")}
              >
                {t("lineType")}
              </TableHead>
            ) : null}
            <TableHead className="min-w-0 text-slate-700">
              {t("lineDescription")}
            </TableHead>
            {!hideQuantity ? (
              <TableHead
                className={cn(
                  qtyColClass,
                  "whitespace-nowrap text-center text-slate-700",
                )}
              >
                {t("quantity")}
              </TableHead>
            ) : null}
            {!hidePrices ? (
              <>
                <TableHead
                  className={cn(priceColClass, "text-slate-700")}
                >
                  {priceHeader}
                </TableHead>
                {!hideQuantity ? (
                  <TableHead
                    className={cn(subtotalColClass, "text-slate-700")}
                  >
                    {t("lineSubtotal")}
                  </TableHead>
                ) : null}
              </>
            ) : null}
            {canMutate ? (
              <TableHead
                className={cn(actionsColClass, "text-right text-slate-700")}
              >
                {t("columns.actions")}
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleLines.map((line) => (
            <OrderLineItem
              key={line.id}
              orderId={orderId}
              canMutate={canMutate}
              hidePrices={hidePrices}
              hideType={hideType}
              hideQuantity={hideQuantity}
              amountLabel={amountLabel}
              billSyncMode={billSyncMode}
              line={line}
              layout="table"
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
