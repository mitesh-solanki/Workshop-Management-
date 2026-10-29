"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import {
  createPartByNameModalAction,
  createPartModalAction,
  createPartShopReceiveAction,
  type InventoryActionState,
} from "@/app/actions/inventory";
import { RupeePriceInput } from "@/components/rupee-price-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
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
import { finishCreateModalNavigation } from "@/lib/create-modal-navigation";
import {
  DEFAULT_GST_RATE_PERCENT,
  DEFAULT_PART_HSN,
  GST_RATE_OPTIONS,
  PART_UNIT_OPTIONS,
} from "@/modules/inventory/schema";
import { NameSkuFields } from "@/modules/inventory/components/name-sku-fields";
import { PartNameSuggestInput } from "@/modules/inventory/components/part-name-suggest-input";
import { QuantityStepper } from "@/modules/inventory/components/quantity-stepper";
import {
  ShopReceiveFields,
  createEmptyShopReceiveLines,
  shopReceiveFilesForUpload,
  type ShopReceiveLine,
} from "@/modules/inventory/components/shop-receive-fields";
import { shopReceiveRequiredVendorErrorKeys } from "@/modules/inventory/shop-receive";
import { uploadVendorBillAttachmentFile } from "@/modules/purchases/components/upload-vendor-bill-attachment";

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
  /**
   * Bought From lines (vendor + qty + bill) on create — Job Card and Inventory.
   */
  shopReceive?: boolean;
  /** Prefill the name field (e.g. typed in the part picker). */
  initialName?: string;
  /** Technician: name-only create (no prices / stock / bills). */
  nameOnly?: boolean;
};

function CreatePartFormFields({
  formId,
  formAction,
  pending,
  formKey,
  idPrefix = "modal-part",
  shopReceive = false,
  shopLines,
  onShopLinesChange,
  initialName = "",
  nameOnly = false,
}: {
  formId: string;
  formAction: (payload: FormData) => void;
  pending: boolean;
  formKey?: string;
  idPrefix?: string;
  shopReceive?: boolean;
  shopLines: ShopReceiveLine[];
  onShopLinesChange: (lines: ShopReceiveLine[]) => void;
  initialName?: string;
  /** Technician: name (+ optional SKU) only; prices stay 0. */
  nameOnly?: boolean;
}) {
  const t = useTranslations("inventory");
  const [nameOnlyValue, setNameOnlyValue] = useState(initialName);
  const [vendorErrorKeys, setVendorErrorKeys] = useState<string[]>([]);
  const [manualStock, setManualStock] = useState(0);
  const vendorStockQty = shopLines
    .filter((line) => line.vendorId.trim())
    .reduce((sum, line) => sum + Math.max(0, line.quantity), 0);
  const stockFromVendors = vendorStockQty > 0;

  return (
    <form
      id={formId}
      key={formKey}
      action={formAction}
      className="flex min-w-0 flex-col gap-4"
      onSubmit={(event) => {
        if (!shopReceive || nameOnly) {
          setVendorErrorKeys([]);
          return;
        }
        // Job-card part create: need ≥1 vendor; blank extra rows are ignored.
        const errorKeys = shopReceiveRequiredVendorErrorKeys(shopLines);
        if (errorKeys.length > 0) {
          event.preventDefault();
          setVendorErrorKeys(errorKeys);
          return;
        }
        setVendorErrorKeys([]);
      }}
    >
      {nameOnly ? (
        <FormField id={`${idPrefix}-name`} label={t("name")}>
          <PartNameSuggestInput
            id={`${idPrefix}-name`}
            name="name"
            required
            maxLength={200}
            autoFocus
            value={nameOnlyValue}
            onValueChange={setNameOnlyValue}
            className="h-11 min-h-11"
          />
        </FormField>
      ) : (
        <NameSkuFields
          idPrefix={idPrefix}
          autoSku
          autoFocusName
          defaultName={initialName}
          afterSku={
            <>
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
              <RupeePriceInput
                id={`${idPrefix}-purchasePriceRupees`}
                name="purchasePriceRupees"
                label={t("purchasePrice")}
                hint={t("priceHint")}
                defaultPaise={0}
                inputClassName="h-11 min-h-11"
              />
            </>
          }
        />
      )}
      {nameOnly ? null : (
        <>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <RupeePriceInput
              id={`${idPrefix}-sellingPriceRupees`}
              name="sellingPriceRupees"
              label={t("sellingPrice")}
              hint={t("priceHint")}
              defaultPaise={0}
              inputClassName="h-11 min-h-11"
            />
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
            {shopReceive ? (
              stockFromVendors ? (
                <>
                  <input type="hidden" name="openingStock" value="0" />
                  <QuantityStepper
                    key={`auto-stock-${vendorStockQty}`}
                    id={`${idPrefix}-openingStock`}
                    name="openingStockDisplay"
                    label={t("openingStock")}
                    defaultValue={vendorStockQty}
                    min={0}
                    disabled
                    hint={t("openingStockFromVendorsHint")}
                  />
                </>
              ) : (
                <QuantityStepper
                  key="manual-stock"
                  id={`${idPrefix}-openingStock`}
                  name="openingStock"
                  label={t("openingStock")}
                  defaultValue={manualStock}
                  min={0}
                  hint={t("openingStockHint")}
                  onValueChange={setManualStock}
                />
              )
            ) : (
              <QuantityStepper
                id={`${idPrefix}-lowStockLevel`}
                name="lowStockLevel"
                label={t("lowStockLevel")}
                defaultValue={0}
                min={0}
              />
            )}
          </div>

          {shopReceive ? (
            <>
              <input type="hidden" name="lowStockLevel" value="0" />
              <ShopReceiveFields
                idPrefix={`${idPrefix}-shop`}
                disabled={pending}
                lines={shopLines}
                onLinesChange={(next) => {
                  if (next.some((line) => line.vendorId.trim())) {
                    setVendorErrorKeys([]);
                  } else {
                    setVendorErrorKeys((prev) =>
                      prev.filter((key) => next.some((row) => row.key === key)),
                    );
                  }
                  const nextVendorQty = next
                    .filter((line) => line.vendorId.trim())
                    .reduce(
                      (sum, line) => sum + Math.max(0, line.quantity),
                      0,
                    );
                  if (nextVendorQty > 0) {
                    setManualStock(nextVendorQty);
                  }
                  onShopLinesChange(next);
                }}
                vendorErrorKeys={vendorErrorKeys}
                vendorCreateMode="inline"
              />
            </>
          ) : (
            <QuantityStepper
              id={`${idPrefix}-openingStock`}
              name="openingStock"
              label={t("openingStock")}
              defaultValue={0}
              min={0}
              hint={t("openingStockHint")}
            />
          )}
        </>
      )}
    </form>
  );
}

