"use client";

import { useActionState, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  createDirectSaleAction,
  type InventoryActionState,
} from "@/app/actions/inventory";
import { computeLineGst, sumLineGst } from "@/lib/gst";
import {
  formatRupees,
  isZeroRupeesInput,
  parseRupeesToPaise,
  sanitizeRupeesTyping,
} from "@/lib/money";
import { FormSelect } from "@/components/ui/form-select";

const initial: InventoryActionState = { ok: false };

const inputClass =
  "min-h-12 w-full rounded-md border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring";

type PartOption = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  sellingPricePaise: number;
  gstRatePercent: number;
  quantityOnHand: number;
};

type CustomerOption = {
  id: string;
  name: string;
  phone: string;
};

type LineDraft = {
  key: string;
  partId: string;
  quantity: number;
  unitPriceRupees: string;
};

type Props = {
  parts: PartOption[];
  customers: CustomerOption[];
};

function paiseFromRupeesField(value: string, fallbackPaise: number): number {
  const parsed = parseRupeesToPaise(value);
  if (parsed == null) {
    return fallbackPaise;
  }
  return parsed;
}

function rupeesFieldFromPaise(paise: number): string {
  if (paise === 0) {
    return "";
  }
  const rupees = Math.floor(paise / 100);
  const rem = paise % 100;
  if (rem === 0) {
    return String(rupees);
  }
  return `${rupees}.${String(rem).padStart(2, "0")}`;
}

function newLine(parts: PartOption[]): LineDraft {
  const part = parts[0];
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    partId: part?.id ?? "",
    quantity: 1,
    unitPriceRupees: part != null ? rupeesFieldFromPaise(part.sellingPricePaise) : "",
  };
}

