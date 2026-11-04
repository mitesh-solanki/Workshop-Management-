"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-select";
import { toast } from "@/components/ui/toast";
import {
  formatRupees,
  parseRupeesToPaise,
  paiseToRupeesInput,
  sanitizeRupeesTyping,
} from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  deletePaymentAction,
  updatePaymentAction,
} from "@/app/actions/billing";
import {
  PAYMENT_METHODS,
  type PaymentMethodValue,
} from "@/modules/billing/schema";

const actionBtnClass =
  "inline-flex size-11 min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-300 bg-white p-0 leading-none shadow-xs [&_svg]:size-5 [&_svg]:shrink-0";

const controlClass =
  "h-11 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] shadow-xs outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/25";

type PaymentRow = {
  id: string;
  method: string;
  amountPaise: number;
  isRefund: boolean;
  cashPaise: number;
  upiPaise: number;
  cardPaise: number;
  provider: string;
  status: string;
};

type Props = {
  orderId: string;
  invoiceId: string;
  canEdit: boolean;
  pendingPaise: number;
  payments: PaymentRow[];
};

function methodLabel(
  method: string,
  t: (key: `methods.${"CASH" | "UPI" | "CARD" | "MIXED"}`) => string,
) {
  if (
    method === "CASH" ||
    method === "UPI" ||
    method === "CARD" ||
    method === "MIXED"
  ) {
    return t(`methods.${method}`);
  }
  return method;
}

function isManualPaid(payment: PaymentRow) {
  return payment.provider === "NONE" && payment.status === "PAID";
}

function toMethod(value: string): PaymentMethodValue {
  if (
    value === "CASH" ||
    value === "UPI" ||
    value === "CARD" ||
    value === "MIXED"
  ) {
    return value;
  }
  return "CASH";
}

function clampRupeesToMax(raw: string, maxPaise: number): string {
  const sanitized = sanitizeRupeesTyping(raw);
  const paise = parseRupeesToPaise(sanitized);
  if (paise == null) return sanitized;
  if (paise > maxPaise) return paiseToRupeesInput(maxPaise);
  return sanitized;
}

