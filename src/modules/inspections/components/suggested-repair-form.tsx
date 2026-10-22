"use client";

import { useActionState, useMemo, useTransition } from "react";
import { useTranslations } from "next-intl";
import { formatRupees, multiplyByQuantity } from "@/lib/money";
import {
  addSuggestedRepairAction,
  removeSuggestedRepairAction,
  type InspectionActionState,
} from "@/app/actions/inspections";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { RupeePriceInput } from "@/components/rupee-price-input";

const initial: InspectionActionState = { ok: false };

const selectClass =
  "h-8 min-h-8 w-full rounded-md border border-input bg-white px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/40";

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
    <section className="space-y-2 border-t border-slate-200 pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">
          {t("suggestedRepairs")}
        </h3>
        <p className="text-caption text-slate-500">{t("suggestedRepairsHintShort")}</p>
      </div>

      {repairs.length > 0 ? (
        <ul className="rounded-lg border border-slate-200 bg-white">
          {repairs.map((repair) => {
            const total = multiplyByQuantity(
              repair.unitPricePaise,
              repair.quantity,
            );
            return (
              <li
                key={repair.id}
                className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {repair.description}
                  </p>
                  <p className="text-caption text-slate-500">
                    {`${t(`repairTypes.${repair.type}`)} · ${repair.quantity} × ${formatRupees(repair.unitPricePaise)} = ${formatRupees(total)}`}
                  </p>
                </div>
                {canEdit ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 shrink-0"
                    disabled={removing}
                    onClick={() =>
                      startRemove(() => {
                        void removeSuggestedRepairAction(repair.id, orderId);
                      })
                    }
                  >
                    {t("removeRepair")}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-caption text-slate-500">{t("repairsEmptyShort")}</p>
      )}

      {canEdit ? (
        <form
          action={formAction}
          className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3"
        >
          <p className="text-xs font-semibold text-slate-800">
            {t("addRepairTitle")}
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <FormField id="repair-type" label={t("repairType")}>
              <select
                id="repair-type"
                name="type"
                required
                defaultValue="LABOUR"
                className={selectClass}
              >
                <option value="LABOUR">{t("repairTypes.LABOUR")}</option>
                <option value="PART">{t("repairTypes.PART")}</option>
              </select>
            </FormField>
            <FormField id="repair-qty" label={t("quantity")}>
              <Input
                id="repair-qty"
                name="quantity"
                type="number"
                inputMode="numeric"
                min={1}
                defaultValue={1}
                required
                className="h-8 min-h-8"
              />
            </FormField>
            <RupeePriceInput
              id="repair-price"
              label={t("unitPrice")}
              hint={t("unitPriceHint")}
              inputClassName="h-8 min-h-8"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <FormField
              id="repair-desc"
              label={t("repairDescription")}
              className="min-w-0 flex-1"
            >
              <Input
                id="repair-desc"
                name="description"
                required
                maxLength={500}
                placeholder={t("repairDescriptionPlaceholder")}
                className="h-8 min-h-8"
              />
            </FormField>
            <Button
              type="submit"
              size="sm"
              loading={pending}
              className="h-8 shrink-0 bg-blue-600 text-white hover:bg-blue-700 hover:text-white"
            >
              {pending ? t("saving") : t("addRepair")}
            </Button>
          </div>
          {state.message && !state.ok ? (
            <p className="text-xs text-red-600" role="status">
              {state.message}
            </p>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
