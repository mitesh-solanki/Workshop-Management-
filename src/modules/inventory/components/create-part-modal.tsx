"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import {
  createPartModalAction,
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
  DEFAULT_GST_RATE_PERCENT,
  DEFAULT_PART_HSN,
  GST_RATE_OPTIONS,
  PART_UNIT_OPTIONS,
} from "@/modules/inventory/schema";
import { QuantityStepper } from "@/modules/inventory/components/quantity-stepper";

const initial: InventoryActionState = { ok: false };

type Props = {
  trigger?: React.ReactNode;
  size?: "sm" | "md";
};

export function CreatePartModal({ trigger, size = "md" }: Props) {
  const t = useTranslations("inventory");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    createPartModalAction,
    initial,
  );
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!state.message || state.message === handled.current) return;
    handled.current = state.message;

    if (state.ok && state.partId) {
      toast.success(state.message);
      router.push(`/inventory/${state.partId}`);
      return;
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
          <Button type="button" size={size}>
            <Plus className="size-4" aria-hidden />
            {t("add")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle>{t("newTitle")}</DialogTitle>
          <DialogDescription>{t("newSubtitle")}</DialogDescription>
        </DialogHeader>

        <form
          action={formAction}
          className="flex max-h-[min(80vh,40rem)] flex-col gap-4 overflow-y-auto px-5 py-4"
        >
          <FormField id="modal-part-name" label={t("name")}>
            <Input
              id="modal-part-name"
              name="name"
              required
              maxLength={200}
              autoFocus
              className="h-11 min-h-11"
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="modal-part-sku" label={t("sku")}>
              <Input
                id="modal-part-sku"
                name="sku"
                required
                maxLength={64}
                className="h-11 min-h-11 font-mono uppercase"
              />
            </FormField>
            <FormField id="modal-part-unit" label={t("unit")}>
              <FormSelect
                id="modal-part-unit"
                name="unit"
                required
                defaultValue="pcs"
                options={PART_UNIT_OPTIONS.map((unit) => ({
                  value: unit,
                  label: t(`units.${unit}`),
                }))}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <RupeePriceInput
              id="modal-purchasePriceRupees"
              name="purchasePriceRupees"
              label={t("purchasePrice")}
              hint={t("priceHint")}
              defaultPaise={0}
              inputClassName="h-11 min-h-11"
            />
            <RupeePriceInput
              id="modal-sellingPriceRupees"
              name="sellingPriceRupees"
              label={t("sellingPrice")}
              hint={t("priceHint")}
              defaultPaise={0}
              inputClassName="h-11 min-h-11"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="modal-gstRatePercent" label={t("gstRate")}>
              <FormSelect
                id="modal-gstRatePercent"
                name="gstRatePercent"
                defaultValue={String(DEFAULT_GST_RATE_PERCENT)}
                options={GST_RATE_OPTIONS.map((rate) => ({
                  value: String(rate),
                  label: `${rate}%`,
                }))}
              />
            </FormField>
            <FormField id="modal-hsn" label={t("hsn")}>
              <Input
                id="modal-hsn"
                name="hsn"
                required
                maxLength={16}
                defaultValue={DEFAULT_PART_HSN}
                className="h-11 min-h-11 font-mono"
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <QuantityStepper
              id="modal-lowStockLevel"
              name="lowStockLevel"
              label={t("lowStockLevel")}
              defaultValue={0}
              min={0}
            />
            <QuantityStepper
              id="modal-openingStock"
              name="openingStock"
              label={t("openingStock")}
              defaultValue={0}
              min={0}
              hint={t("openingStockHint")}
            />
          </div>

          <DialogFooter className="sticky bottom-0 gap-2 border-t border-border bg-background px-0 pt-4 sm:justify-end">
            <DialogClose asChild>
              <Button type="button" variant="secondary" size="md">
                {t("cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" size="md" loading={pending}>
              {pending ? t("saving") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
