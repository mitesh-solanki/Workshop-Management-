"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  createPartShopReceiveAction,
  savePartShopReceiveAction,
  type InventoryActionState,
} from "@/app/actions/inventory";
import { RupeePriceInput } from "@/components/rupee-price-input";
import { Button } from "@/components/ui/button";
import { FormActionBar } from "@/components/ui/form-action-bar";
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
import {
  ShopReceiveFields,
  createEmptyShopReceiveLines,
  shopReceiveFilesForUpload,
  type ShopReceiveLine,
} from "@/modules/inventory/components/shop-receive-fields";
import { uploadVendorBillAttachmentFile } from "@/modules/purchases/components/upload-vendor-bill-attachment";

const initial: InventoryActionState = { ok: false };

export type PartPageFormValues = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  purchasePricePaise: number;
  sellingPricePaise: number;
  gstRatePercent: number;
  hsn: string;
  lowStockLevel: number;
  quantityOnHand: number;
};

type Props =
  | { mode: "create" }
  | { mode: "edit"; part: PartPageFormValues };

export function PartPageForm(props: Props) {
  const t = useTranslations("inventory");
  const tvb = useTranslations("vendorBills");
  const router = useRouter();
  const formId = useId();
  const isEdit = props.mode === "edit";
  const part = isEdit ? props.part : null;

  const boundSave = isEdit
    ? savePartShopReceiveAction.bind(null, part!.id)
    : createPartShopReceiveAction;
  const [state, formAction, pending] = useActionState(boundSave, initial);
  const handled = useRef<string | null>(null);
  const [shopLines, setShopLines] = useState(createEmptyShopReceiveLines);
  const [vendorErrorKeys, setVendorErrorKeys] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const pendingFilesRef = useRef<Array<File | null>>([]);

  function handleShopLinesChange(lines: ShopReceiveLine[]) {
    setShopLines(lines);
    pendingFilesRef.current = shopReceiveFilesForUpload(lines);
    setVendorErrorKeys((prev) =>
      prev.filter((key) => {
        const line = lines.find((row) => row.key === key);
        return line ? !line.vendorId.trim() : false;
      }),
    );
  }

  useEffect(() => {
    if (!state.message || state.message === handled.current) return;
    handled.current = state.message;

    if (!(state.ok && state.partId)) {
      toast.error(state.message);
      return;
    }

    const partId = state.partId;
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
      router.push(`/inventory/${partId}`);
      router.refresh();
    })();

    return () => {
      cancelled = true;
    };
  }, [state, router, t, tvb]);

  const busy = pending || uploading;
  const cancelHref = isEdit ? `/inventory/${part!.id}` : "/inventory";
  const idPrefix = isEdit ? `edit-part-${part!.id}` : "new-part";

  return (
    <div className="space-y-6 pb-24 lg:pb-28">
      <form
        id={formId}
        action={formAction}
        className="grid gap-6 rounded-xl border border-border bg-card p-4 shadow-xs sm:p-6 lg:grid-cols-3"
        onSubmit={(event) => {
          if (isEdit) {
            setVendorErrorKeys([]);
            return;
          }
          const missing = shopLines
            .filter((line) => !line.vendorId.trim())
            .map((line) => line.key);
          if (missing.length > 0) {
            event.preventDefault();
            setVendorErrorKeys(missing);
            return;
          }
          setVendorErrorKeys([]);
        }}
      >
        <div className="lg:col-span-3">
          <NameSkuFields
            idPrefix={idPrefix}
            autoSku={!isEdit}
            autoFocusName
            singleRow
            defaultName={part?.name ?? ""}
            defaultSku={part?.sku ?? ""}
            afterSku={
              <QuantityStepper
                id={`${idPrefix}-lowStockLevel`}
                name="lowStockLevel"
                label={t("lowStockLevel")}
                defaultValue={part?.lowStockLevel ?? 0}
                min={0}
              />
            }
          />
        </div>

        <FormField id={`${idPrefix}-unit`} label={t("unit")}>
          <FormSelect
            id={`${idPrefix}-unit`}
            name="unit"
            required
            defaultValue={part?.unit ?? "pcs"}
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
          defaultPaise={part?.purchasePricePaise ?? 0}
          inputClassName="h-11 min-h-11"
        />
        <RupeePriceInput
          id={`${idPrefix}-sellingPriceRupees`}
          name="sellingPriceRupees"
          label={t("sellingPrice")}
          hint={t("priceHint")}
          defaultPaise={part?.sellingPricePaise ?? 0}
          inputClassName="h-11 min-h-11"
        />
        <FormField id={`${idPrefix}-gstRatePercent`} label={t("gstRate")}>
          <FormSelect
            id={`${idPrefix}-gstRatePercent`}
            name="gstRatePercent"
            defaultValue={String(
              part?.gstRatePercent ?? DEFAULT_GST_RATE_PERCENT,
            )}
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
            defaultValue={part?.hsn ?? DEFAULT_PART_HSN}
            className="h-11 min-h-11 font-mono"
          />
        </FormField>

        {isEdit ? (
          <FormField
            id={`${idPrefix}-current-stock`}
            label={t("openingStock")}
          >
            <Input
              id={`${idPrefix}-current-stock`}
              value={t("stockCount", {
                count: part!.quantityOnHand,
                unit: part!.unit,
              })}
              disabled
              className="h-11 min-h-11"
            />
          </FormField>
        ) : (
          <input type="hidden" name="openingStock" value="0" />
        )}

        <div className="lg:col-span-3">
          <ShopReceiveFields
            idPrefix={`${idPrefix}-shop`}
            disabled={busy}
            lines={shopLines}
            onLinesChange={handleShopLinesChange}
            vendorErrorKeys={vendorErrorKeys}
          />
        </div>
      </form>

      <FormActionBar
        summary={
          <p className="hidden truncate text-sm font-medium text-muted-foreground sm:block">
            {isEdit ? t("editTitle") : t("newTitle")}
            {isEdit && part?.name ? (
              <>
                {" · "}
                <span className="text-foreground">{part.name}</span>
              </>
            ) : null}
          </p>
        }
        actions={
          <>
            <Button asChild type="button" variant="secondary" size="md">
              <Link href={cancelHref}>{t("cancel")}</Link>
            </Button>
            <Button type="submit" form={formId} size="md" loading={busy}>
              {busy ? t("saving") : isEdit ? t("save") : t("create")}
            </Button>
          </>
        }
      />
    </div>
  );
}