export function DirectSaleForm({ parts, customers }: Props) {
  const t = useTranslations("inventory");
  const [state, formAction, pending] = useActionState(
    createDirectSaleAction,
    initial,
  );
  const [lines, setLines] = useState<LineDraft[]>(() => [newLine(parts)]);

  const partById = useMemo(() => {
    const map = new Map(parts.map((p) => [p.id, p]));
    return map;
  }, [parts]);

  const previewTotals = useMemo(() => {
    const gstLines = lines
      .map((line) => {
        const part = partById.get(line.partId);
        if (!part) {
          return null;
        }
        return {
          quantity: line.quantity,
          unitPricePaise: paiseFromRupeesField(
            line.unitPriceRupees,
            part.sellingPricePaise,
          ),
          gstRatePercent: part.gstRatePercent,
        };
      })
      .filter((line): line is NonNullable<typeof line> => line != null);
    return sumLineGst(gstLines);
  }, [lines, partById]);

  if (parts.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noPartsForSale")}</p>;
  }

  function updateLine(key: string, patch: Partial<LineDraft>) {
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function setPartOnLine(key: string, partId: string) {
    const part = partById.get(partId);
    updateLine(key, {
      partId,
      unitPriceRupees:
        part != null ? rupeesFieldFromPaise(part.sellingPricePaise) : "",
    });
  }

  return (
    <form action={formAction} className="flex w-full max-w-3xl flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="customerId" className="text-sm font-medium">
          {t("customer")}
        </label>
        <FormSelect
          id="customerId"
          name="customerId"
          defaultValue=""
          options={[
            { value: "", label: t("walkIn") },
            ...customers.map((customer) => ({
              value: customer.id,
              label: `${customer.name} · ${customer.phone}`,
            })),
          ]}
        />
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">{t("saleLines")}</h2>
          <button
            type="button"
            className="min-h-12 rounded-md border px-3 text-sm font-medium"
            onClick={() => setLines((prev) => [...prev, newLine(parts)])}
            disabled={lines.length >= 50}
          >
            {t("addLine")}
          </button>
        </div>

        <ul className="space-y-4">
          {lines.map((line, index) => {
            const selected = partById.get(line.partId) ?? null;
            const lineGst =
              selected != null
                ? computeLineGst({
                    quantity: line.quantity,
                    unitPricePaise: paiseFromRupeesField(
                      line.unitPriceRupees,
                      selected.sellingPricePaise,
                    ),
                    gstRatePercent: selected.gstRatePercent,
                  })
                : null;
            return (
              <li
                key={line.key}
                className="space-y-3 rounded-md border p-3 sm:p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {t("lineNumber", { number: index + 1 })}
                  </p>
                  {lines.length > 1 ? (
                    <button
                      type="button"
                      className="min-h-12 rounded-md px-3 text-sm text-destructive"
                      onClick={() =>
                        setLines((prev) =>
                          prev.filter((row) => row.key !== line.key),
                        )
                      }
                    >
                      {t("removeLine")}
                    </button>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label
                      htmlFor={`partId-${line.key}`}
                      className="text-sm font-medium"
                    >
                      {t("part")}
                    </label>
                    <FormSelect
                      id={`partId-${line.key}`}
                      name="partId"
                      required
                      value={line.partId}
                      onValueChange={(partId) =>
                        setPartOnLine(line.key, partId)
                      }
                      options={parts.map((part) => ({
                        value: part.id,
                        label: `${part.name} (${part.sku}) · ${part.quantityOnHand} ${part.unit}`,
                      }))}
                    />
                    {selected ? (
                      <p className="text-xs text-muted-foreground">
                        {t("onHand", { count: selected.quantityOnHand })} ·{" "}
                        {t("gstRate")} {selected.gstRatePercent}%
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor={`quantity-${line.key}`}
                      className="text-sm font-medium"
                    >
                      {t("quantity")}
                    </label>
                    <input
                      id={`quantity-${line.key}`}
                      name="quantity"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      required
                      value={line.quantity}
                      onChange={(e) =>
                        updateLine(line.key, {
                          quantity: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                      className={inputClass}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor={`unitPriceRupees-${line.key}`}
                      className="text-sm font-medium"
                    >
                      {t("sellingPrice")}
                    </label>
                    <input
                      id={`unitPriceRupees-${line.key}`}
                      name="unitPriceRupees"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="0"
                      pattern="^\d+(\.\d{1,2})?$"
                      title={t("priceHint")}
                      required
                      value={line.unitPriceRupees}
                      onChange={(e) =>
                        updateLine(line.key, {
                          unitPriceRupees: sanitizeRupeesTyping(e.target.value),
                        })
                      }
                      onFocus={(event) => {
                        if (isZeroRupeesInput(event.currentTarget.value)) {
                          event.currentTarget.select();
                        }
                      }}
                      onBlur={(event) => {
                        const value = event.currentTarget.value.trim();
                        if (isZeroRupeesInput(value)) {
                          updateLine(line.key, { unitPriceRupees: "" });
                          return;
                        }
                        if (/^0\d/.test(value)) {
                          updateLine(line.key, {
                            unitPriceRupees: value.replace(/^0+(?=\d)/, ""),
                          });
                        }
                      }}
                      className={inputClass}
                    />
                    <p className="text-xs text-muted-foreground">{t("priceHint")}</p>
                  </div>
                </div>

                {lineGst ? (
                  <p className="text-xs text-muted-foreground">
                    {t("lineTotal")}: {formatRupees(lineGst.totalPaise)} (
                    {t("taxableTotal")} {formatRupees(lineGst.taxablePaise)} +{" "}
                    {t("gstTotal")} {formatRupees(lineGst.gstPaise)})
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="notes" className="text-sm font-medium">
          {t("notes")}
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          maxLength={500}
          className={`${inputClass} min-h-20 py-3`}
        />
      </div>

      <div className="space-y-1 rounded-md border bg-muted/40 px-3 py-3 text-sm">
        <p className="flex justify-between gap-3">
          <span>{t("taxableTotal")}</span>
          <span>{formatRupees(previewTotals.taxablePaise)}</span>
        </p>
        <p className="flex justify-between gap-3">
          <span>{t("gstTotal")}</span>
          <span>{formatRupees(previewTotals.gstPaise)}</span>
        </p>
        <p className="flex justify-between gap-3 text-base font-semibold">
          <span>{t("saleTotal")}</span>
          <span>{formatRupees(previewTotals.totalPaise)}</span>
        </p>
      </div>

      {state.message ? (
        <p className="text-sm text-destructive" role="status">
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-md bg-primary px-4 text-base font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? t("saving") : t("completeSale")}
      </button>
    </form>
  );
}
