"use client";

import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Banknote } from "lucide-react";
import {
  recordVendorPaymentModalAction,
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
import {
  formatRupees,
  isZeroRupeesInput,
  parseRupeesToPaise,
  sanitizeRupeesTyping,
} from "@/lib/money";

const initial: PurchasesActionState = { ok: false };

type FormValues = {
  amount: string;
  method: string;
  notes: string;
};

type Props = {
  vendorBillId: string;
  billLabel: string;
  outstandingPaise: number;
  trigger?: React.ReactNode;
};

export function RecordPaymentModal({
  vendorBillId,
  billLabel,
  outstandingPaise,
  trigger,
}: Props) {
  const t = useTranslations("vendorBills");
  const te = useTranslations("errors");
  const tc = useTranslations("common");
  const formId = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<FormValues>({
    amount: "",
    method: "CASH",
    notes: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const bound = useMemo(
    () => recordVendorPaymentModalAction.bind(null, vendorBillId),
    [vendorBillId],
  );
  const [state, formAction, pending] = useActionState(bound, initial);
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!state.message || state.message === handled.current) return;
    handled.current = state.message;

    if (state.ok) {
      toast.success(state.message);
      router.refresh();
      const id = window.setTimeout(() => {
        setValues({ amount: "", method: "CASH", notes: "" });
        setFieldErrors({});
        setOpen(false);
      }, 0);
      return () => window.clearTimeout(id);
    }

    toast.error(state.message);
  }, [state, router]);

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
    const amountPaise = parseRupeesToPaise(values.amount);
    if (isZeroRupeesInput(values.amount) || amountPaise == null) {
      next.amount = te("validation.required");
    } else if (amountPaise <= 0) {
      next.amount = te("validation.invalidInput");
    }
    setFieldErrors(next);
    if (Object.keys(next).length === 0) return true;
    window.setTimeout(() => {
      document.getElementById("modal-pay-amount")?.focus();
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
        setValues({ amount: "", method: "CASH", notes: "" });
        setFieldErrors({});
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" size="md" disabled={outstandingPaise <= 0}>
            <Banknote className="size-4" aria-hidden />
            {t("recordPayment")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle>{t("paymentTitle")}</DialogTitle>
          <DialogDescription>
            {billLabel} · {t("outstanding")}: {formatRupees(outstandingPaise)}
          </DialogDescription>
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
            <FormField
              id="modal-pay-amount"
              label={t("amount")}
              error={fieldErrors.amount}
              hint={tc("unitPriceHint")}
            >
              <Input
                id="modal-pay-amount"
                name="amount"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                required
                placeholder={t("amountPlaceholder")}
                value={values.amount}
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
            <FormField id="modal-pay-method" label={t("method")}>
              <FormSelect
                id="modal-pay-method"
                name="method"
                value={values.method}
                onValueChange={(value) => setField("method", value)}
                triggerClassName="h-11 min-h-11"
                options={[
                  { value: "CASH", label: t("methods.CASH") },
                  { value: "UPI", label: t("methods.UPI") },
                  { value: "BANK", label: t("methods.BANK") },
                  { value: "CARD", label: t("methods.CARD") },
                  { value: "OTHER", label: t("methods.OTHER") },
                ]}
              />
            </FormField>
            <FormField id="modal-pay-notes" label={t("notes")}>
              <Textarea
                id="modal-pay-notes"
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
            {pending ? t("saving") : t("recordPayment")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
