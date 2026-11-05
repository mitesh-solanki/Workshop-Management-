"use client";

import { useTranslations } from "next-intl";
import { FormField } from "@/components/ui/form-field";
import { FormSelect } from "@/components/ui/form-select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { sanitizeRupeesTyping } from "@/lib/money";
import { ExpenseCategoryInput } from "@/modules/expenses/components/expense-category-input";
import {
  EXPENSE_METHODS,
  type ExpenseMethod,
  type ExpenseStatus,
} from "@/modules/expenses/schema";

export type ExpenseFormValues = {
  amountRupees: string;
  spentAt: string;
  status: ExpenseStatus;
  method: ExpenseMethod | "";
  category: string;
  note: string;
};

type Props = {
  idPrefix: string;
  values: ExpenseFormValues;
  fieldErrors: Record<string, string>;
  usedCategories?: readonly string[];
  onChange: <K extends keyof ExpenseFormValues>(
    key: K,
    value: ExpenseFormValues[K],
  ) => void;
};

export function ExpenseFormFields({
  idPrefix,
  values,
  fieldErrors,
  usedCategories = [],
  onChange,
}: Props) {
  const t = useTranslations("expenses");

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id={`${idPrefix}-amount`}
          label={t("amount")}
          error={fieldErrors.amountRupees}
        >
          <Input
            id={`${idPrefix}-amount`}
            name="amountRupees"
            inputMode="decimal"
            value={values.amountRupees}
            onChange={(e) =>
              onChange("amountRupees", sanitizeRupeesTyping(e.target.value))
            }
            placeholder={t("amountPlaceholder")}
            aria-invalid={Boolean(fieldErrors.amountRupees)}
            className="h-11 min-h-11"
            autoFocus
          />
        </FormField>
        <FormField
          id={`${idPrefix}-spentAt`}
          label={t("date")}
          error={fieldErrors.spentAt}
        >
          <Input
            id={`${idPrefix}-spentAt`}
            name="spentAt"
            type="date"
            value={values.spentAt}
            onChange={(e) => onChange("spentAt", e.target.value)}
            aria-invalid={Boolean(fieldErrors.spentAt)}
            className="h-11 min-h-11"
          />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id={`${idPrefix}-category`}
          label={t("category")}
          error={fieldErrors.category}
        >
          <ExpenseCategoryInput
            id={`${idPrefix}-category`}
            value={values.category}
            onValueChange={(value) => onChange("category", value)}
            usedCategories={usedCategories}
            placeholder={t("categoryPlaceholder")}
            aria-invalid={Boolean(fieldErrors.category)}
          />
        </FormField>
        <FormField
          id={`${idPrefix}-status`}
          label={t("status")}
          error={fieldErrors.status}
        >
          <input type="hidden" name="status" value={values.status} />
          <div
            role="group"
            aria-label={t("status")}
            className="grid grid-cols-2 gap-1.5 rounded-lg border border-border bg-muted/40 p-1"
          >
            {(["PAID", "UNPAID"] as const).map((status) => {
              const active = values.status === status;
              return (
                <button
                  key={status}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    onChange("status", status);
                    if (status === "UNPAID") {
                      onChange("method", "");
                    } else if (!values.method) {
                      onChange("method", "CASH");
                    }
                  }}
                  className={cn(
                    "inline-flex min-h-10 items-center justify-center rounded-md px-3 text-sm font-semibold transition-colors",
                    active
                      ? status === "PAID"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-amber-500 text-white shadow-sm"
                      : "text-muted-foreground hover:bg-background hover:text-foreground",
                  )}
                >
                  {t(`statuses.${status}`)}
                </button>
              );
            })}
          </div>
        </FormField>
      </div>
      {values.status === "PAID" ? (
        <FormField
          id={`${idPrefix}-method`}
          label={t("method")}
          error={fieldErrors.method}
        >
          <FormSelect
            id={`${idPrefix}-method`}
            name="method"
            value={values.method}
            onValueChange={(value) =>
              onChange("method", value as ExpenseMethod | "")
            }
            placeholder={t("methodPlaceholder")}
            options={EXPENSE_METHODS.map((method) => ({
              value: method,
              label: t(`methods.${method}`),
            }))}
            triggerClassName="h-11 min-h-11"
          />
        </FormField>
      ) : (
        <input type="hidden" name="method" value="" />
      )}
      <FormField id={`${idPrefix}-note`} label={t("note")}>
        <Textarea
          id={`${idPrefix}-note`}
          name="note"
          rows={2}
          value={values.note}
          onChange={(e) => onChange("note", e.target.value)}
          placeholder={t("notePlaceholder")}
        />
      </FormField>
    </div>
  );
}

export function todayDateInput(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
