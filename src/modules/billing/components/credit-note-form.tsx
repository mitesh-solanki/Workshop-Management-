"use client";

import {
  useActionState,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-select";
import { toast } from "@/components/ui/toast";
import { sumLineGstSplit } from "@/lib/gst";
import {
  formatRupees,
  normalizeRupeesInput,
  parseRupeesToPaise,
  sanitizeRupeesTyping,
} from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  createCreditNoteAction,
  type BillingActionState,
} from "@/app/actions/billing";
import { CREDIT_NOTE_REASONS } from "@/modules/billing/schema";

const initial: BillingActionState = { ok: false };

const controlClass =
  "h-11 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] shadow-xs outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/25";

const amountControlClass =
  "h-12 min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-[16px] font-semibold shadow-xs outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/25";

const labelClass = "mb-1.5 block text-[13px] font-bold text-slate-700";

const actionBtnClass =
  "inline-flex size-11 min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-300 bg-white p-0 leading-none shadow-xs [&_svg]:size-5 [&_svg]:shrink-0";

const DEFAULT_GST = "18";
const DEFAULT_HSN = "998714";

const lineGridClass =
  "grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_minmax(6.5rem,auto)] sm:items-center sm:gap-3";

type LineDraft = {
  key: string;
  description: string;
  amountRupees: string;
};

function emptyLine(key: string): LineDraft {
  return {
    key,
    description: "",
    amountRupees: "",
  };
}

type Props = {
  invoiceId: string;
  orderId: string;
  gstSplit: "CGST_SGST" | "IGST";
};

