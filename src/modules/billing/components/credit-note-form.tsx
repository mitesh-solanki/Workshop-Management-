"use client";

import { useActionState, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import {
  createCreditNoteAction,
  type BillingActionState,
} from "@/app/actions/billing";
import { CREDIT_NOTE_REASONS } from "@/modules/billing/schema";

const initial: BillingActionState = { ok: false };

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

type Props = {
  invoiceId: string;
  orderId: string;
};

export function CreditNoteForm({ invoiceId, orderId }: Props) {
  const t = useTranslations("billing");
  const idPrefix = useId();
  const bound = createCreditNoteAction.bind(null, orderId, invoiceId);
  const [state, formAction, pending] = useActionState(bound, initial);
  const [lineSeq, setLineSeq] = useState(1);
  const [lines, setLines] = useState<LineDraft[]>(() => [
    emptyLine(`${idPrefix}-0`),
  ]);

  function updateLine(key: string, patch: Partial<LineDraft>) {
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <p className="text-sm font-medium text-slate-800">{t("createCreditNote")}</p>
      <p className="text-caption text-slate-500">{t("creditNoteHint")}</p>
      <FormField id="reason" label={t("creditNoteReason")}>
        <select
          id="reason"
          name="reason"
          className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
          defaultValue="CORRECTION"
        >
          {CREDIT_NOTE_REASONS.map((reason) => (
            <option key={reason} value={reason}>
              {t(`reasons.${reason}`)}
            </option>
          ))}
        </select>
      </FormField>

      <div className="space-y-3">
        {lines.map((line, index) => (
          <div
            key={line.key}
            className="space-y-3 rounded-md border border-slate-100 p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-caption font-medium text-slate-600">
                {t("creditNoteLine", { n: index + 1 })}
              </p>
              {lines.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-11"
                  onClick={() =>
                    setLines((prev) => prev.filter((row) => row.key !== line.key))
                  }
                >
                  {t("removeLine")}
                </Button>
              ) : null}
            </div>
            <FormField
              id={`description-${line.key}`}
              label={t("lineDescription")}
            >
              <input
                id={`description-${line.key}`}
                name="description"
                required
                value={line.description}
                onChange={(e) =>
                  updateLine(line.key, { description: e.target.value })
                }
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </FormField>
            <div className="grid gap-3 sm:grid-cols-3">
              <FormField id={`quantity-${line.key}`} label={t("quantity")}>
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
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
              </FormField>
              <FormField
                id={`unitPriceRupees-${line.key}`}
                label={t("unitPrice")}
              >
                <input
                  id={`unitPriceRupees-${line.key}`}
                  name="unitPriceRupees"
                  required
                  value={line.unitPriceRupees}
                  onChange={(e) =>
                    updateLine(line.key, { unitPriceRupees: e.target.value })
                  }
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                  inputMode="decimal"
                />
              </FormField>
              <FormField
                id={`gstRatePercent-${line.key}`}
                label={t("gstRate")}
              >
                <input
                  id={`gstRatePercent-${line.key}`}
                  name="gstRatePercent"
                  type="number"
                  min={0}
                  max={100}
                  required
                  value={line.gstRatePercent}
                  onChange={(e) =>
                    updateLine(line.key, { gstRatePercent: e.target.value })
                  }
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
              </FormField>
            </div>
            <FormField id={`hsnOrSac-${line.key}`} label={t("hsnOrSac")}>
              <input
                id={`hsnOrSac-${line.key}`}
                name="hsnOrSac"
                required
                value={line.hsnOrSac}
                onChange={(e) =>
                  updateLine(line.key, { hsnOrSac: e.target.value })
                }
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </FormField>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        onClick={() => {
          const next = lineSeq;
          setLineSeq((n) => n + 1);
          setLines((prev) => [...prev, emptyLine(`${idPrefix}-${next}`)]);
        }}
      >
        {t("addCreditNoteLine")}
      </Button>

      <FormField id="notes" label={t("notes")}>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </FormField>
      {state.message && !state.ok ? (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.message && state.ok ? (
        <p className="text-sm text-foreground">{t(state.message)}</p>
      ) : null}
      <Button type="submit" variant="outline" disabled={pending} className="min-h-11">
        {pending ? t("saving") : t("saveCreditNote")}
      </Button>
    </form>
  );
}