export function PaymentHistoryList({
  orderId,
  invoiceId,
  canEdit,
  pendingPaise,
  payments,
}: Props) {
  const t = useTranslations("billing");
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMethod, setEditMethod] = useState<PaymentMethodValue>("UPI");
  const [editAmount, setEditAmount] = useState("");
  const [editCash, setEditCash] = useState("");
  const [editUpi, setEditUpi] = useState("");
  const [editCard, setEditCard] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<PaymentRow | null>(null);
  const [deletePending, startDelete] = useTransition();

  if (payments.length === 0) {
    return null;
  }

  function beginEdit(payment: PaymentRow) {
    setEditingId(payment.id);
    setEditMethod(toMethod(payment.method));
    setEditAmount(paiseToRupeesInput(payment.amountPaise));
    setEditCash(
      payment.cashPaise > 0 ? paiseToRupeesInput(payment.cashPaise) : "",
    );
    setEditUpi(
      payment.upiPaise > 0 ? paiseToRupeesInput(payment.upiPaise) : "",
    );
    setEditCard(
      payment.cardPaise > 0 ? paiseToRupeesInput(payment.cardPaise) : "",
    );
  }

  function cancelEdit() {
    setEditingId(null);
    setSaving(false);
  }

  function maxForPayment(payment: PaymentRow) {
    return pendingPaise + payment.amountPaise;
  }

  async function saveEdit(payment: PaymentRow) {
    if (saving) return;
    const maxPaise = maxForPayment(payment);
    const amountPaise = parseRupeesToPaise(editAmount);
    if (amountPaise == null || amountPaise <= 0) {
      toast.error(t("errors.paymentAmountRequired"));
      return;
    }
    if (amountPaise > maxPaise) {
      toast.error(
        t("errors.paymentExceedsBalance", {
          pending: formatRupees(maxPaise),
        }),
      );
      return;
    }

    setSaving(true);
    const formData = new FormData();
    formData.set("method", editMethod);
    formData.set("amountRupees", editAmount);
    if (editMethod === "MIXED") {
      formData.set("cashRupees", editCash || "0");
      formData.set("upiRupees", editUpi || "0");
      formData.set("cardRupees", editCard || "0");
    } else if (editMethod === "CASH") {
      formData.set("cashRupees", editAmount);
    } else if (editMethod === "UPI") {
      formData.set("upiRupees", editAmount);
    } else {
      formData.set("cardRupees", editAmount);
    }

    try {
      const result = await updatePaymentAction(
        orderId,
        invoiceId,
        payment.id,
        { ok: false },
        formData,
      );
      if (!result.ok) {
        toast.error(result.message ?? t("errors.paymentFailed"));
        return;
      }
      toast.success(t("paymentUpdated"));
      setEditingId(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function onDeleteConfirm() {
    if (!deleting) return;
    startDelete(async () => {
      const result = await deletePaymentAction(
        orderId,
        invoiceId,
        deleting.id,
      );
      if (!result.ok) {
        toast.error(result.message ?? t("deletePayment"));
        return;
      }
      setDeleting(null);
      if (editingId === deleting.id) setEditingId(null);
      toast.success(t("paymentDeleted"));
      router.refresh();
    });
  }

  function onMixedPartChange(
    payment: PaymentRow,
    part: "cash" | "upi" | "card",
    raw: string,
  ) {
    const maxPaise = maxForPayment(payment);
    const otherCash = part === "cash" ? 0 : (parseRupeesToPaise(editCash) ?? 0);
    const otherUpi = part === "upi" ? 0 : (parseRupeesToPaise(editUpi) ?? 0);
    const otherCard = part === "card" ? 0 : (parseRupeesToPaise(editCard) ?? 0);
    const maxForPart = Math.max(0, maxPaise - otherCash - otherUpi - otherCard);
    const clamped = clampRupeesToMax(raw, maxForPart);
    const nextCash = part === "cash" ? clamped : editCash;
    const nextUpi = part === "upi" ? clamped : editUpi;
    const nextCard = part === "card" ? clamped : editCard;
    if (part === "cash") setEditCash(clamped);
    if (part === "upi") setEditUpi(clamped);
    if (part === "card") setEditCard(clamped);
    const total =
      (parseRupeesToPaise(nextCash) ?? 0) +
      (parseRupeesToPaise(nextUpi) ?? 0) +
      (parseRupeesToPaise(nextCard) ?? 0);
    setEditAmount(paiseToRupeesInput(Math.min(total, maxPaise)));
  }

  return (
    <div className="space-y-2">
      <p className="text-[13px] font-bold text-slate-700">
        {t("paymentHistoryTitle")}
      </p>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="hidden grid-cols-[minmax(0,1fr)_10rem_6.5rem] gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-[12px] font-bold tracking-wide text-slate-500 uppercase sm:grid">
          <span>{t("paymentMethod")}</span>
          <span className="text-center">{t("amount")}</span>
          <span className="text-right">{t("actions")}</span>
        </div>

        <ul className="divide-y divide-slate-100">
          {payments.map((payment) => {
            const editing = editingId === payment.id;
            const canManage =
              canEdit && isManualPaid(payment) && !payment.isRefund;
            const canRemove = canEdit && isManualPaid(payment);
            const maxPaise = maxForPayment(payment);

            return (
              <li key={payment.id} className="px-3 py-3">
                {editing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_6.5rem] sm:items-end">
                      <div className="min-w-0">
                        <label className="mb-1.5 block text-[13px] font-bold text-slate-700 sm:sr-only">
                          {t("paymentMethod")}
                        </label>
                        <FormSelect
                          id={`pay-method-${payment.id}`}
                          value={editMethod}
                          onValueChange={(value) =>
                            setEditMethod(value as PaymentMethodValue)
                          }
                          options={PAYMENT_METHODS.map((value) => ({
                            value,
                            label: t(`methods.${value}`),
                          }))}
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="mb-1.5 block text-[13px] font-bold text-slate-700 sm:sr-only">
                          {t("amount")}
                        </label>
                        <input
                          className={cn(
                            controlClass,
                            "h-12 min-h-12 text-[16px] font-semibold tabular-nums sm:text-center",
                          )}
                          value={editAmount}
                          onChange={(event) =>
                            setEditAmount(
                              clampRupeesToMax(event.target.value, maxPaise),
                            )
                          }
                          inputMode="decimal"
                          disabled={editMethod === "MIXED"}
                        />
                      </div>
                      <div className="flex items-center justify-end gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          loading={saving}
                          className={cn(
                            actionBtnClass,
                            "text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800",
                          )}
                          aria-label={t("savePaymentChanges")}
                          title={t("savePaymentChanges")}
                          onClick={() => void saveEdit(payment)}
                        >
                          <Check className="size-5" aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          disabled={saving}
                          className={cn(
                            actionBtnClass,
                            "text-slate-700 hover:bg-slate-50",
                          )}
                          aria-label={t("cancelEditPayment")}
                          title={t("cancelEditPayment")}
                          onClick={cancelEdit}
                        >
                          <X className="size-5" aria-hidden />
                        </Button>
                      </div>
                    </div>
                    {editMethod === "MIXED" ? (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div>
                          <label className="mb-1.5 block text-[13px] font-bold text-slate-700">
                            {t("methods.CASH")}
                          </label>
                          <input
                            className={cn(controlClass, "tabular-nums")}
                            value={editCash}
                            onChange={(event) =>
                              onMixedPartChange(
                                payment,
                                "cash",
                                event.target.value,
                              )
                            }
                            inputMode="decimal"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-[13px] font-bold text-slate-700">
                            {t("methods.UPI")}
                          </label>
                          <input
                            className={cn(controlClass, "tabular-nums")}
                            value={editUpi}
                            onChange={(event) =>
                              onMixedPartChange(
                                payment,
                                "upi",
                                event.target.value,
                              )
                            }
                            inputMode="decimal"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-[13px] font-bold text-slate-700">
                            {t("methods.CARD")}
                          </label>
                          <input
                            className={cn(controlClass, "tabular-nums")}
                            value={editCard}
                            onChange={(event) =>
                              onMixedPartChange(
                                payment,
                                "card",
                                event.target.value,
                              )
                            }
                            inputMode="decimal"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_6.5rem] sm:items-center sm:gap-3">
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold text-slate-500 sm:hidden">
                        {t("paymentMethod")}
                      </p>
                      <p className="text-[14px] font-semibold text-slate-900">
                        {payment.isRefund
                          ? t("refundPaymentLabel")
                          : methodLabel(payment.method, t)}
                      </p>
                      {payment.isRefund ? (
                        <p className="text-[12px] text-slate-500">
                          {methodLabel(payment.method, t)}
                        </p>
                      ) : null}
                    </div>
                    <div className="sm:text-center">
                      <p className="text-[12px] font-bold text-slate-500 sm:hidden">
                        {t("amount")}
                      </p>
                      <p className="text-[16px] font-bold tabular-nums text-slate-900">
                        {formatRupees(payment.amountPaise)}
                      </p>
                    </div>
                    <div className="flex items-center justify-end gap-3">
                      {canManage ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className={cn(
                            actionBtnClass,
                            "text-blue-700 hover:border-blue-300 hover:bg-blue-50",
                          )}
                          aria-label={t("editPayment")}
                          title={t("editPayment")}
                          onClick={() => beginEdit(payment)}
                        >
                          <Pencil className="size-5" aria-hidden />
                        </Button>
                      ) : null}
                      {canRemove ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className={cn(
                            actionBtnClass,
                            "text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700",
                          )}
                          aria-label={t("deletePayment")}
                          title={t("deletePayment")}
                          onClick={() => setDeleting(payment)}
                        >
                          <Trash2 className="size-5" aria-hidden />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <ConfirmDialog
        open={deleting != null}
        onOpenChange={(next) => {
          if (deletePending && !next) return;
          if (!next) setDeleting(null);
        }}
        title={t("deletePaymentTitle")}
        description={t("deletePaymentConfirm")}
        confirmLabel={t("deletePayment")}
        variant="danger"
        loading={deletePending && deleting != null}
        onConfirm={onDeleteConfirm}
      />
    </div>
  );
}
