"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Upload, X } from "lucide-react";
import {
  createVendorBillModalAction,
  type PurchasesActionState,
} from "@/app/actions/purchases";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { finishCreateModalNavigation } from "@/lib/create-modal-navigation";
import {
  isZeroRupeesInput,
  parseRupeesToPaise,
  sanitizeRupeesTyping,
} from "@/lib/money";
import { uploadVendorBillAttachmentFile } from "@/modules/purchases/components/upload-vendor-bill-attachment";

const initial: PurchasesActionState = { ok: false };

type FormValues = {
  vendorId: string;
  purchaseOrderId: string;
  billNumber: string;
  billDate: string;
  amount: string;
  notes: string;
};

type Props = {
  vendors: { id: string; name: string }[];
  purchaseOrders?: { id: string; number: string; vendorId: string }[];
  defaultVendorId?: string;
  defaultPurchaseOrderId?: string;
  stayAndRefresh?: boolean;
  trigger?: React.ReactNode;
  size?: "sm" | "md";
};

function emptyValues(
  defaultVendorId?: string,
  defaultPurchaseOrderId?: string,
): FormValues {
  return {
    vendorId: defaultVendorId ?? "",
    purchaseOrderId: defaultPurchaseOrderId ?? "",
    billNumber: "",
    billDate: "",
    amount: "",
    notes: "",
  };
}

