"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-select";
import { toast } from "@/components/ui/toast";
import { formatRupees, parseRupeesToPaise } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  createCreditNoteAction,
  type BillingActionState,
} from "@/app/actions/billing";
import { CREDIT_NOTE_REASONS } from "@/modules/billing/schema";
import { GST_RATE_OPTIONS } from "@/modules/estimates/schema";

const initial: BillingActionState = { ok: false };

const controlClass =
  "h-11 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] shadow-xs outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/25";

const labelClass = "mb-1.5 block text-[13px] font-bold text-slate-700";

type LineDraft = {
  key: string;
  description: string;
  quantity: string;
  unitPriceRupees: string;
  gstRatePercent: string;
  hsnOrSac: string;
};

function emptyLine(key: string): LineDraft {
  return {
    key,
    description: "",
    quantity: "1",
    unitPriceRupees: "",
    gstRatePercent: "18",
    hsnOrSac: "998714",
  };
}

function lineTotalPaise(line: LineDraft): number {
  const qty = Number.parseInt(line.quantity, 10);
  const unit = parseRupeesToPaise(line.unitPriceRupees);
  const gst = Number.parseFloat(line.gstRatePercent);
  if (!Number.isFinite(qty) || qty < 1 || unit == null) return 0;
  if (!Number.isFinite(gst) || gst < 0) return 0;
  const taxable = unit * qty;
  const tax = Math.round((taxable * gst) / 100);
  return taxable + tax;
}

type Props = {
  invoiceId: string;
  orderId: string;
};

