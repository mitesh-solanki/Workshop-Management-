"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import {
  updatePartAction,
  type InventoryActionState,
} from "@/app/actions/inventory";
import { RupeePriceInput } from "@/components/rupee-price-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { FormSelect } from "@/components/ui/form-select";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import {
  GST_RATE_OPTIONS,
  PART_UNIT_OPTIONS,
} from "@/modules/inventory/schema";
import { QuantityStepper } from "@/modules/inventory/components/quantity-stepper";

const initial: InventoryActionState = { ok: false };

export type EditPartValues = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  purchasePricePaise: number;
  sellingPricePaise: number;
  gstRatePercent: number;
  hsn: string;
  lowStockLevel: number;
};

type Props = {
  part: EditPartValues;
  trigger?: React.ReactNode;
};

export function EditPartModal({ part, trigger }: Props) {
  const t = useTranslations("inventory");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const boundUpdate = useMemo(
    () => updatePartAction.bind(null, part.id),
    [part.id],
  );
  const [state, formAction, pending] = useActionState(boundUpdate, initial);
  const handled = useRef<string | null>(null);
  const formKey = [
    part.id,
    part.name,
    part.sku,
    part.unit,
    part.purchasePricePaise,
    part.sellingPricePaise,
    part.gstRatePercent,
    part.hsn,
    part.lowStockLevel,
  ].join("|");

  useEffect(() => {
    if (!state.message || state.message === handled.current) return;
    handled.current = state.message;

    if (state.ok) {
      toast.success(state.message);
      router.refresh();
      const id = window.setTimeout(() => setOpen(false), 0);
      return () => window.clearTimeout(id);
    }

    toast.error(state.message);
  }, [state, router]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          handled.current = null;
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={t("edit")}
          >
            <Pencil className="size-4" aria-hidden />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle>{t("editTitle")}</DialogTitle>
          <DialogDescription>{part.name}</DialogDescription>
        </DialogHeader>

        <form
          key={formKey}
          action={formAction}
          className="flex max-h-[min(80vh,40rem)] flex-col gap-4 overflow-y-auto px-5 py-4"
        >
          <FormField id={`edit-part-name-${part.id}`} label={t("name")}>
            <Input
              id={`edit-part-name-${part.id}`}
              name="name"
              defaultValue={part.name}
              required
              maxLength={200}
              autoFocus
              className="h-11 min-h-11"
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id={`edit-part-sku-${part.id}`} label={t("sku")}>
              <Input
                id={`edit-part-sku-${part.id}`}
                name="sku"
                defaultValue={part.sku}
                required
                maxLength={64}
                className="h-11 min-h-11 font-mono uppercase"
              />
            </FormField>
            <FormField id={`edit-part-unit-${part.id}`} label={t("unit")}>
              <FormSelect
                id={`edit-part-unit-${part.id}`}
                name="unit"
                required
                defaultValue={part.unit}
                options={PART_UNIT_OPTIONS.map((unit) => ({
                  value: unit,
                  label: t(`units.${unit}`),
                }))}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <RupeePriceInput
              id={`edit-purchasePriceRupees-${part.id}`}
              name="purchasePriceRupees"
              label={t("purchasePrice")}
              hint={t("priceHint")}
              defaultPaise={part.purchasePricePaise}
              inputClassName="h-11 min-h-11"
            />
            <RupeePriceInput
              id={`edit-sellingPriceRupees-${part.id}`}
              name="sellingPriceRupees"
              label={t("sellingPrice")}
              hint={t("priceHint")}
              defaultPaise={part.sellingPricePaise}
              inputClassName="h-11 min-h-11"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id={`edit-gstRatePercent-${part.id}`}
              label={t("gstRate")}
            >
              <FormSelect
                id={`edit-gstRatePercent-${part.id}`}
                name="gstRatePercent"
                defaultValue={String(part.gstRatePercent)}
                options={GST_RATE_OPTIONS.map((rate) => ({
                  value: String(rate),
                  label: `${rate}%`,
                }))}
              />
            </FormField>
            <FormField id={`edit-hsn-${part.id}`} label={t("hsn")}>
              <Input
                id={`edit-hsn-${part.id}`}
                name="hsn"
                defaultValue={part.hsn}
                required
                maxLength={16}
                className="h-11 min-h-11 font-mono"
              />
            </FormField>
          </div>

          <QuantityStepper
            id={`edit-lowStockLevel-${part.id}`}
            name="lowStockLevel"
            label={t("lowStockLevel")}
            defaultValue={part.lowStockLevel}
            min={0}
          />

          <DialogFooter className="sticky bottom-0 gap-2 border-t border-border bg-background px-0 pt-4 sm:justify-end">
            <DialogClose asChild>
              <Button type="button" variant="secondary" size="md">
                {t("cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" size="md" loading={pending}>
              {pending ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
