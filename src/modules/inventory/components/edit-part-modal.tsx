"use client";

import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import {
  savePartShopReceiveAction,
  updatePartAction,
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
import {
  GST_RATE_OPTIONS,
  PART_UNIT_OPTIONS,
} from "@/modules/inventory/schema";
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

function EditPartNameField({
  id,
  defaultName,
}: {
  id: string;
  defaultName: string;
}) {
  const t = useTranslations("inventory");
  const [name, setName] = useState(defaultName);

  return (
    <FormField id={id} label={t("name")}>
      <PartNameSuggestInput
        id={id}
        value={name}
        onValueChange={setName}
        required
        maxLength={200}
        autoFocus
        className="h-11 min-h-11"
      />
    </FormField>
  );
}

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
  quantityOnHand: number;
};

type Props = {
  part: EditPartValues;
  /** Pass `null` to hide the trigger (controlled open only). */
  trigger?: React.ReactNode | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSaved?: () => void;
  /** Job-card zero-stock flow: prices start at 0; vendor + bill when adding stock. */
  resetPrices?: boolean;
  /** Inventory / job-card: Bought From lines for stock-in + vendor bills. */
  shopReceive?: boolean;
};

export function EditPartModal({
  part,
  trigger,
  open: openControlled,
  onOpenChange,
  onSaved,
  resetPrices = false,
  shopReceive = false,
}: Props) {
  const t = useTranslations("inventory");
  const tvb = useTranslations("vendorBills");
  const router = useRouter();
  const formId = useId();
  const [openUncontrolled, setOpenUncontrolled] = useState(false);
  const controlled = openControlled !== undefined;
  const open = controlled ? openControlled : openUncontrolled;
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  const [shopLines, setShopLines] = useState(createEmptyShopReceiveLines);
  const [vendorErrorKeys, setVendorErrorKeys] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const pendingFilesRef = useRef<Array<File | null>>([]);

  function setOpen(next: boolean) {
    if (!controlled) {
      setOpenUncontrolled(next);
    }
    onOpenChange?.(next);
  }

  function handleShopLinesChange(lines: ShopReceiveLine[]) {
    setShopLines(lines);
    pendingFilesRef.current = shopReceiveFilesForUpload(lines);
    // Once any vendor is chosen, clear empty-row errors.
    if (lines.some((line) => line.vendorId.trim())) {
      setVendorErrorKeys([]);
    } else {
      setVendorErrorKeys((prev) =>
        prev.filter((key) => lines.some((row) => row.key === key)),
      );
    }
  }

  const useShopReceive = resetPrices || shopReceive;
  const boundUpdate = useMemo(
    () =>
      (useShopReceive ? savePartShopReceiveAction : updatePartAction).bind(
        null,
        part.id,
      ),
    [part.id, useShopReceive],
  );
  const [state, formAction, pending] = useActionState(boundUpdate, initial);
  const handled = useRef<string | null>(null);
  const purchaseDefault = resetPrices ? 0 : part.purchasePricePaise;
  const sellingDefault = resetPrices ? 0 : part.sellingPricePaise;
  const formKey = [
    part.id,
    part.name,
    part.sku,
    part.unit,
    purchaseDefault,
    sellingDefault,
    part.gstRatePercent,
    part.hsn,
    part.lowStockLevel,
    part.quantityOnHand,
    resetPrices ? "reset" : "keep",
    useShopReceive ? "shop" : "plain",
  ].join("|");

  useEffect(() => {
    if (!state.message || state.message === handled.current) return;
    handled.current = state.message;

    if (!state.ok) {
      toast.error(state.message);
      return;
    }

    const billIds =
      state.vendorBillIds ?? (state.vendorBillId ? [state.vendorBillId] : []);
    const files = pendingFilesRef.current;

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
          toast.success(state.message);
        } catch (err) {
          const reason =
            err instanceof Error ? err.message : tvb("uploadFailed");
          toast.error(t("shopReceiveUploadFailed", { reason }));
        } finally {
          setUploading(false);
        }
      } else {
        toast.success(state.message);
      }

      pendingFilesRef.current = [];
      setShopLines(createEmptyShopReceiveLines());
      router.refresh();
      window.setTimeout(() => {
        onSavedRef.current?.();
        setOpen(false);
      }, 0);
    })();
  }, [state, router, t, tvb]);

  const busy = pending || uploading;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          handled.current = null;
          return;
        }
        pendingFilesRef.current = [];
        setShopLines(createEmptyShopReceiveLines());
      }}
    >
      {trigger === null ? null : (
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
      )}
      <DialogContent className="gap-0 bg-background p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle>{t("editTitle")}</DialogTitle>
          <DialogDescription>{part.name}</DialogDescription>
        </DialogHeader>

        <DialogBody className="bg-background px-5 py-4">
          <form
            id={formId}
            key={formKey}
            action={formAction}
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              if (!useShopReceive) {
                setVendorErrorKeys([]);
                return;
              }
              const errorKeys = shopReceiveRequiredVendorErrorKeys(shopLines);
              if (errorKeys.length > 0) {
                event.preventDefault();
                setVendorErrorKeys(errorKeys);
                return;
              }
              setVendorErrorKeys([]);
            }}
          >
            <EditPartNameField
              key={formKey}
              id={`edit-part-name-${part.id}`}
              defaultName={part.name}
            />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
              <RupeePriceInput
                id={`edit-purchasePriceRupees-${part.id}`}
                name="purchasePriceRupees"
                label={t("purchasePrice")}
                hint={t("priceHint")}
                defaultPaise={purchaseDefault}
                inputClassName="h-11 min-h-11"
              />
              <RupeePriceInput
                id={`edit-sellingPriceRupees-${part.id}`}
                name="sellingPriceRupees"
                label={t("sellingPrice")}
                hint={t("priceHint")}
                defaultPaise={sellingDefault}
                inputClassName="h-11 min-h-11"
              />
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

            {useShopReceive ? (
              <>
                <FormField
                  id={`edit-current-stock-${part.id}`}
                  label={t("openingStock")}
                  hint={
                    shopLines.some((line) => line.vendorId.trim())
                      ? t("stockAfterReceive", {
                          count:
                            part.quantityOnHand +
                            shopLines
                              .filter((line) => line.vendorId.trim())
                              .reduce(
                                (sum, line) => sum + Math.max(0, line.quantity),
                                0,
                              ),
                          unit: part.unit,
                        })
                      : undefined
                  }
                >
                  <Input
                    id={`edit-current-stock-${part.id}`}
                    value={t("stockCount", {
                      count: part.quantityOnHand,
                      unit: part.unit,
                    })}
                    disabled
                    className="h-11 min-h-11"
                  />
                </FormField>
                <ShopReceiveFields
                  idPrefix={`edit-shop-${part.id}`}
                  disabled={busy}
                  lines={shopLines}
                  onLinesChange={handleShopLinesChange}
                  vendorErrorKeys={vendorErrorKeys}
                  vendorCreateMode="inline"
                />
              </>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  id={`edit-current-stock-${part.id}`}
                  label={t("openingStock")}
                >
                  <Input
                    id={`edit-current-stock-${part.id}`}
                    value={t("stockCount", {
                      count: part.quantityOnHand,
                      unit: part.unit,
                    })}
                    disabled
                    className="h-11 min-h-11"
                  />
                </FormField>
                <QuantityStepper
                  id={`edit-addStockQuantity-${part.id}`}
                  name="addStockQuantity"
                  label={t("addStock")}
                  defaultValue={0}
                  min={0}
                  hint={t("addStockHint")}
                />
              </div>
            )}

            <input
              type="hidden"
              name="lowStockLevel"
              value={part.lowStockLevel}
            />
          </form>
        </DialogBody>

        <DialogFooter className="gap-2 border-t border-border bg-background px-5 py-4 sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            size="md"
            disabled={busy}
            onClick={() => {
              pendingFilesRef.current = [];
              setShopLines(createEmptyShopReceiveLines());
              setOpen(false);
            }}
          >
            {t("cancel")}
          </Button>
          <Button type="submit" form={formId} size="md" loading={busy}>
            {busy ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
