"use client";

import { useActionState, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import {
  createDirectSaleAction,
  type InventoryActionState,
} from "@/app/actions/inventory";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { FormSelect } from "@/components/ui/form-select";
import { Input } from "@/components/ui/input";
import { SmoothAccordion } from "@/components/ui/smooth-accordion";
import { Textarea } from "@/components/ui/textarea";
import { computeLineGst, sumLineGst } from "@/lib/gst";
import {
  formatRupees,
  isZeroRupeesInput,
  parseRupeesToPaise,
  sanitizeRupeesTyping,
} from "@/lib/money";
import { QuantityStepper } from "@/modules/inventory/components/quantity-stepper";
import { cn } from "@/lib/utils";

const initial: InventoryActionState = { ok: false };

export type DirectSalePartOption = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  sellingPricePaise: number;
  gstRatePercent: number;
  quantityOnHand: number;
};

export type DirectSaleCustomerOption = {
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

export type DirectSaleFormDefaults = {
  customerId?: string;
  walkInName?: string;
  notes?: string;
  lines?: Array<{
    partId: string;
    quantity: number;
    unitPricePaise: number;
  }>;
};

type Props = {
  parts: DirectSalePartOption[];
  customers: DirectSaleCustomerOption[];
  formId?: string;
  formAction?: (payload: FormData) => void | Promise<void>;
  pending?: boolean;
  hideSubmit?: boolean;
  defaultValues?: DirectSaleFormDefaults;
  submitLabel?: string;
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

function newLine(parts: DirectSalePartOption[]): LineDraft {
  const part = parts[0];
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    partId: part?.id ?? "",
    quantity: 1,
    unitPriceRupees: part != null ? rupeesFieldFromPaise(part.sellingPricePaise) : "",
  };
}

export function DirectSaleForm({
  parts,
  customers,
  formId,
  formAction: formActionProp,
  pending: pendingProp,
  hideSubmit = false,
  defaultValues,
  submitLabel,
}: Props) {
  const t = useTranslations("inventory");
  const [state, defaultFormAction, defaultPending] = useActionState(
    createDirectSaleAction,
    initial,
  );
  const formAction = formActionProp ?? defaultFormAction;
  const pending = pendingProp ?? defaultPending;
  const [lines, setLines] = useState<LineDraft[]>(() => {
    if (defaultValues?.lines && defaultValues.lines.length > 0) {
      return defaultValues.lines.map((line) => ({
        key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        partId: line.partId,
        quantity: line.quantity,
        unitPriceRupees: rupeesFieldFromPaise(line.unitPricePaise),
      }));
    }
    return [newLine(parts)];
  });
  const [openKey, setOpenKey] = useState(() => lines[0]?.key ?? "");
  const [customerId, setCustomerId] = useState(
    () => defaultValues?.customerId ?? "",
  );
  const isWalkIn = customerId === "";

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

  function addLine() {
    if (lines.length >= 50) return;
    const line = newLine(parts);
    setLines((prev) => [...prev, line]);
    setOpenKey(line.key);
  }

  function removeLine(key: string) {
    setLines((prev) => {
      const next = prev.filter((row) => row.key !== key);
      if (openKey === key) {
        setOpenKey(next[next.length - 1]?.key ?? "");
      }
      return next;
    });
  }

  return (
    <form
      id={formId}
      action={formAction}
      className="flex w-full flex-col gap-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="customerId" label={t("customer")}>
          <FormSelect
            id="customerId"
            name="customerId"
            value={customerId}
            onValueChange={setCustomerId}
            options={[
              { value: "", label: t("walkIn") },
              ...customers.map((customer) => ({
                value: customer.id,
                label: `${customer.name} · ${customer.phone}`,
              })),
            ]}
          />
        </FormField>

        {isWalkIn ? (
          <FormField
            id="walkInName"
            label={t("walkInName")}
            hint={t("walkInNameHint")}
          >
            <Input
              id="walkInName"
              name="walkInName"
              maxLength={120}
              placeholder={t("walkInNamePlaceholder")}
              className="h-11 min-h-11"
              defaultValue={defaultValues?.walkInName ?? ""}
            />
          </FormField>
        ) : (
          <input type="hidden" name="walkInName" value="" />
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">
            {t("saleLines")}
          </h2>
          <Button
            type="button"
            size="sm"
            className="min-h-11 gap-1.5 bg-blue-600 text-white hover:bg-blue-700"
            onClick={addLine}
            disabled={lines.length >= 50}
          >
            <Plus className="size-4" aria-hidden />
            {t("addLine")}
          </Button>
        </div>

        <ul className="space-y-3">
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
            const isOpen = openKey === line.key;

            return (
              <li
                key={line.key}
                className={cn(
                  "overflow-hidden rounded-xl border bg-card shadow-xs transition-colors",
                  isOpen ? "border-blue-200" : "border-border",
                )}
              >
                <div
                  className={cn(
                    "flex items-center gap-2 border-b px-2 py-1.5 sm:px-3",
                    isOpen
                      ? "border-blue-100 bg-blue-50/80"
                      : "border-border bg-muted/50",
                  )}
                >
                  <button
                    type="button"
                    className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                    aria-expanded={isOpen}
                    onClick={() =>
                      setOpenKey((prev) => (prev === line.key ? "" : line.key))
                    }
                  >
                    <ChevronDown
                      className={cn(
                        "size-4 shrink-0 text-blue-600 transition-transform duration-300",
                        isOpen ? "rotate-0" : "-rotate-90",
                      )}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        {t("lineNumber", { number: index + 1 })}
                      </p>
                      {!isOpen && selected ? (
                        <p className="truncate text-caption text-muted-foreground">
                          {selected.name}
                          {lineGst
                            ? ` · ${formatRupees(lineGst.totalPaise)}`
                            : null}
                        </p>
                      ) : null}
                    </div>
                  </button>
                  {lines.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="min-h-11 shrink-0 gap-1.5 text-blue-700 hover:bg-blue-100 hover:text-blue-900"
                      onClick={() => removeLine(line.key)}
                      aria-label={t("removeLine")}
                    >
                      <Trash2 className="size-4" aria-hidden />
                      {t("removeLine")}
                    </Button>
                  ) : null}
                </div>

                <SmoothAccordion open={isOpen}>
                  <div className="space-y-4 px-4 py-4">
                    <FormField id={`partId-${line.key}`} label={t("part")}>
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
                          label: `${part.name} (${part.sku})`,
                        }))}
                      />
                      {selected ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-600/15">
                            {t("onHand", { count: selected.quantityOnHand })}
                          </span>
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-500/15">
                            {t("gstRate")} {selected.gstRatePercent}%
                          </span>
                        </div>
                      ) : null}
                    </FormField>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <QuantityStepper
                        key={`qty-${line.key}`}
                        id={`quantity-${line.key}`}
                        name="quantity"
                        label={t("quantity")}
                        defaultValue={line.quantity}
                        min={1}
                        onValueChange={(quantity) =>
                          updateLine(line.key, { quantity })
                        }
                      />

                      <FormField
                        id={`unitPriceRupees-${line.key}`}
                        label={t("sellingPrice")}
                      >
                        <Input
                          id={`unitPriceRupees-${line.key}`}
                          name="unitPriceRupees"
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          placeholder="0"
                          pattern="^\d+(\.\d{1,2})?$"
                          required
                          value={line.unitPriceRupees}
                          onChange={(e) =>
                            updateLine(line.key, {
                              unitPriceRupees: sanitizeRupeesTyping(
                                e.target.value,
                              ),
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
                          className="h-11 min-h-11"
                        />
                      </FormField>
                    </div>

                    {lineGst ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-blue-50 px-3 py-2.5 text-sm ring-1 ring-inset ring-blue-100">
                        <span className="font-medium text-blue-900">
                          {t("itemTotal")}
                        </span>
                        <span className="font-semibold tabular-nums text-blue-950">
                          {formatRupees(lineGst.totalPaise)}
                          <span className="ml-2 text-xs font-normal text-blue-800/70">
                            ({t("taxableTotal")}{" "}
                            {formatRupees(lineGst.taxablePaise)} +{" "}
                            {t("gstTotal")} {formatRupees(lineGst.gstPaise)})
                          </span>
                        </span>
                      </div>
                    ) : null}
                  </div>
                </SmoothAccordion>
              </li>
            );
          })}
        </ul>
      </div>

      <FormField id="notes" label={t("notes")} hint={t("saleNotesHint")}>
        <Textarea
          id="notes"
          name="notes"
          rows={2}
          maxLength={500}
          placeholder={t("saleNotesPlaceholder")}
          className="min-h-18 resize-y"
          defaultValue={defaultValues?.notes ?? ""}
        />
      </FormField>

      <div className="space-y-2 rounded-xl border border-border bg-slate-50 px-4 py-3.5 text-sm">
        <p className="flex justify-between gap-3 text-muted-foreground">
          <span>{t("taxableTotal")}</span>
          <span className="tabular-nums text-foreground">
            {formatRupees(previewTotals.taxablePaise)}
          </span>
        </p>
        <p className="flex justify-between gap-3 text-muted-foreground">
          <span>{t("gstTotal")}</span>
          <span className="tabular-nums text-foreground">
            {formatRupees(previewTotals.gstPaise)}
          </span>
        </p>
        <div className="border-t border-border pt-2">
          <p className="flex justify-between gap-3 text-base font-semibold text-foreground">
            <span>{t("saleTotal")}</span>
            <span className="tabular-nums">
              {formatRupees(previewTotals.totalPaise)}
            </span>
          </p>
        </div>
      </div>

      {!hideSubmit && state.message ? (
        <p className="text-sm text-destructive" role="status">
          {state.message}
        </p>
      ) : null}
      {hideSubmit ? null : (
        <Button type="submit" size="md" loading={pending} className="min-h-12">
          {pending ? t("saving") : (submitLabel ?? t("completeSale"))}
        </Button>
      )}
    </form>
  );
}