export function CreditNoteForm({ invoiceId, orderId, gstSplit }: Props) {
  const t = useTranslations("billing");
  const idPrefix = useId();
  const firstKey = `${idPrefix}-0`;
  const bound = useMemo(
    () => createCreditNoteAction.bind(null, orderId, invoiceId),
    [orderId, invoiceId],
  );
  const linesRef = useRef<LineDraft[]>([]);
  const handledMessage = useRef<string | null>(null);
  const [lineSeq, setLineSeq] = useState(1);
  const [lines, setLines] = useState<LineDraft[]>(() => [
    emptyLine(firstKey),
  ]);
  const [editingKey, setEditingKey] = useState<string | null>(firstKey);
  const [draftDescription, setDraftDescription] = useState("");
  const [draftAmount, setDraftAmount] = useState("");
  linesRef.current = lines;

  const wrapped = useMemo(() => {
    return async (
      prev: BillingActionState,
      formData: FormData,
    ): Promise<BillingActionState> => {
      const currentLines = linesRef.current;
      const hasZeroAmount = currentLines.some((line) => {
        if (line.description.trim().length === 0) return false;
        const unit = parseRupeesToPaise(line.amountRupees);
        return unit == null || unit <= 0;
      });
      if (hasZeroAmount) {
        return { ok: false, message: t("errors.creditNoteAmountRequired") };
      }
      const filled = currentLines.filter((line) => {
        if (line.description.trim().length === 0) return false;
        const unit = parseRupeesToPaise(line.amountRupees);
        return unit != null && unit > 0;
      });
      if (filled.length === 0) {
        return { ok: false, message: t("errors.creditNoteNeedItem") };
      }
      const clean = new FormData();
      clean.set("reason", String(formData.get("reason") ?? "CORRECTION"));
      for (const line of filled) {
        clean.append("description", line.description.trim());
        clean.append("quantity", "1");
        clean.append("unitPriceRupees", line.amountRupees);
        clean.append("gstRatePercent", DEFAULT_GST);
        clean.append("hsnOrSac", DEFAULT_HSN);
      }
      return bound(prev, clean);
    };
  }, [bound, t]);
  const [state, formAction, pending] = useActionState(wrapped, initial);

  const sameState = gstSplit === "CGST_SGST";
  const creditTotals = useMemo(
    () =>
      sumLineGstSplit(
        lines
          .map((line) => {
            const unitPricePaise = parseRupeesToPaise(line.amountRupees);
            if (unitPricePaise == null || unitPricePaise <= 0) return null;
            return {
              quantity: 1,
              unitPricePaise,
              gstRatePercent: Number(DEFAULT_GST),
            };
          })
          .filter(
            (line): line is {
              quantity: number;
              unitPricePaise: number;
              gstRatePercent: number;
            } => line != null,
          ),
        sameState,
      ),
    [lines, sameState],
  );

  useEffect(() => {
    if (!state.message || state.message === handledMessage.current) return;
    handledMessage.current = state.message;
    if (state.ok) {
      toast.success(
        state.message === "creditNoteCreated"
          ? t("creditNoteCreated")
          : state.message,
      );
      const resetKey = `${idPrefix}-0`;
      setLineSeq(1);
      setLines([emptyLine(resetKey)]);
      setEditingKey(resetKey);
      setDraftDescription("");
      setDraftAmount("");
    } else {
      toast.error(state.message);
    }
  }, [state, t, idPrefix]);

  function beginEdit(line: LineDraft) {
    setEditingKey(line.key);
    setDraftDescription(line.description);
    setDraftAmount(line.amountRupees);
  }

  function cancelEdit() {
    const current = lines.find((line) => line.key === editingKey);
    if (
      current &&
      !current.description.trim() &&
      !current.amountRupees.trim() &&
      lines.length > 1
    ) {
      removeLine(current.key);
      return;
    }
    setEditingKey(null);
    setDraftDescription("");
    setDraftAmount("");
  }

  function saveEdit(key: string) {
    const description = draftDescription.trim();
    const amount = normalizeRupeesInput(draftAmount);
    const amountPaise = parseRupeesToPaise(amount);
    if (!description) {
      toast.error(t("errors.creditNoteNeedItem"));
      return;
    }
    if (amountPaise == null || amountPaise <= 0) {
      toast.error(t("errors.creditNoteAmountRequired"));
      return;
    }
    setLines((prev) =>
      prev.map((line) =>
        line.key === key
          ? { ...line, description, amountRupees: amount }
          : line,
      ),
    );
    setEditingKey(null);
    setDraftDescription("");
    setDraftAmount("");
  }

  function removeLine(key: string) {
    setLines((prev) => {
      const next = prev.filter((row) => row.key !== key);
      if (next.length === 0) {
        const resetKey = `${idPrefix}-${lineSeq}`;
        setLineSeq((n) => n + 1);
        setEditingKey(resetKey);
        setDraftDescription("");
        setDraftAmount("");
        return [emptyLine(resetKey)];
      }
      if (editingKey === key) {
        setEditingKey(null);
        setDraftDescription("");
        setDraftAmount("");
      }
      return next;
    });
  }

  function addLine() {
    if (editingKey) {
      toast.error(t("creditNoteFinishEditFirst"));
      return;
    }
    const nextKey = `${idPrefix}-${lineSeq}`;
    setLineSeq((n) => n + 1);
    setLines((prev) => [...prev, emptyLine(nextKey)]);
    setEditingKey(nextKey);
    setDraftDescription("");
    setDraftAmount("");
  }

  return (
    <form action={formAction} className="max-w-2xl space-y-4">
      <p className="text-[13px] text-slate-500">{t("creditNoteSimpleHint")}</p>

      <div className="max-w-sm">
        <label htmlFor={`${idPrefix}-reason`} className={labelClass}>
          {t("creditNoteReason")}
        </label>
        <FormSelect
          id={`${idPrefix}-reason`}
          name="reason"
          defaultValue="CORRECTION"
          options={CREDIT_NOTE_REASONS.map((reason) => ({
            value: reason,
            label: t(`reasons.${reason}`),
          }))}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div
          className={cn(
            lineGridClass,
            "hidden border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-[12px] font-bold tracking-wide text-slate-500 uppercase sm:grid",
          )}
        >
          <span>{t("lineDescription")}</span>
          <span className="text-center">{t("amount")}</span>
          <span className="text-right">{t("actions")}</span>
        </div>

        <ul className="divide-y divide-slate-100">
          {lines.map((line) => {
            const editing = editingKey === line.key;
            const amountPaise = parseRupeesToPaise(line.amountRupees) ?? 0;
            return (
              <li key={line.key} className="px-3 py-3">
                {editing ? (
                  <div className={cn(lineGridClass, "sm:items-end")}>
                    <div className="min-w-0">
                      <label className="mb-1.5 block text-[13px] font-bold text-slate-700 sm:sr-only">
                        {t("lineDescription")}
                      </label>
                      <input
                        className={controlClass}
                        value={draftDescription}
                        onChange={(event) =>
                          setDraftDescription(event.target.value)
                        }
                        placeholder={t("lineDescriptionPlaceholder")}
                      />
                    </div>
                    <div className="min-w-0">
                      <label className="mb-1.5 block text-[13px] font-bold text-slate-700 sm:sr-only">
                        {t("amount")}
                      </label>
                      <input
                        className={cn(
                          amountControlClass,
                          "tabular-nums sm:text-center",
                        )}
                        value={draftAmount}
                        onChange={(event) =>
                          setDraftAmount(
                            sanitizeRupeesTyping(event.target.value),
                          )
                        }
                        inputMode="decimal"
                        placeholder="0"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className={cn(
                          actionBtnClass,
                          "text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800",
                        )}
                        aria-label={t("saveCreditNoteLine")}
                        title={t("saveCreditNoteLine")}
                        onClick={() => saveEdit(line.key)}
                      >
                        <Check className="size-5" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
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
                ) : (
                  <div className={lineGridClass}>
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold text-slate-500 sm:hidden">
                        {t("lineDescription")}
                      </p>
                      <p className="text-[14px] font-semibold text-slate-900">
                        {line.description || t("creditNoteEmptyLine")}
                      </p>
                    </div>
                    <div className="sm:text-center">
                      <p className="text-[12px] font-bold text-slate-500 sm:hidden">
                        {t("amount")}
                      </p>
                      <p className="text-[16px] font-bold tabular-nums text-slate-900">
                        {formatRupees(amountPaise)}
                      </p>
                    </div>
                    <div className="flex items-center justify-end gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className={cn(
                          actionBtnClass,
                          "text-blue-700 hover:border-blue-300 hover:bg-blue-50",
                        )}
                        aria-label={t("editCreditNoteLine")}
                        title={t("editCreditNoteLine")}
                        disabled={editingKey != null}
                        onClick={() => beginEdit(line)}
                      >
                        <Pencil className="size-5" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className={cn(
                          actionBtnClass,
                          "text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700",
                        )}
                        aria-label={t("removeLine")}
                        title={t("removeLine")}
                        disabled={editingKey != null}
                        onClick={() => removeLine(line.key)}
                      >
                        <Trash2 className="size-5" aria-hidden />
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <dl className="flex flex-wrap items-start gap-x-6 gap-y-3 border-t border-slate-200 bg-slate-50 px-3 py-3.5 sm:flex-nowrap sm:justify-between">
          <div>
            <dt className="text-[13px] text-slate-500">{t("taxable")}</dt>
            <dd className="mt-0.5 text-[14px] font-semibold tabular-nums text-slate-900">
              {formatRupees(creditTotals.taxablePaise)}
            </dd>
          </div>
          {gstSplit === "CGST_SGST" ? (
            <>
              <div>
                <dt className="text-[13px] text-slate-500">{t("cgst")}</dt>
                <dd className="mt-0.5 text-[14px] font-semibold tabular-nums text-slate-900">
                  {formatRupees(creditTotals.cgstPaise)}
                </dd>
              </div>
              <div>
                <dt className="text-[13px] text-slate-500">{t("sgst")}</dt>
                <dd className="mt-0.5 text-[14px] font-semibold tabular-nums text-slate-900">
                  {formatRupees(creditTotals.sgstPaise)}
                </dd>
              </div>
            </>
          ) : (
            <div>
              <dt className="text-[13px] text-slate-500">{t("igst")}</dt>
              <dd className="mt-0.5 text-[14px] font-semibold tabular-nums text-slate-900">
                {formatRupees(creditTotals.igstPaise)}
              </dd>
            </div>
          )}
          <div className="sm:ml-auto sm:text-right">
            <dt className="text-[13px] text-slate-500">{t("paperTotal")}</dt>
            <dd className="mt-0.5 text-[18px] font-bold tabular-nums text-blue-700">
              {formatRupees(creditTotals.totalPaise)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 gap-1.5 border-slate-300 bg-white text-[14px] font-semibold text-slate-800"
          onClick={addLine}
        >
          <Plus className="size-4" strokeWidth={2.5} aria-hidden />
          {t("addCreditNoteLine")}
        </Button>
        <Button
          type="submit"
          size="md"
          loading={pending}
          disabled={editingKey != null}
          className="min-h-11 shrink-0 bg-blue-600 px-4 text-[14px] font-bold text-white hover:bg-blue-700"
        >
          {pending ? t("saving") : t("saveCreditNote")}
        </Button>
      </div>

      {state.message && !state.ok ? (
        <p className="text-[13px] text-danger" role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
