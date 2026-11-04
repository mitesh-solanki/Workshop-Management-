"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  updateInvoiceLinesAction,
  type BillingActionState,
} from "@/app/actions/billing";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { FormSelect } from "@/components/ui/form-select";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { getPartPickerItemAction } from "@/app/actions/inventory";
import {
  CreatePartModal,
  type CreatedPartSummary,
} from "@/modules/inventory/components/create-part-modal";
import { QuantityStepper } from "@/modules/inventory/components/quantity-stepper";
import {
  PartPickerSelect,
  type PartPickerItem,
} from "@/modules/inventory/components/part-picker-select";
import type { InvoiceLineTypeValue } from "@/modules/billing/schema";
import { partRequiresWarrantyCard } from "@/modules/warranties/part-requires-warranty";
import { InvoiceLineWarrantyModal } from "@/modules/warranties/components/invoice-line-warranty-modal";
import type { InvoiceWarrantyDoc } from "@/modules/warranties/components/invoice-warranty-panel";
import { pendingBalancePaise } from "@/modules/billing/balance";
import { sumLineGstSplit } from "@/lib/gst";
import {
  isZeroRupeesInput,
  paiseToRupeesInput,
  sanitizeRupeesTyping,
  type Paise,
} from "@/lib/money";
import { cn } from "@/lib/utils";

type EditLine = {
  key: string;
  id?: string;
  type: InvoiceLineTypeValue;
  description: string;
  quantity: number;
  unitPricePaise: number;
  gstRatePercent: number;
  partId: string;
  priceKey: number;
};

export type InvoiceDraftTotals = {
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
  pendingBalancePaise: number;
};

type Props = {
  orderId: string;
  invoiceId: string;
  vehicleId: string;
  notes: string | null;
  gstSplit: "CGST_SGST" | "IGST";
  amountPaidPaise: number;
  creditNotesTotalPaise: number;
  lines: Array<{
    id: string;
    type: InvoiceLineTypeValue;
    description: string;
    quantity: number;
    unitPricePaise: number;
    gstRatePercent: number;
  }>;
  warrantyDocs: InvoiceWarrantyDoc[];
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onDraftTotalsChange?: (totals: InvoiceDraftTotals | null) => void;
};

const initial: BillingActionState = { ok: false };

const controlClass =
  "h-11 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] shadow-xs focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/25";

