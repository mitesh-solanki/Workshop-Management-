"use client";

import { useActionState, useMemo, useTransition } from "react";
import { useTranslations } from "next-intl";
import { formatRupees, multiplyByQuantity } from "@/lib/money";
import {
  addSuggestedRepairAction,
  removeSuggestedRepairAction,
  type InspectionActionState,
} from "@/app/actions/inspections";
import { RupeePriceInput } from "@/components/rupee-price-input";

const initial: InspectionActionState = { ok: false };

const inputClass =
  "min-h-12 w-full rounded-md border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Repair = {
  id: string;
  type: "LABOUR" | "PART";
  description: string;
  quantity: number;
  unitPricePaise: number;
};

type Props = {
  orderId: string;
  repairs: Repair[];
  canEdit: boolean;
};

export function SuggestedRepairSection({ orderId, repairs, canEdit }: Props) {
  const t = useTranslations("inspections");
  const bound = useMemo(
    () => addSuggestedRepairAction.bind(null, orderId),
    [orderId],
  );
  const [state, formAction, pending] = useActionState(bound, initial);
  const [removing, startRemove] = useTransition();

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-medium">{t("suggestedRepairs")}</h2>
      {repairs.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("repairsEmpty")}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {repairs.map((repair) => {
            const total = multiplyByQuantity(
              repair.unitPricePaise,
              repair.quantity,
            );
            return (
              <li
                key={repair.id}
                className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">{repair.description}</p>
                  <p className="text-sm text-muted-foreground">
                    {t(`repairTypes.${repair.type}`)} · {repair.quantity} ×{" "}
                    {formatRupees(repair.unitPricePaise)} = {formatRupees(total)}
                  </p>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    disabled={removing}
                    className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-md border px-4 text-sm font-medium"
                    onClick={() =>
                      startRemove(() => {
                        void removeSuggestedRepairAction(repair.id, orderId);
                      })
                    }
                  >
                    {t("removeRepair")}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canEdit && (
        <form action={formAction} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="repair-type" className="text-sm font-medium">
                {t("repairType")}
              </label>
              <select
                id="repair-type"
                name="type"
                required
                defaultValue="LABOUR"
                className={inputClass}
              >
                <option value="LABOUR">{t("repairTypes.LABOUR")}</option>
                <option value="PART">{t("repairTypes.PART")}</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="repair-qty" className="text-sm font-medium">
                {t("quantity")}
              </label>
              <input
                id="repair-qty"
                name="quantity"
                type="number"
                inputMode="numeric"
                min={1}
                defaultValue={1}
                required
                className={inputClass}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="repair-desc" className="text-sm font-medium">
              {t("repairDescription")}
            </label>
            <input
              id="repair-desc"
              name="description"
              required
              maxLength={500}
              className={inputClass}
            />
          </div>
          <RupeePriceInput
            id="repair-price"
            label={t("unitPrice")}
            hint={t("unitPriceHint")}
          />
          {state.message && (
            <p
              className={
                state.ok ? "text-sm text-foreground" : "text-sm text-destructive"
              }
              role="status"
            >
              {state.ok ? t("repairAdded") : state.message}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="min-h-12 rounded-md border px-4 text-base font-medium disabled:opacity-60"
          >
            {pending ? t("saving") : t("addRepair")}
          </button>
        </form>
      )}
    </section>
  );
}
