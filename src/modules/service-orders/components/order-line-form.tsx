"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  addServiceOrderLineAction,
  type ServiceOrderActionState,
} from "@/app/actions/service-orders";
import {
  createPartByNameAction,
  getPartEditValuesAction,
  getPartPickerItemAction,
} from "@/app/actions/inventory";
import { RupeePriceInput } from "@/components/rupee-price-input";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { FormSelect } from "@/components/ui/form-select";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
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

const initial: ServiceOrderActionState = { ok: false };

const fieldControlClass =
  "h-11 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] shadow-xs outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/25";

type Props = {
  orderId: string;
  /** Technician: no price field; server stores 0 until owner sets it. */
  hidePrices?: boolean;
};

export function OrderLineForm({ orderId, hidePrices = false }: Props) {
  const t = useTranslations("orders");
  const ti = useTranslations("inventory");
  const tc = useTranslations("common");
  const bound = useMemo(
    () => addServiceOrderLineAction.bind(null, orderId),
    [orderId],
  );
  const [state, formAction, pending] = useActionState(bound, initial);
  const wasPending = useRef(false);
  const partsOnly = hidePrices;
  const [lineType, setLineType] = useState<"LABOUR" | "PART">("PART");
  const [partId, setPartId] = useState("");
  const [selected, setSelected] = useState<PartPickerItem | null>(null);
  const [editPart, setEditPart] = useState<EditPartValues | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createInitialName, setCreateInitialName] = useState("");
  const [creatingPart, setCreatingPart] = useState(false);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    const finished = wasPending.current && !pending;
    wasPending.current = pending;
    if (!finished || !state.message) return;

    if (state.ok) {
      toast.success(t("lineAdded"));
      setPartId("");
      setSelected(null);
      setEditOpen(false);
      setEditPart(null);
      setFormKey((key) => key + 1);
      return;
    }
    toast.error(state.message);
  }, [pending, state, t]);

  async function refreshSelectedPart(id: string) {
    const full = await getPartPickerItemAction(id);
    if (full) {
      setSelected(full);
      setPartId(full.id);
    }
  }

  async function openInventoryFormForPart(part: PartPickerItem) {
    const values = await getPartEditValuesAction(part.id);
    if (!values) {
      toast.error(tc("notFound"));
      return;
    }
    setSelected({
      id: part.id,
      name: values.name,
      sku: values.sku,
      unit: values.unit,
      sellingPricePaise: 0,
      quantityOnHand: values.quantityOnHand,
    });
    setEditPart({
      id: values.id,
      name: values.name,
      sku: values.sku,
      unit: values.unit,
      purchasePricePaise: values.purchasePricePaise,
      sellingPricePaise: values.sellingPricePaise,
      gstRatePercent: values.gstRatePercent,
      hsn: values.hsn,
      lowStockLevel: values.lowStockLevel,
      quantityOnHand: values.quantityOnHand,
    });
    setEditOpen(true);
  }

  async function handlePartChange(
    nextId: string,
    part: PartPickerItem | null,
  ) {
    setPartId(nextId);
    if (part && part.quantityOnHand <= 0 && !hidePrices) {
      setSelected({
        ...part,
        sellingPricePaise: 0,
      });
      await openInventoryFormForPart(part);
      return;
    }
    setSelected(part);
  }

  function openCreatePartModal(name = "") {
    setCreateInitialName(name.trim());
    setCreateOpen(true);
  }

  async function handlePartCreated(part: CreatedPartSummary) {
    setLineType("PART");
    setPartId(part.id);
    setSelected({
      id: part.id,
      name: part.name,
      sku: part.sku,
      unit: part.unit,
      sellingPricePaise: 0,
      quantityOnHand: 0,
    });
    setCreateOpen(false);
    setCreateInitialName("");
    await refreshSelectedPart(part.id);
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
        await handlePartCreated({
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

  async function handleEditSaved() {
    if (!editPart) return;
    await refreshSelectedPart(editPart.id);
  }

  return (
    <form action={formAction} className="space-y-2">
      {partsOnly ? <input type="hidden" name="type" value="PART" /> : null}
      <div
        className={
          hidePrices
            ? "grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto]"
            : "grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[8rem_minmax(0,1fr)_9rem_9.5rem_auto] lg:gap-3"
        }
      >
        {!partsOnly ? (
          <FormField id="type" label={t("lineType")}>
            <FormSelect
              id="type"
              name="type"
              required
              value={lineType}
              onValueChange={(value) => {
                const next = value === "PART" ? "PART" : "LABOUR";
                setLineType(next);
                setPartId("");
                setSelected(null);
                setEditOpen(false);
                setEditPart(null);
              }}
              options={[
                { value: "PART", label: t("lineTypes.PART") },
                { value: "LABOUR", label: t("lineTypes.LABOUR") },
              ]}
              triggerClassName={fieldControlClass}
            />
          </FormField>
        ) : null}

        {lineType === "PART" ? (
          <FormField
            id="partId"
            label={ti("part")}
            className={partsOnly ? undefined : "sm:col-span-2 lg:col-span-1"}
          >
            <PartPickerSelect
              key={`part-${formKey}`}
              id="partId"
              name="partId"
              value={partId}
              onChange={handlePartChange}
              onCreateFromQuery={handleCreateFromQuery}
              disabled={creatingPart || pending}
              nameOnlyLabels={partsOnly}
            />
            <input
              type="hidden"
              name="description"
              value={selected?.name ?? ""}
            />
          </FormField>
        ) : (
          <FormField
            id="description"
            label={t("lineDescription")}
            className="sm:col-span-2 lg:col-span-1"
          >
            <Input
              key={`labour-${formKey}`}
              id="description"
              name="description"
              required
              maxLength={500}
              placeholder={t("lineDescriptionPlaceholder")}
              className={fieldControlClass}
            />
            <input type="hidden" name="partId" value="" />
          </FormField>
        )}

        {lineType === "LABOUR" && !partsOnly ? (
          <input type="hidden" name="quantity" value="1" />
        ) : (
          <QuantityStepper
            key={`qty-${formKey}`}
            id="quantity"
            name="quantity"
            label={t("quantity")}
            defaultValue={1}
            min={1}
          />
        )}

        {hidePrices ? (
          <input type="hidden" name="unitPriceRupees" value="0" />
        ) : (
          <RupeePriceInput
            label={t("unitPrice")}
            hint=""
            defaultPaise={
              lineType === "PART" ? (selected?.sellingPricePaise ?? 0) : 0
            }
            key={`price-${formKey}-${lineType}-${selected?.id ?? "labour"}-${selected?.sellingPricePaise ?? 0}`}
            inputClassName="h-11 min-h-11 rounded-lg border-slate-300 text-[14px] shadow-xs focus-visible:border-blue-600 focus-visible:ring-blue-600/25"
          />
        )}

        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={pending}
          disabled={lineType === "PART" && !partId}
          className="h-11 min-h-11 gap-1.5 px-4"
        >
          <Plus className="size-4" strokeWidth={2.5} />
          {t("addLineAction")}
        </Button>
      </div>

      {!hidePrices ? (
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
      ) : null}

      {!hidePrices && editPart ? (
        <EditPartModal
          part={editPart}
          trigger={null}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSaved={handleEditSaved}
          resetPrices
        />
      ) : null}
    </form>
  );
}
