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
import { NameSkuFields } from "@/modules/inventory/components/name-sku-fields";
import { QuantityStepper } from "@/modules/inventory/components/quantity-stepper";

const initial: InventoryActionState = { ok: false };

export type CreatedPartSummary = {
  id: string;
  name: string;
  sku: string;
  unit: string;
};

type SharedProps = {
  /** When set, stay put and call back instead of opening the part page. */
  onCreated?: (part: CreatedPartSummary) => void;
  navigateOnSuccess?: boolean;
  onCancel?: () => void;
  formKey?: string;
  idPrefix?: string;
};

function CreatePartFormFields({
  formAction,
  pending,
  onCancel,
  formKey,
  idPrefix = "modal-part",
  cancelAsButton = false,
}: {
  formAction: (payload: FormData) => void;
  pending: boolean;
  onCancel?: () => void;
  formKey?: string;
  idPrefix?: string;
  cancelAsButton?: boolean;
}) {
  const t = useTranslations("inventory");

  return (
    <form
      key={formKey}
      action={formAction}
      className="flex min-w-0 max-h-[min(70vh,36rem)] flex-col gap-4 overflow-x-hidden overflow-y-auto px-5 py-4"
    >
      <NameSkuFields
        idPrefix={idPrefix}
        autoSku
        autoFocusName
        afterSku={
          <FormField id={`${idPrefix}-unit`} label={t("unit")}>
            <FormSelect
              id={`${idPrefix}-unit`}
              name="unit"
              required
              defaultValue="pcs"
              options={PART_UNIT_OPTIONS.map((unit) => ({
                value: unit,
                label: t(`units.${unit}`),
              }))}
            />
          </FormField>
        }
      />

      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <RupeePriceInput
          id={`${idPrefix}-purchasePriceRupees`}
          name="purchasePriceRupees"
          label={t("purchasePrice")}
          hint={t("priceHint")}
          defaultPaise={0}
          inputClassName="h-11 min-h-11"
        />
        <RupeePriceInput
          id={`${idPrefix}-sellingPriceRupees`}
          name="sellingPriceRupees"
          label={t("sellingPrice")}
          hint={t("priceHint")}
          defaultPaise={0}
          inputClassName="h-11 min-h-11"
        />
      </div>

      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <FormField id={`${idPrefix}-gstRatePercent`} label={t("gstRate")}>
          <FormSelect
            id={`${idPrefix}-gstRatePercent`}
            name="gstRatePercent"
            defaultValue={String(DEFAULT_GST_RATE_PERCENT)}
            options={GST_RATE_OPTIONS.map((rate) => ({
              value: String(rate),
              label: `${rate}%`,
            }))}
          />
        </FormField>
        <FormField id={`${idPrefix}-hsn`} label={t("hsn")}>
          <Input
            id={`${idPrefix}-hsn`}
            name="hsn"
            required
            maxLength={16}
            defaultValue={DEFAULT_PART_HSN}
            className="h-11 min-h-11 font-mono"
          />
        </FormField>
      </div>

      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <QuantityStepper
          id={`${idPrefix}-lowStockLevel`}
          name="lowStockLevel"
          label={t("lowStockLevel")}
          defaultValue={0}
          min={0}
        />
        <QuantityStepper
          id={`${idPrefix}-openingStock`}
          name="openingStock"
          label={t("openingStock")}
          defaultValue={0}
          min={0}
          hint={t("openingStockHint")}
        />
      </div>

      <DialogFooter className="sticky bottom-0 gap-2 border-t border-border bg-background px-0 pt-4 sm:justify-end">
        {cancelAsButton ? (
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={onCancel}
          >
            {t("cancel")}
          </Button>
        ) : (
          <DialogClose asChild>
            <Button type="button" variant="secondary" size="md">
              {t("cancel")}
            </Button>
          </DialogClose>
        )}
        <Button type="submit" size="md" loading={pending}>
          {pending ? t("saving") : t("create")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function useCreatePartAction({
  onCreated,
  navigateOnSuccess,
  onSuccessExtra,
}: {
  onCreated?: (part: CreatedPartSummary) => void;
  navigateOnSuccess: boolean;
  onSuccessExtra?: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    createPartModalAction,
    initial,
  );
  const handled = useRef<string | null>(null);
  const onCreatedRef = useRef(onCreated);
  const navigateOnSuccessRef = useRef(navigateOnSuccess);
  const onSuccessExtraRef = useRef(onSuccessExtra);

  useEffect(() => {
    onCreatedRef.current = onCreated;
    navigateOnSuccessRef.current = navigateOnSuccess;
    onSuccessExtraRef.current = onSuccessExtra;
  }, [onCreated, navigateOnSuccess, onSuccessExtra]);

  useEffect(() => {
    if (!state.message || state.message === handled.current) return;
    handled.current = state.message;

    if (state.ok && state.partId) {
      toast.success(state.message);
      const summary: CreatedPartSummary = {
        id: state.partId,
        name: state.partName ?? "",
        sku: state.partSku ?? "",
        unit: state.partUnit ?? "pcs",
      };
      const id = window.setTimeout(() => {
        onCreatedRef.current?.(summary);
        onSuccessExtraRef.current?.();
        if (navigateOnSuccessRef.current) {
          router.push(`/inventory/${summary.id}`);
        }
      }, 0);
      return () => window.clearTimeout(id);
    }

    toast.error(state.message);
  }, [state, router]);

  function resetHandled() {
    handled.current = null;
  }

  return { formAction, pending, resetHandled, state };
}

type Props = SharedProps & {
  trigger?: React.ReactNode;
  size?: "sm" | "md";
};

/** Standalone dialog — inventory list / pages that are not already inside a modal. */
export function CreatePartModal({
  trigger,
  size = "md",
  onCreated,
  navigateOnSuccess = !onCreated,
}: Props) {
  const t = useTranslations("inventory");
  const [open, setOpen] = useState(false);
  const { formAction, pending, resetHandled } = useCreatePartAction({
    onCreated,
    navigateOnSuccess,
    onSuccessExtra: () => setOpen(false),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) resetHandled();
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
        <CreatePartFormFields
          formAction={formAction}
          pending={pending}
          formKey={open ? "create-part-open" : "create-part-closed"}
        />
      </DialogContent>
    </Dialog>
  );
}

type EmbeddedProps = SharedProps & {
  onCancel: () => void;
};

/**
 * Form only — use inside another dialog (e.g. Request Part) so we never nest
 * dialogs (nested dialogs shift layout when the inner one closes).
 */
export function CreatePartEmbedded({
  onCreated,
  onCancel,
  navigateOnSuccess = false,
}: EmbeddedProps) {
  const t = useTranslations("inventory");
  const { formAction, pending } = useCreatePartAction({
    onCreated,
    navigateOnSuccess,
    onSuccessExtra: onCancel,
  });

  return (
    <div className="flex min-w-0 flex-col">
      <div className="border-b border-border px-5 py-4 text-left">
        <h3 className="text-lg font-semibold leading-none">{t("newTitle")}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{t("newSubtitle")}</p>
      </div>
      <CreatePartFormFields
        formAction={formAction}
        pending={pending}
        onCancel={onCancel}
        cancelAsButton
        formKey="embedded-create-part"
        idPrefix="embedded-part"
      />
    </div>
  );
}