function CreatePartActions({
  formId,
  pending,
  onCancel,
}: {
  formId: string;
  pending: boolean;
  onCancel: () => void;
}) {
  const t = useTranslations("inventory");

  return (
    <DialogFooter className="gap-2 border-t border-border bg-background px-5 py-4 sm:justify-end">
      <Button
        type="button"
        variant="secondary"
        size="md"
        onClick={onCancel}
        disabled={pending}
      >
        {t("cancel")}
      </Button>
      <Button type="submit" form={formId} size="md" loading={pending}>
        {pending ? t("saving") : t("create")}
      </Button>
    </DialogFooter>
  );
}

function useCreatePartAction({
  onCreated,
  navigateOnSuccess,
  onSuccessExtra,
  shopReceive = false,
  nameOnly = false,
}: {
  onCreated?: (part: CreatedPartSummary) => void;
  navigateOnSuccess: boolean;
  onSuccessExtra?: () => void;
  shopReceive?: boolean;
  nameOnly?: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("inventory");
  const tvb = useTranslations("vendorBills");
  const [state, formAction, pending] = useActionState(
    nameOnly
      ? createPartByNameModalAction
      : shopReceive
        ? createPartShopReceiveAction
        : createPartModalAction,
    initial,
  );
  const handled = useRef<string | null>(null);
  const onCreatedRef = useRef(onCreated);
  const navigateOnSuccessRef = useRef(navigateOnSuccess);
  const onSuccessExtraRef = useRef(onSuccessExtra);
  const pendingFilesRef = useRef<Array<File | null>>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    onCreatedRef.current = onCreated;
    navigateOnSuccessRef.current = navigateOnSuccess;
    onSuccessExtraRef.current = onSuccessExtra;
  }, [onCreated, navigateOnSuccess, onSuccessExtra]);

  useEffect(() => {
    if (!state.message || state.message === handled.current) return;
    handled.current = state.message;

    if (!(state.ok && state.partId)) {
      toast.error(state.message);
      return;
    }

    const summary: CreatedPartSummary = {
      id: state.partId,
      name: state.partName ?? "",
      sku: state.partSku ?? "",
      unit: state.partUnit ?? "pcs",
    };
    const billIds =
      state.vendorBillIds ?? (state.vendorBillId ? [state.vendorBillId] : []);
    const files = pendingFilesRef.current;

    let cancelled = false;
    void (async () => {
      const pairs = billIds
        .map((vendorBillId, index) => ({
          vendorBillId,
          file: files[index] ?? null,
        }))
        .filter(
          (pair): pair is { vendorBillId: string; file: File } =>
            pair.file != null,
        );

      if (pairs.length > 0) {
        setUploading(true);
        try {
          for (const pair of pairs) {
            await uploadVendorBillAttachmentFile({
              vendorBillId: pair.vendorBillId,
              file: pair.file,
              uploadFailedMessage: tvb("uploadFailed"),
            });
          }
          if (!cancelled) toast.success(state.message);
        } catch (err) {
          const reason =
            err instanceof Error ? err.message : tvb("uploadFailed");
          if (!cancelled) {
            toast.error(t("shopReceiveUploadFailed", { reason }));
          }
        } finally {
          if (!cancelled) setUploading(false);
        }
      } else if (!cancelled) {
        toast.success(state.message);
      }

      if (cancelled) return;
      pendingFilesRef.current = [];
      onCreatedRef.current?.(summary);
      if (navigateOnSuccessRef.current) {
        finishCreateModalNavigation({
          kind: "part",
          recordId: summary.id,
          href: `/inventory/${summary.id}`,
          router,
          close: () => {
            onSuccessExtraRef.current?.();
          },
        });
      } else {
        onSuccessExtraRef.current?.();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state, router, t, tvb]);

  function resetHandled() {
    handled.current = null;
  }

  function setPendingFiles(files: Array<File | null>) {
    pendingFilesRef.current = files;
  }

  return {
    formAction,
    pending: pending || uploading,
    resetHandled,
    state,
    setPendingFiles,
  };
}

type Props = SharedProps & {
  trigger?: React.ReactNode | null;
  size?: "sm" | "md";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/** Standalone dialog — inventory list / pages that are not already inside a modal. */
export function CreatePartModal({
  trigger,
  size = "md",
  onCreated,
  navigateOnSuccess = !onCreated,
  shopReceive = false,
  initialName = "",
  nameOnly = false,
  open: openControlled,
  onOpenChange,
}: Props) {
  const t = useTranslations("inventory");
  const formId = useId();
  const [openUncontrolled, setOpenUncontrolled] = useState(false);
  const open = openControlled ?? openUncontrolled;
  const setOpen = onOpenChange ?? setOpenUncontrolled;
  const [shopLines, setShopLines] = useState(createEmptyShopReceiveLines);
  const { formAction, pending, resetHandled, setPendingFiles } =
    useCreatePartAction({
      onCreated,
      navigateOnSuccess,
      shopReceive: nameOnly ? false : shopReceive,
      nameOnly,
      onSuccessExtra: () => {
        setOpen(false);
        setShopLines(createEmptyShopReceiveLines());
        setPendingFiles([]);
      },
    });

  function handleShopLinesChange(lines: ShopReceiveLine[]) {
    setShopLines(lines);
    setPendingFiles(shopReceiveFilesForUpload(lines));
  }

  function closeModal() {
    setOpen(false);
    setShopLines(createEmptyShopReceiveLines());
    setPendingFiles([]);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setOpen(true);
          resetHandled();
          return;
        }
        closeModal();
      }}
    >
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      {!trigger && openControlled == null ? (
        <DialogTrigger asChild>
          <Button type="button" size={size}>
            <Plus className="size-4" aria-hidden />
            {t("add")}
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent
        className={
          nameOnly
            ? "gap-0 bg-background p-0 sm:max-w-lg"
            : "gap-0 bg-background p-0 sm:max-w-4xl"
        }
      >
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle>{t("newTitle")}</DialogTitle>
          <DialogDescription>
            {nameOnly ? t("newSubtitleNameOnly") : t("newSubtitle")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="bg-background px-5 py-4">
          <CreatePartFormFields
            formId={formId}
            formAction={formAction}
            pending={pending}
            formKey={
              open
                ? `create-part-open-${initialName}`
                : "create-part-closed"
            }
            shopReceive={nameOnly ? false : shopReceive}
            shopLines={shopLines}
            onShopLinesChange={handleShopLinesChange}
            initialName={initialName}
            nameOnly={nameOnly}
          />
        </DialogBody>
        <CreatePartActions
          formId={formId}
          pending={pending}
          onCancel={closeModal}
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
  shopReceive = false,
}: EmbeddedProps) {
  const t = useTranslations("inventory");
  const formId = useId();
  const [shopLines, setShopLines] = useState(createEmptyShopReceiveLines);
  const { formAction, pending, setPendingFiles } = useCreatePartAction({
    onCreated,
    navigateOnSuccess,
    shopReceive,
    onSuccessExtra: () => {
      setShopLines(createEmptyShopReceiveLines());
      setPendingFiles([]);
      onCancel();
    },
  });

  function handleShopLinesChange(lines: ShopReceiveLine[]) {
    setShopLines(lines);
    setPendingFiles(shopReceiveFilesForUpload(lines));
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="relative z-10 shrink-0 border-b border-border bg-background px-5 py-4 text-left shadow-[0_6px_16px_-10px_rgba(15,23,42,0.35)]">
        <h3 className="text-lg font-semibold leading-none">{t("newTitle")}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{t("newSubtitle")}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
        <CreatePartFormFields
          formId={formId}
          formAction={formAction}
          pending={pending}
          formKey="embedded-create-part"
          idPrefix="embedded-part"
          shopReceive={shopReceive}
          shopLines={shopLines}
          onShopLinesChange={handleShopLinesChange}
        />
      </div>
      <CreatePartActions
        formId={formId}
        pending={pending}
        onCancel={onCancel}
      />
    </div>
  );
}