export function CreateVendorBillModal({
  vendors,
  purchaseOrders = [],
  defaultVendorId,
  defaultPurchaseOrderId,
  stayAndRefresh = false,
  trigger,
  size = "md",
}: Props) {
  const t = useTranslations("vendorBills");
  const te = useTranslations("errors");
  const tc = useTranslations("common");
  const router = useRouter();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(() =>
    emptyValues(defaultVendorId, defaultPurchaseOrderId),
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingFileRef = useRef<File | null>(null);
  const [state, formAction, pending] = useActionState(
    createVendorBillModalAction,
    initial,
  );
  const handled = useRef<string | null>(null);
  const refreshedForId = useRef<string | null>(null);

  useEffect(() => {
    if (!state.message || state.message === handled.current) return;
    handled.current = state.message;

    if (!state.ok || !state.id) {
      toast.error(state.message);
      return;
    }

    const billId = state.id;
    const selected = pendingFileRef.current;

    void (async () => {
      if (selected) {
        setUploading(true);
        try {
          await uploadVendorBillAttachmentFile({
            vendorBillId: billId,
            file: selected,
            uploadFailedMessage: t("uploadFailed"),
          });
          toast.success(t("createdWithAttachment"));
        } catch (err) {
          const message =
            err instanceof Error ? err.message : t("uploadFailed");
          toast.error(t("createdButUploadFailed", { reason: message }));
        } finally {
          setUploading(false);
        }
      } else {
        toast.success(state.message);
      }
      pendingFileRef.current = null;
      window.setTimeout(() => {
        setFile(null);
        setValues(emptyValues(defaultVendorId, defaultPurchaseOrderId));
        setFieldErrors({});
        setOpen(false);
        if (stayAndRefresh) {
          if (refreshedForId.current !== billId) {
            refreshedForId.current = billId;
            router.refresh();
          }
          return;
        }
        finishCreateModalNavigation({
          kind: "vendor-bill",
          recordId: billId,
          href: `/vendor-bills/${billId}`,
          router,
          close: () => setOpen(false),
        });
      }, 0);
    })();
  }, [state, router, t, stayAndRefresh, defaultVendorId, defaultPurchaseOrderId]);

  function setField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({
      ...prev,
      [key]: typeof value === "string" ? value : value == null ? "" : value,
    }));
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function onPurchaseOrderChange(purchaseOrderId: string) {
    const po = purchaseOrders.find((row) => row.id === purchaseOrderId);
    setValues((prev) => ({
      ...prev,
      purchaseOrderId,
      vendorId:
        !defaultVendorId && po?.vendorId
          ? po.vendorId
          : (prev.vendorId ?? defaultVendorId ?? ""),
    }));
    setFieldErrors((prev) => {
      if (!prev.purchaseOrderId && !prev.vendorId) return prev;
      const next = { ...prev };
      delete next.purchaseOrderId;
      delete next.vendorId;
      return next;
    });
  }

  function validateClient(): boolean {
    const next: Record<string, string> = {};
    const vendorId = (values.vendorId ?? defaultVendorId ?? "").trim();
    if (!vendorId) {
      next.vendorId = te("validation.required");
    }
    const amount = values.amount ?? "";
    const amountPaise = parseRupeesToPaise(amount);
    if (isZeroRupeesInput(amount) || amountPaise == null) {
      next.amount = te("validation.required");
    } else if (amountPaise <= 0) {
      next.amount = te("validation.invalidInput");
    }
    setFieldErrors(next);
    if (Object.keys(next).length === 0) return true;
    const first = Object.keys(next)[0];
    window.setTimeout(() => {
      document
        .getElementById(`modal-vb-${first === "vendorId" ? "vendor" : first}`)
        ?.focus();
    }, 50);
    return false;
  }

  const vendorIdValue = values.vendorId ?? defaultVendorId ?? "";
  const purchaseOrdersForVendor = vendorIdValue
    ? purchaseOrders.filter((po) => po.vendorId === vendorIdValue)
    : purchaseOrders;

  const busy = pending || uploading;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          handled.current = null;
          setFieldErrors({});
          return;
        }
        pendingFileRef.current = null;
        setFile(null);
        setValues(emptyValues(defaultVendorId, defaultPurchaseOrderId));
        setFieldErrors({});
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
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle>{t("newTitle")}</DialogTitle>
          <DialogDescription>{t("newSubtitle")}</DialogDescription>
        </DialogHeader>

        <DialogBody className="px-5 py-4">
          <form
            id={formId}
            action={(formData) => {
              if (!validateClient()) return;
              formAction(formData);
            }}
            className="flex flex-col gap-4"
          >
            {defaultVendorId ? (
              <input type="hidden" name="vendorId" value={defaultVendorId} />
            ) : (
              <FormField
                id="modal-vb-vendor"
                label={t("vendor")}
                error={fieldErrors.vendorId}
              >
                <FormSelect
                  id="modal-vb-vendor"
                  name="vendorId"
                  required
                  value={vendorIdValue}
                  onValueChange={(value) => {
                    setValues((prev) => ({
                      ...prev,
                      vendorId: value,
                      purchaseOrderId:
                        prev.purchaseOrderId &&
                        purchaseOrders.some(
                          (po) =>
                            po.id === prev.purchaseOrderId &&
                            po.vendorId === value,
                        )
                          ? prev.purchaseOrderId
                          : "",
                    }));
                    setFieldErrors((prev) => {
                      if (!prev.vendorId && !prev.purchaseOrderId) return prev;
                      const next = { ...prev };
                      delete next.vendorId;
                      delete next.purchaseOrderId;
                      return next;
                    });
                  }}
                  placeholder={t("vendorPlaceholder")}
                  triggerClassName="h-11 min-h-11"
                  options={vendors.map((vendor) => ({
                    value: vendor.id,
                    label: vendor.name,
                  }))}
                />
              </FormField>
            )}
            {purchaseOrders.length > 0 ? (
              <FormField id="modal-vb-po" label={t("purchaseOrder")}>
                <FormSelect
                  id="modal-vb-po"
                  name="purchaseOrderId"
                  value={values.purchaseOrderId ?? ""}
                  onValueChange={onPurchaseOrderChange}
                  placeholder={t("purchaseOrderPlaceholder")}
                  triggerClassName="h-11 min-h-11"
                  options={[
                    { value: "", label: t("purchaseOrderNone") },
                    ...purchaseOrdersForVendor.map((po) => ({
                      value: po.id,
                      label: po.number,
                    })),
                  ]}
                />
              </FormField>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="modal-vb-billNumber" label={t("billNumber")}>
                <Input
                  id="modal-vb-billNumber"
                  name="billNumber"
                  value={values.billNumber}
                  onChange={(e) => setField("billNumber", e.target.value)}
                  className="h-11 min-h-11"
                />
              </FormField>
              <FormField id="modal-vb-billDate" label={t("billDate")}>
                <Input
                  id="modal-vb-billDate"
                  name="billDate"
                  type="date"
                  value={values.billDate}
                  onChange={(e) => setField("billDate", e.target.value)}
                  className="h-11 min-h-11"
                />
              </FormField>
            </div>
            <FormField
              id="modal-vb-amount"
              label={t("amount")}
              error={fieldErrors.amount}
              hint={tc("unitPriceHint")}
            >
              <Input
                id="modal-vb-amount"
                name="amount"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                required
                placeholder={t("amountPlaceholder")}
                value={values.amount ?? ""}
                aria-invalid={Boolean(fieldErrors.amount)}
                className="h-11 min-h-11"
                onBeforeInput={(event) => {
                  const native = event.nativeEvent as InputEvent;
                  const data = native.data;
                  if (data == null || data === "") return;
                  if (!/^[\d.]+$/.test(data)) {
                    event.preventDefault();
                  }
                }}
                onChange={(e) =>
                  setField("amount", sanitizeRupeesTyping(e.target.value))
                }
                onFocus={(event) => {
                  if (isZeroRupeesInput(event.currentTarget.value)) {
                    event.currentTarget.select();
                  }
                }}
              />
            </FormField>
            <FormField id="modal-vb-notes" label={t("notes")}>
              <Textarea
                id="modal-vb-notes"
                name="notes"
                rows={2}
                value={values.notes}
                onChange={(e) => setField("notes", e.target.value)}
              />
            </FormField>

            <FormField id="modal-vb-file" label={t("attachmentLabel")}>
              <input
                ref={fileInputRef}
                id="modal-vb-file"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                disabled={busy}
                onChange={(event) => {
                  const next = event.target.files?.[0] ?? null;
                  pendingFileRef.current = next;
                  setFile(next);
                }}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  disabled={busy}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="size-4" aria-hidden />
                  {file ? t("changeAttachment") : t("uploadAttachment")}
                </Button>
                {file ? (
                  <div className="flex min-h-11 max-w-full items-center gap-2 rounded-md border border-border px-3 text-sm">
                    <span className="truncate">{file.name}</span>
                    <button
                      type="button"
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md hover:bg-muted"
                      aria-label={t("clearAttachment")}
                      onClick={() => {
                        pendingFileRef.current = null;
                        setFile(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }}
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("attachmentOptional")}
                  </p>
                )}
              </div>
            </FormField>
          </form>
        </DialogBody>
        <DialogFooter className="gap-2 border-t border-border bg-background px-5 py-4 sm:justify-end">
          <DialogClose asChild>
            <Button type="button" variant="secondary" size="md" disabled={busy}>
              {t("cancel")}
            </Button>
          </DialogClose>
          <Button type="submit" form={formId} size="md" loading={busy}>
            {busy ? t("saving") : t("create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