function nextKey() {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function linesFromProps(lines: Props["lines"]): EditLine[] {
  return lines.map((line) => ({
    key: line.id,
    id: line.id,
    type: line.type,
    description: line.description,
    quantity: line.quantity,
    unitPricePaise: line.unitPricePaise,
    gstRatePercent: line.gstRatePercent,
    partId: "",
    priceKey: 0,
  }));
}

function parseRupeesField(value: string): number {
  const cleaned = value.trim().replace(/,/g, "");
  if (cleaned === "") return 0;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function formatExpiryDate(
  value: Date | string | null,
  locale: string,
): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function docSignature(doc: InvoiceWarrantyDoc | null | undefined) {
  if (!doc) return "";
  const expiry =
    doc.warrantyExpiresAt instanceof Date
      ? doc.warrantyExpiresAt.toISOString()
      : (doc.warrantyExpiresAt ?? "");
  return `${doc.id}:${expiry}:${doc.storageKey ?? ""}`;
}

export function EditInvoiceTrigger({
  editing,
  onEditingChange,
  disabled,
  iconOnly = false,
}: {
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  disabled?: boolean;
  iconOnly?: boolean;
}) {
  const t = useTranslations("billing");
  return (
    <Button
      type="button"
      variant="outline"
      size={iconOnly ? "icon-sm" : "md"}
      className={iconOnly ? undefined : "min-h-11"}
      disabled={disabled}
      aria-label={editing ? t("cancelEditInvoice") : t("editInvoice")}
      onClick={() => onEditingChange(!editing)}
    >
      {iconOnly ? (
        editing ? (
          <X className="size-4" aria-hidden />
        ) : (
          <Pencil className="size-4" aria-hidden />
        )
      ) : editing ? (
        t("cancelEditInvoice")
      ) : (
        t("editInvoice")
      )}
    </Button>
  );
}

export function EditInvoicePanel({
  orderId,
  invoiceId,
  vehicleId,
  notes,
  gstSplit,
  amountPaidPaise,
  creditNotesTotalPaise,
  lines: initialLines,
  warrantyDocs,
  editing,
  onEditingChange,
  onDraftTotalsChange,
}: Props) {
  const t = useTranslations("billing");
  const to = useTranslations("orders");
  const tw = useTranslations("warranties");
  const ti = useTranslations("inventory");
  const locale = useLocale();
  const router = useRouter();
  const formId = `edit-invoice-form-${invoiceId}`;
  const bound = useMemo(
    () => updateInvoiceLinesAction.bind(null, orderId, invoiceId),
    [orderId, invoiceId],
  );
  const [state, formAction, pending] = useActionState(bound, initial);
  const handled = useRef<string | null>(null);
  const [rows, setRows] = useState<EditLine[]>(() =>
    linesFromProps(initialLines),
  );
  const [addType, setAddType] = useState<InvoiceLineTypeValue>("PART");
  const [addDescription, setAddDescription] = useState("");
  const [addPartId, setAddPartId] = useState("");
  const [addQty, setAddQty] = useState(1);
  const [addPriceText, setAddPriceText] = useState("");
  const [addPriceKey, setAddPriceKey] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [createInitialName, setCreateInitialName] = useState("");
  const [createForKey, setCreateForKey] = useState<string | null>(null);
  const [modalLineId, setModalLineId] = useState<string | null>(null);
  const [savingLineId, setSavingLineId] = useState<string | null>(null);
  const [savingBaseline, setSavingBaseline] = useState("");
  const pendingWarrantyRef = useRef<{
    description: string;
    quantity: number;
    unitPricePaise: number;
  } | null>(null);

  const addRowKey = "__add__";

  const docsByLine = useMemo(() => {
    const map = new Map<string, InvoiceWarrantyDoc>();
    for (const doc of warrantyDocs) {
      if (doc.invoiceLineId) map.set(doc.invoiceLineId, doc);
    }
    return map;
  }, [warrantyDocs]);

  useEffect(() => {
    if (!editing) {
      onDraftTotalsChange?.(null);
      return;
    }
    setRows(linesFromProps(initialLines));
    setAddType("PART");
    setAddDescription("");
    setAddPartId("");
    setAddQty(1);
    setAddPriceText("");
    setAddPriceKey((key) => key + 1);
    setModalLineId(null);
    handled.current = null;
  }, [editing, initialLines, onDraftTotalsChange]);

  useEffect(() => {
    if (!editing) return;
    const sameState = gstSplit === "CGST_SGST";
    const gst = sumLineGstSplit(
      rows.map((row) => ({
        quantity: row.type === "PART" ? row.quantity : 1,
        unitPricePaise: row.unitPricePaise as Paise,
        gstRatePercent: row.gstRatePercent,
      })),
      sameState,
    );
    onDraftTotalsChange?.({
      taxablePaise: gst.taxablePaise,
      cgstPaise: gst.cgstPaise,
      sgstPaise: gst.sgstPaise,
      igstPaise: gst.igstPaise,
      totalPaise: gst.totalPaise,
      pendingBalancePaise: pendingBalancePaise({
        totalPaise: gst.totalPaise,
        amountPaidPaise: amountPaidPaise as Paise,
        creditNotesTotalPaise: creditNotesTotalPaise as Paise,
      }),
    });
  }, [
    editing,
    rows,
    gstSplit,
    amountPaidPaise,
    creditNotesTotalPaise,
    onDraftTotalsChange,
  ]);

  useEffect(() => {
    if (!state.message || state.message === handled.current) return;
    handled.current = state.message;
    if (state.ok) {
      toast.success(
        state.message === "invoiceUpdated"
          ? t("invoiceUpdated")
          : state.message,
      );
      const pending = pendingWarrantyRef.current;
      pendingWarrantyRef.current = null;
      if (pending && state.savedLines && state.savedLines.length > 0) {
        const partMatches = state.savedLines.filter(
          (line) =>
            line.type === "PART" && line.description === pending.description,
        );
        const match =
          partMatches.find(
            (line) =>
              line.quantity === pending.quantity &&
              line.unitPricePaise === pending.unitPricePaise,
          ) ?? partMatches[partMatches.length - 1];
        setRows(
          state.savedLines.map((line) => ({
            key: line.id,
            id: line.id,
            type: line.type as InvoiceLineTypeValue,
            description: line.description,
            quantity: line.quantity,
            unitPricePaise: line.unitPricePaise,
            gstRatePercent: 18,
            partId: "",
            priceKey: 0,
          })),
        );
        if (match) {
          setModalLineId(match.id);
        }
        router.refresh();
        return;
      }
      onEditingChange(false);
      return;
    }
    pendingWarrantyRef.current = null;
    toast.error(state.message);
  }, [state, t, onEditingChange, router]);

  useEffect(() => {
    if (!savingLineId) return;
    const next = docSignature(docsByLine.get(savingLineId));
    if (next !== savingBaseline) {
      setSavingLineId(null);
      setSavingBaseline("");
    }
  }, [docsByLine, savingLineId, savingBaseline]);

  const typeOptions = useMemo(
    () => [
      { value: "PART", label: t("lineTypes.PART") },
      { value: "LABOUR", label: t("lineTypes.LABOUR") },
      { value: "OUTSIDE", label: t("lineTypes.OUTSIDE") },
    ],
    [t],
  );

  const modalLine = rows.find((row) => row.id === modalLineId) ?? null;
  const modalDoc = modalLine?.id
    ? (docsByLine.get(modalLine.id) ?? null)
    : null;

  if (!editing) {
    return null;
  }

  function updateRow(key: string, patch: Partial<EditLine>) {
    setRows((prev) =>
      prev.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }

  function removeRow(key: string) {
    setRows((prev) =>
      prev.length <= 1 ? prev : prev.filter((row) => row.key !== key),
    );
  }

  function onPartPicked(key: string, partId: string, part: PartPickerItem | null) {
    if (!part) {
      updateRow(key, { partId: "", description: "" });
      return;
    }
    updateRow(key, {
      partId,
      description: part.name,
      unitPricePaise:
        part.sellingPricePaise > 0
          ? part.sellingPricePaise
          : rows.find((row) => row.key === key)?.unitPricePaise ?? 0,
      gstRatePercent: rows.find((row) => row.key === key)?.gstRatePercent ?? 18,
      priceKey: (rows.find((row) => row.key === key)?.priceKey ?? 0) + 1,
    });
  }

  function openCreatePart(lineKey: string, name = "") {
    setCreateForKey(lineKey);
    setCreateInitialName(name.trim());
    setCreateOpen(true);
  }

  async function handlePartCreated(part: CreatedPartSummary) {
    const full = await getPartPickerItemAction(part.id);
    const sellingPricePaise = full?.sellingPricePaise ?? 0;
    if (createForKey === addRowKey) {
      setAddType("PART");
      setAddPartId(part.id);
      setAddDescription(part.name);
      if (sellingPricePaise > 0) {
        setAddPriceText(paiseToRupeesInput(sellingPricePaise as Paise));
      }
      setAddPriceKey((key) => key + 1);
    } else if (createForKey) {
      onPartPicked(createForKey, part.id, {
        id: part.id,
        name: part.name,
        sku: part.sku,
        unit: part.unit,
        sellingPricePaise,
        quantityOnHand: full?.quantityOnHand ?? 0,
      });
    }
    setCreateOpen(false);
    setCreateInitialName("");
    setCreateForKey(null);
  }

  function addRow() {
    const description =
      addType === "PART"
        ? addDescription.trim()
        : addDescription.trim();
    if (addType === "PART" && !addPartId) {
      toast.error(ti("errors.partRequired"));
      return;
    }
    if (!description) {
      toast.error(t("errors.editNeedItem"));
      return;
    }
    setRows((prev) => [
      ...prev,
      {
        key: nextKey(),
        type: addType,
        description,
        quantity: addType === "PART" ? addQty : 1,
        unitPricePaise: parseRupeesField(addPriceText) as Paise,
        gstRatePercent: 18,
        partId: addType === "PART" ? addPartId : "",
        priceKey: 0,
      },
    ]);
    setAddDescription("");
    setAddPartId("");
    setAddQty(1);
    setAddPriceText("");
    setAddPriceKey((key) => key + 1);
  }

  function warrantyButton(row: EditLine) {
    if (row.type !== "PART") {
      return (
        <span className="inline-flex h-11 min-h-11 items-center justify-center text-slate-400">
          —
        </span>
      );
    }
    const doc = row.id ? (docsByLine.get(row.id) ?? null) : null;
    const required = partRequiresWarrantyCard(row.description);
    const hasCard = Boolean(doc && (doc.storageKey || doc.warrantyExpiresAt));
    const incomplete =
      required && !(doc?.storageKey && doc.warrantyExpiresAt);
    const expiryLabel = formatExpiryDate(doc?.warrantyExpiresAt ?? null, locale);
    const saving = Boolean(row.id && savingLineId === row.id);

    return (
      <div className="space-y-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={saving || pending}
          className={cn(
            "h-9 min-h-9 w-full min-w-28 px-2 text-[12px]",
            incomplete && !saving && "border-amber-300 text-amber-900",
          )}
          onClick={() => {
            if (saving || pending) return;
            if (row.id) {
              setModalLineId(row.id);
              return;
            }
            if (!row.description.trim()) {
              toast.error(t("errors.editNeedItem"));
              return;
            }
            pendingWarrantyRef.current = {
              description: row.description.trim(),
              quantity: row.quantity,
              unitPricePaise: row.unitPricePaise,
            };
            const form = document.getElementById(formId);
            if (form instanceof HTMLFormElement) {
              form.requestSubmit();
            }
          }}
        >
          {saving || pending
            ? tw("saving")
            : hasCard
              ? tw("editLine")
              : tw("addLine")}
        </Button>
        {expiryLabel ? (
          <p className="text-[11px] leading-snug text-slate-600">
            {tw("lineExpiresOn", { date: expiryLabel })}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4 border-b border-slate-200 bg-white px-4 py-4">
      <p className="text-[13px] text-slate-600">{t("editInvoiceHint")}</p>

      <div className="overflow-hidden rounded-xl border border-slate-300">
        <form action={formAction} id={formId}>
          <input type="hidden" name="notes" value={notes ?? ""} />

          <div className="hidden border-b border-slate-200 bg-slate-100 px-4 py-2.5 lg:grid lg:grid-cols-[8rem_minmax(0,1fr)_9rem_9.5rem_8.5rem_2.75rem] lg:gap-3">
            <p className="text-[13px] font-semibold text-slate-700">
              {t("lineType")}
            </p>
            <p className="text-[13px] font-semibold text-slate-700">
              {t("lineDescription")}
            </p>
            <p className="text-center text-[13px] font-semibold text-slate-700">
              {t("quantity")}
            </p>
            <p className="text-[13px] font-semibold text-slate-700">
              {t("unitPrice")}
            </p>
            <p className="text-[13px] font-semibold text-slate-700">
              {tw("columnWarranty")}
            </p>
            <span className="sr-only">{t("removeLine")}</span>
          </div>

          <ul className="divide-y divide-slate-200">
            {rows.map((row) => (
              <li key={row.key} className="bg-white px-4 py-3">
                <input type="hidden" name="lineId" value={row.id ?? ""} />
                <input
                  type="hidden"
                  name="partId"
                  value={row.type === "PART" ? row.partId : ""}
                />
                <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[8rem_minmax(0,1fr)_9rem_9.5rem_8.5rem_2.75rem]">
                  <FormField
                    id={`edit-type-${row.key}`}
                    label={t("lineType")}
                    className="lg:[&>label]:sr-only"
                  >
                    <FormSelect
                      id={`edit-type-${row.key}`}
                      name="type"
                      required
                      value={row.type}
                      options={typeOptions}
                      triggerClassName={controlClass}
                      onValueChange={(value) => {
                        const next = value as InvoiceLineTypeValue;
                        updateRow(row.key, {
                          type: next,
                          quantity: next === "PART" ? row.quantity : 1,
                          partId: next === "PART" ? row.partId : "",
                        });
                      }}
                    />
                  </FormField>

                  <FormField
                    id={`edit-desc-${row.key}`}
                    label={
                      row.type === "PART" ? ti("part") : t("lineDescription")
                    }
                    className="sm:col-span-2 lg:col-span-1 lg:[&>label]:sr-only"
                  >
                    {row.type === "PART" ? (
                      <>
                        <PartPickerSelect
                          id={`edit-part-${row.key}`}
                          value={row.partId}
                          initialLabel={row.description}
                          clearable={false}
                          disabled={pending}
                          onChange={(partId, part) =>
                            onPartPicked(row.key, partId, part)
                          }
                          onCreateFromQuery={(name) =>
                            openCreatePart(row.key, name)
                          }
                        />
                        <input
                          type="hidden"
                          name="description"
                          value={row.description}
                        />
                      </>
                    ) : (
                      <Input
                        id={`edit-desc-${row.key}`}
                        name="description"
                        required
                        maxLength={500}
                        value={row.description}
                        onChange={(event) =>
                          updateRow(row.key, {
                            description: event.target.value,
                          })
                        }
                        className={controlClass}
                        placeholder={
                          row.type === "OUTSIDE"
                            ? to("outsideWorkDescriptionPlaceholder")
                            : to("lineDescriptionPlaceholder")
                        }
                      />
                    )}
                  </FormField>

                  {row.type === "PART" ? (
                    <QuantityStepper
                      key={`qty-${row.key}-${row.quantity}`}
                      id={`edit-qty-${row.key}`}
                      name="quantity"
                      label={t("quantity")}
                      defaultValue={row.quantity}
                      min={1}
                      form={formId}
                      onValueChange={(quantity) =>
                        updateRow(row.key, { quantity })
                      }
                      className="lg:[&>label]:sr-only"
                    />
                  ) : (
                    <>
                      <input type="hidden" name="quantity" value="1" />
                      <div className="hidden h-11 min-h-11 items-center justify-center text-[14px] text-slate-400 lg:flex">
                        —
                      </div>
                    </>
                  )}

                  <FormField
                    id={`edit-price-${row.key}`}
                    label={t("unitPrice")}
                    className="lg:[&>label]:sr-only"
                  >
                    <Input
                      key={`price-${row.key}-${row.priceKey}`}
                      id={`edit-price-${row.key}`}
                      name="unitPriceRupees"
                      type="text"
                      inputMode="decimal"
                      required
                      defaultValue={paiseToRupeesInput(
                        row.unitPricePaise as Paise,
                      )}
                      className={cn(controlClass, "tabular-nums")}
                      onFocus={(event) => {
                        if (isZeroRupeesInput(event.currentTarget.value)) {
                          event.currentTarget.select();
                        }
                      }}
                      onChange={(event) => {
                        event.currentTarget.value = sanitizeRupeesTyping(
                          event.currentTarget.value,
                        );
                        updateRow(row.key, {
                          unitPricePaise: parseRupeesField(
                            event.currentTarget.value,
                          ),
                        });
                      }}
                    />
                  </FormField>

                  <div>
                    <p className="mb-1.5 text-[13px] font-semibold text-slate-600 lg:hidden">
                      {tw("columnWarranty")}
                    </p>
                    {warrantyButton(row)}
                  </div>

                  <div className="flex items-end justify-end pb-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={rows.length <= 1 || pending}
                      onClick={() => removeRow(row.key)}
                      aria-label={t("removeLine")}
                      className="text-red-700 hover:bg-red-50 hover:text-red-800"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </form>

        <div className="space-y-3 border-t border-slate-200 bg-[#fafcff] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className="text-[14px] font-semibold text-slate-900">
              {t("addInvoiceLine")}
            </strong>
            <small className="text-[13px] text-slate-500">
              {t("editInvoiceAddHint")}
            </small>
          </div>
          <div
            className={cn(
              "grid grid-cols-1 items-end gap-3 sm:grid-cols-2",
              addType === "PART"
                ? "lg:grid-cols-[8rem_minmax(0,1fr)_9rem_9.5rem_auto]"
                : "lg:grid-cols-[8rem_minmax(0,1fr)_9.5rem_auto]",
            )}
          >
            <FormField id="add-type" label={t("lineType")}>
              <FormSelect
                id="add-type"
                required
                value={addType}
                options={typeOptions}
                triggerClassName={controlClass}
                onValueChange={(value) => {
                  const next = value as InvoiceLineTypeValue;
                  setAddType(next);
                  setAddPartId("");
                  setAddDescription("");
                  if (next !== "PART") setAddQty(1);
                  setAddPriceKey((key) => key + 1);
                }}
              />
            </FormField>
            <FormField
              id="add-description"
              label={addType === "PART" ? ti("part") : t("lineDescription")}
              className="sm:col-span-2 lg:col-span-1"
            >
              {addType === "PART" ? (
                <PartPickerSelect
                  key={`add-part-${addPriceKey}`}
                  id="add-part"
                  value={addPartId}
                  clearable={false}
                  disabled={pending}
                  onChange={(partId, part) => {
                    setAddPartId(partId);
                    setAddDescription(part?.name ?? "");
                    if (part && part.sellingPricePaise > 0) {
                      setAddPriceText(
                        paiseToRupeesInput(part.sellingPricePaise as Paise),
                      );
                    }
                  }}
                  onCreateFromQuery={(name) =>
                    openCreatePart(addRowKey, name)
                  }
                />
              ) : (
                <Input
                  id="add-description"
                  maxLength={500}
                  value={addDescription}
                  onChange={(event) => setAddDescription(event.target.value)}
                  placeholder={
                    addType === "OUTSIDE"
                      ? to("outsideWorkDescriptionPlaceholder")
                      : to("lineDescriptionPlaceholder")
                  }
                  className={controlClass}
                />
              )}
            </FormField>
            {addType === "PART" ? (
              <QuantityStepper
                key={`add-qty-${addPriceKey}`}
                id="add-quantity"
                label={t("quantity")}
                defaultValue={addQty}
                min={1}
                onValueChange={setAddQty}
              />
            ) : null}
            <FormField id="add-unit-price" label={t("unitPrice")}>
              <Input
                key={`add-price-${addPriceKey}`}
                id="add-unit-price"
                type="text"
                inputMode="decimal"
                value={addPriceText}
                placeholder="0"
                className={cn(controlClass, "tabular-nums")}
                onFocus={(event) => {
                  if (isZeroRupeesInput(event.currentTarget.value)) {
                    event.currentTarget.select();
                  }
                }}
                onChange={(event) => {
                  setAddPriceText(sanitizeRupeesTyping(event.target.value));
                }}
              />
            </FormField>
            <Button
              type="button"
              variant="primary"
              size="md"
              className="h-11 min-h-11 gap-1.5 px-4"
              disabled={pending || (addType === "PART" && !addPartId)}
              onClick={addRow}
            >
              <Plus className="size-4" strokeWidth={2.5} aria-hidden />
              {t("addInvoiceLine")}
            </Button>
          </div>
          {addType === "PART" ? (
            <p className="text-[12px] text-slate-500">
              {tw("invoicePanelHint")}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={pending}
          onClick={() => onEditingChange(false)}
        >
          {t("cancelEditInvoice")}
        </Button>
        <Button
          type="submit"
          form={formId}
          variant="primary"
          className="min-h-11"
          loading={pending}
        >
          {pending ? t("saving") : t("saveInvoice")}
        </Button>
      </div>

      {modalLine?.id ? (
        <InvoiceLineWarrantyModal
          open
          onOpenChange={(open) => {
            if (!open) setModalLineId(null);
          }}
          orderId={orderId}
          invoiceId={invoiceId}
          vehicleId={vehicleId}
          lineId={modalLine.id}
          lineDescription={modalLine.description}
          doc={modalDoc}
          onSaveStart={() => {
            setSavingLineId(modalLine.id!);
            setSavingBaseline(docSignature(modalDoc));
          }}
          onSaveSuccess={() => {
            setModalLineId(null);
            router.refresh();
          }}
          onSaveError={() => {
            setSavingLineId(null);
            setSavingBaseline("");
          }}
        />
      ) : null}

      <CreatePartModal
        trigger={null}
        open={createOpen}
        onOpenChange={(next) => {
          setCreateOpen(next);
          if (!next) {
            setCreateInitialName("");
            setCreateForKey(null);
          }
        }}
        navigateOnSuccess={false}
        shopReceive
        initialName={createInitialName}
        onCreated={handlePartCreated}
      />
    </div>
  );
}
