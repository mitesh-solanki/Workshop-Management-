"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import {
  createPurchaseReturnModalAction,
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
import { toastStockError } from "@/components/ui/toast-stock-error";
import { finishCreateModalNavigation } from "@/lib/create-modal-navigation";
import {
  isZeroRupeesInput,
  parseRupeesToPaise,
  sanitizeRupeesTyping,
} from "@/lib/money";

const initial: PurchasesActionState = { ok: false };

type PartOption = { id: string; name: string; sku: string; unit: string };

type FormValues = {
  vendorId: string;
  partId: string;
  vendorBillId: string;
  quantity: string;
  credit: string;
  notes: string;
};

type Props = {
  vendors: { id: string; name: string }[];
  parts: PartOption[];
  bills?: { id: string; label: string; vendorId: string }[];
  defaultVendorId?: string;
  defaultPartId?: string;
  defaultVendorBillId?: string;
  stayAndRefresh?: boolean;
  trigger?: React.ReactNode;
  size?: "sm" | "md";
};

function emptyValues(
  defaultVendorId?: string,
  defaultPartId?: string,
  defaultVendorBillId?: string,
): FormValues {
  return {
    vendorId: defaultVendorId ?? "",
    partId: defaultPartId ?? "",
    vendorBillId: defaultVendorBillId ?? "",
    quantity: "1",
    credit: "",
    notes: "",
  };
}

