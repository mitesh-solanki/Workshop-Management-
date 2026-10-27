"use client";

import {
  useActionState,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-select";
import { SmoothAccordion } from "@/components/ui/smooth-accordion";
import { toast } from "@/components/ui/toast";
import { formatRupees, parseRupeesToPaise } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  createCreditNoteAction,
  type BillingActionState,
} from "@/app/actions/billing";
import { CREDIT_NOTE_REASONS } from "@/modules/billing/schema";
import { GST_RATE_OPTIONS } from "@/modules/estimates/schema";
import { QuantityStepper } from "@/modules/inventory/components/quantity-stepper";

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
  const [openKey, setOpenKey] = useState<string | null>(null);
  linesRef.current = lines;

  const wrapped = useMemo(() => {
    return async (
      prev: BillingActionState,
      formData: FormData,
    ): Promise<BillingActionState> => {
      const filled = linesRef.current.filter((line) => {
        if (line.description.trim().length === 0) return false;
        const unit = parseRupeesToPaise(line.unitPriceRupees);
        return unit != null && unit > 0;
      });
      if (filled.length === 0) {
        return { ok: false, message: t("errors.creditNoteNeedItem") };
      }
      const clean = new FormData();
      clean.set("reason", String(formData.get("reason") ?? "CORRECTION"));
      clean.set("notes", String(formData.get("notes") ?? ""));
      for (const line of filled) {
        clean.append("description", line.description.trim());
        clean.append("quantity", line.quantity || "1");
        clean.append("unitPriceRupees", line.unitPriceRupees);
        clean.append("gstRatePercent", line.gstRatePercent || "18");
        clean.append("hsnOrSac", line.hsnOrSac.trim() || "998714");
      }
      return bound(prev, clean);
    };
  }, [bound, t]);
  const [state, formAction, pending] = useActionState(wrapped, initial);

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
      const resetKey = `${idPrefix}-0`;
      setLineSeq(1);
      setLines([emptyLine(resetKey)]);
      setOpenKey(null);
    } else {
      toast.error(state.message);
    }
  }, [state, t, idPrefix]);

  function updateLine(key: string, patch: Partial<LineDraft>) {
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function removeLine(key: string) {
    setLines((prev) => {
      const next = prev.filter((row) => row.key !== key);
      if (openKey === key) {
        setOpenKey(next[next.length - 1]?.key ?? null);
      }
      return next;
    });
  }

  function addLine() {
    const unfinished = lines.find((line) => line.description.trim().length === 0);
    if (unfinished) {
      setOpenKey(unfinished.key);
      return;
    }
    const nextKey = `${idPrefix}-${lineSeq}`;
    setLineSeq((n) => n + 1);
    setLines((prev) => [...prev, emptyLine(nextKey)]);
    setOpenKey(nextKey);
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
          const open = openKey === line.key;
          const summary =
            line.description.trim() ||
            formatRupees(total);

          return (
            <div
              key={line.key}
              className="overflow-hidden rounded-[13px] border border-[#cfdcf1] bg-white shadow-[0_3px_17px_rgba(36,58,99,0.04)]"
            >
              <div className="flex items-center gap-2 border-b border-[#d8e4f5] bg-[#f4f8ff] px-2 py-1.5 sm:px-3">
                <button
                  type="button"
                  className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-2 px-2 py-1.5 text-left"
                  aria-expanded={open}
                  onClick={() =>
                    setOpenKey((current) =>
                      current === line.key ? null : line.key,
                    )
                  }
                >
                  <span className="min-w-0">
                    <strong className="block text-[13px] font-semibold text-slate-900">
                      {t("creditNoteLine", { n: index + 1 })}
                    </strong>
                    {!open ? (
                      <span className="mt-0.5 block truncate text-[12px] text-slate-500">
                        {summary}
                      </span>
                    ) : null}
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-slate-600 transition-transform duration-300",
                      open && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>
                {lines.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-11 shrink-0 gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => removeLine(line.key)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                    {t("removeLine")}
                  </Button>
                ) : null}
              </div>

              <SmoothAccordion open={open}>
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
                      required={open}
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
                      <QuantityStepper
                        id={`quantity-${line.key}`}
                        name="quantity"
                        label={t("quantity")}
                        min={1}
                        defaultValue={Number.parseInt(line.quantity, 10) || 1}
                        onValueChange={(value) =>
                          updateLine(line.key, { quantity: String(value) })
                        }
                        className="gap-1.5 [&_label]:mb-1.5 [&_label]:text-[13px] [&_label]:font-bold [&_label]:text-slate-700"
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
                        required={open}
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
                        required={open}
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
              </SmoothAccordion>
            </div>
          );
        })}
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