export function CreditNoteForm({ invoiceId, orderId }: Props) {
  const t = useTranslations("billing");
  const idPrefix = useId();
  const bound = createCreditNoteAction.bind(null, orderId, invoiceId);
  const [state, formAction, pending] = useActionState(bound, initial);
  const handledMessage = useRef<string | null>(null);
  const [lineSeq, setLineSeq] = useState(1);
  const [lines, setLines] = useState<LineDraft[]>(() => [
    emptyLine(`${idPrefix}-0`),
  ]);

  const creditTotalPaise = lines.reduce(
    (sum, line) => sum + lineTotalPaise(line),
    0,
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
    } else {
      toast.error(state.message);
    }
  }, [state, t]);

  function updateLine(key: string, patch: Partial<LineDraft>) {
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
        <div className="min-w-0 sm:col-span-4">
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
        <div className="min-w-0 sm:col-span-8">
          <label htmlFor={`${idPrefix}-notes`} className={labelClass}>
            {t("notes")}
          </label>
          <input
            id={`${idPrefix}-notes`}
            name="notes"
            className={controlClass}
            placeholder={t("notesPlaceholder")}
          />
        </div>
      </div>

      <div className="space-y-3">
        {lines.map((line, index) => {
          const total = lineTotalPaise(line);
          return (
            <div
              key={line.key}
              className="overflow-hidden rounded-[13px] border border-[#cfdcf1] bg-white shadow-[0_3px_17px_rgba(36,58,99,0.04)]"
            >
              <div className="flex items-center justify-between gap-2 border-b border-[#d8e4f5] bg-[#f4f8ff] px-4 py-3">
                <strong className="text-[13px] font-semibold text-slate-900">
                  {t("creditNoteLine", { n: index + 1 })}
                </strong>
                {lines.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-11 gap-1.5 text-slate-600 hover:text-red-700"
                    onClick={() =>
                      setLines((prev) =>
                        prev.filter((row) => row.key !== line.key),
                      )
                    }
                  >
                    <Trash2 className="size-4" aria-hidden />
                    {t("removeLine")}
                  </Button>
                ) : null}
              </div>

              <div className="space-y-3 bg-[#fafcff] px-4 py-4">
                <div>
                  <label
                    htmlFor={`description-${line.key}`}
                    className={labelClass}
                  >
                    {t("lineDescription")}
                  </label>
                  <input
                    id={`description-${line.key}`}
                    name="description"
                    required
                    value={line.description}
                    onChange={(e) =>
                      updateLine(line.key, { description: e.target.value })
                    }
                    className={controlClass}
                    placeholder={t("lineDescriptionPlaceholder")}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-12">
                  <div className="min-w-0 sm:col-span-2">
                    <label
                      htmlFor={`quantity-${line.key}`}
                      className={labelClass}
                    >
                      {t("quantity")}
                    </label>
                    <input
                      id={`quantity-${line.key}`}
                      name="quantity"
                      type="number"
                      min={1}
                      required
                      value={line.quantity}
                      onChange={(e) =>
                        updateLine(line.key, { quantity: e.target.value })
                      }
                      className={cn(controlClass, "tabular-nums")}
                    />
                  </div>
                  <div className="min-w-0 sm:col-span-3">
                    <label
                      htmlFor={`unitPriceRupees-${line.key}`}
                      className={labelClass}
                    >
                      {t("unitPrice")}
                    </label>
                    <input
                      id={`unitPriceRupees-${line.key}`}
                      name="unitPriceRupees"
                      required
                      value={line.unitPriceRupees}
                      onChange={(e) =>
                        updateLine(line.key, {
                          unitPriceRupees: e.target.value,
                        })
                      }
                      className={cn(controlClass, "tabular-nums")}
                      inputMode="decimal"
                      placeholder="0"
                    />
                  </div>
                  <div className="min-w-0 sm:col-span-2">
                    <label
                      htmlFor={`gstRatePercent-${line.key}`}
                      className={labelClass}
                    >
                      {t("gstRate")}
                    </label>
                    <FormSelect
                      id={`gstRatePercent-${line.key}`}
                      name="gstRatePercent"
                      required
                      value={line.gstRatePercent}
                      onValueChange={(value) =>
                        updateLine(line.key, {
                          gstRatePercent: value,
                        })
                      }
                      options={GST_RATE_OPTIONS.map((rate) => ({
                        value: String(rate),
                        label: `${rate}%`,
                      }))}
                    />
                  </div>
                  <div className="min-w-0 col-span-2 sm:col-span-3">
                    <label
                      htmlFor={`hsnOrSac-${line.key}`}
                      className={labelClass}
                    >
                      {t("hsnOrSac")}
                    </label>
                    <input
                      id={`hsnOrSac-${line.key}`}
                      name="hsnOrSac"
                      required
                      value={line.hsnOrSac}
                      onChange={(e) =>
                        updateLine(line.key, { hsnOrSac: e.target.value })
                      }
                      className={cn(controlClass, "tabular-nums")}
                    />
                  </div>
                  <div className="col-span-2 flex min-w-0 flex-col justify-end sm:col-span-2">
                    <span className={labelClass}>{t("lineTotal")}</span>
                    <p className="flex h-11 items-center text-[15px] font-bold tabular-nums text-slate-900">
                      {formatRupees(total)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 gap-1.5 border-slate-300 bg-white text-[14px] font-semibold text-slate-800"
          onClick={() => {
            const next = lineSeq;
            setLineSeq((n) => n + 1);
            setLines((prev) => [...prev, emptyLine(`${idPrefix}-${next}`)]);
          }}
        >
          <Plus className="size-4" strokeWidth={2.5} aria-hidden />
          {t("addCreditNoteLine")}
        </Button>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="text-right">
            <p className="text-[13px] font-bold text-slate-500">
              {t("creditNoteTotal")}
            </p>
            <p className="text-[18px] font-bold tabular-nums text-slate-900">
              {formatRupees(creditTotalPaise)}
            </p>
          </div>
          <Button
            type="submit"
            size="md"
            loading={pending}
            className="min-h-11 shrink-0 bg-blue-600 px-4 text-[14px] font-bold text-white hover:bg-blue-700"
          >
            {pending ? t("saving") : t("saveCreditNote")}
          </Button>
        </div>
      </div>

      {state.message && !state.ok ? (
        <p className="text-[13px] text-danger" role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