export function CreatePurchaseReturnModal({
  vendors,
  parts,
  bills = [],
  defaultVendorId,
  defaultPartId,
  defaultVendorBillId,
  stayAndRefresh = false,
  trigger,
  size = "md",
}: Props) {
  const t = useTranslations("purchaseReturns");
  const te = useTranslations("errors");
  const tc = useTranslations("common");
  const ti = useTranslations("inventory");
  const router = useRouter();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(() =>
    emptyValues(defaultVendorId, defaultPartId, defaultVendorBillId),
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [state, formAction, pending] = useActionState(
    createPurchaseReturnModalAction,
    initial,
  );
  const handled = useRef<string | null>(null);
  const refreshedForId = useRef<string | null>(null);

  useEffect(() => {
    if (!state.message || state.message === handled.current) return;
    handled.current = state.message;

    if (state.ok && state.id) {
      const createdId = state.id;
      toast.success(state.message);
      const id = window.setTimeout(() => {
        setValues(
          emptyValues(defaultVendorId, defaultPartId, defaultVendorBillId),
        );
        setFieldErrors({});
        setOpen(false);
        if (stayAndRefresh) {
          if (refreshedForId.current !== createdId) {
            refreshedForId.current = createdId;
            router.refresh();
          }
          return;
        }
        finishCreateModalNavigation({
          kind: "purchase-return",
          recordId: createdId,
          href: `/vendors/${values.vendorId}?section=returns`,
          router,
          close: () => setOpen(false),
        });
      }, 0);
      return () => window.clearTimeout(id);
    }

    toastStockError(state.message, {
      stockPartId: state.stockPartId,
      viewStockLabel: ti("errors.viewStock"),
    });
  }, [
    state,
    router,
    stayAndRefresh,
    defaultVendorId,
    defaultPartId,
    defaultVendorBillId,
    values.vendorId,
    ti,
  ]);

  function setField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function validateClient(): boolean {
    const next: Record<string, string> = {};
    if (!defaultVendorId && !(values.vendorId ?? "").trim()) {
      next.vendorId = te("validation.required");
    }
    if (!values.partId.trim()) {
      next.partId = te("validation.required");
    }
    const qty = Number(values.quantity);
    if (!Number.isInteger(qty) || qty < 1) {
      next.quantity = te("validation.invalidQuantity");
    }
    const creditPaise = parseRupeesToPaise(values.credit);
    if (values.credit.trim() === "" || creditPaise == null) {
      next.credit = te("validation.required");
    } else if (creditPaise < 0) {
      next.credit = te("validation.invalidInput");
    }
    setFieldErrors(next);
    if (Object.keys(next).length === 0) return true;
    const focusId: Record<string, string> = {
      vendorId: "modal-ret-vendor",
      partId: "modal-ret-part",
      quantity: "modal-ret-qty",
      credit: "modal-ret-credit",
    };
    const first = Object.keys(next)[0];
    window.setTimeout(() => {
      document.getElementById(focusId[first] ?? `modal-ret-${first}`)?.focus();
    }, 50);
    return false;
  }

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
        setValues(emptyValues(defaultVendorId, defaultPartId, defaultVendorBillId));
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
                id="modal-ret-vendor"
                label={t("vendor")}
                error={fieldErrors.vendorId}
              >
                <FormSelect
                  id="modal-ret-vendor"
                  name="vendorId"
                  required
                  value={values.vendorId}
                  onValueChange={(value) => setField("vendorId", value)}
                  placeholder={t("vendorPlaceholder")}
                  triggerClassName="h-11 min-h-11"
                  options={vendors.map((vendor) => ({
                    value: vendor.id,
                    label: vendor.name,
                  }))}
                />
              </FormField>
            )}
            <FormField
              id="modal-ret-part"
              label={t("part")}
              error={fieldErrors.partId}
            >
              <FormSelect
                id="modal-ret-part"
                name="partId"
                required
                value={values.partId}
                onValueChange={(value) => setField("partId", value)}
                placeholder={t("partPlaceholder")}
                triggerClassName="h-11 min-h-11"
                options={parts.map((part) => ({
                  value: part.id,
                  label: `${part.name} (${part.sku})`,
                }))}
              />
            </FormField>
            {bills.length > 0 ? (
              <FormField id="modal-ret-bill" label={t("vendorBill")}>
                <FormSelect
                  id="modal-ret-bill"
                  name="vendorBillId"
                  value={values.vendorBillId}
                  onValueChange={(value) => setField("vendorBillId", value)}
                  placeholder={t("vendorBillPlaceholder")}
                  triggerClassName="h-11 min-h-11"
                  options={[
                    { value: "", label: t("vendorBillNone") },
                    ...bills.map((bill) => ({
                      value: bill.id,
                      label: bill.label,
                    })),
                  ]}
                />
              </FormField>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="modal-ret-qty"
                label={t("quantity")}
                error={fieldErrors.quantity}
              >
                <Input
                  id="modal-ret-qty"
                  name="quantity"
                  type="number"
                  min={1}
                  step={1}
                  required
                  value={values.quantity}
                  onChange={(e) => setField("quantity", e.target.value)}
                  aria-invalid={Boolean(fieldErrors.quantity)}
                  className="h-11 min-h-11"
                />
              </FormField>
              <FormField
                id="modal-ret-credit"
                label={t("credit")}
                error={fieldErrors.credit}
                hint={tc("unitPriceHint")}
              >
                <Input
                  id="modal-ret-credit"
                  name="credit"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  required
                  placeholder={t("creditPlaceholder")}
                  value={values.credit}
                  aria-invalid={Boolean(fieldErrors.credit)}
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
                    setField("credit", sanitizeRupeesTyping(e.target.value))
                  }
                  onFocus={(event) => {
                    if (isZeroRupeesInput(event.currentTarget.value)) {
                      event.currentTarget.select();
                    }
                  }}
                />
              </FormField>
            </div>
            <FormField id="modal-ret-notes" label={t("notes")}>
              <Textarea
                id="modal-ret-notes"
                name="notes"
                rows={2}
                value={values.notes}
                onChange={(e) => setField("notes", e.target.value)}
              />
            </FormField>
          </form>
        </DialogBody>
        <DialogFooter className="gap-2 border-t border-border bg-background px-5 py-4 sm:justify-end">
          <DialogClose asChild>
            <Button type="button" variant="secondary" size="md">
              {t("cancel")}
            </Button>
          </DialogClose>
          <Button type="submit" form={formId} size="md" loading={pending}>
            {pending ? t("saving") : t("create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
