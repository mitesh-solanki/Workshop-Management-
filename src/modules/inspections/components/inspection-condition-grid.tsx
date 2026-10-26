"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChecklistItemCard } from "@/modules/inspections/components/checklist-item-card";
import type { InspectionItemResultValue } from "@/modules/inspections/schema";

type Media = {
  id: string;
  kind: "PHOTO" | "VIDEO";
  url: string;
  contentType: string;
};

type Item = {
  id: string;
  key: string;
  label: string;
  result: InspectionItemResultValue | null;
  notes: string | null;
  media: Media[];
};

type Props = {
  orderId: string;
  canEdit: boolean;
  items: Item[];
};

export function InspectionConditionGrid({ orderId, canEdit, items }: Props) {
  const t = useTranslations("inspections");
  const [results, setResults] = useState<Record<string, InspectionItemResultValue | null>>(
    () => Object.fromEntries(items.map((item) => [item.id, item.result])),
  );

  const { checkedCount, totalCount, progressPercent } = useMemo(() => {
    const total = items.length;
    const checked = items.reduce((count, item) => {
      const result = results[item.id] ?? item.result;
      return result ? count + 1 : count;
    }, 0);
    return {
      checkedCount: checked,
      totalCount: total,
      progressPercent: total === 0 ? 0 : Math.round((checked / total) * 100),
    };
  }, [items, results]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-slate-300 bg-blue-50/70 px-3.5 py-3">
        <div>
          <strong className="text-sm font-semibold text-slate-900">
            {t("checklist")}
          </strong>
          <p className="mt-0.5 text-[12px] text-slate-500">
            {t("checkedCount", { checked: checkedCount, total: totalCount })}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <strong className="text-[13px] font-semibold text-blue-700">
            {t("progressPercent", { percent: progressPercent })}
          </strong>
          <div
            className="h-1.5 w-[150px] overflow-hidden rounded-full bg-blue-100"
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t("checklist")}
          >
            <div
              className="h-full rounded-full bg-blue-600 transition-[width] duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <strong className="text-sm font-semibold text-slate-900">
            {t("vehicleCondition")}
          </strong>
          <p className="mt-0.5 text-[12px] text-slate-500">
            {t("vehicleConditionHint")}
          </p>
        </div>
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
          <span className="font-semibold text-emerald-700">
            ● {t("results.OK")}
          </span>
          <span className="font-semibold text-amber-700">
            ● {t("results.NEEDS_ATTENTION")}
          </span>
          <span className="font-semibold text-red-700">
            ● {t("results.URGENT")}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {items.map((item) => (
          <ChecklistItemCard
            key={item.id}
            orderId={orderId}
            canEdit={canEdit}
            item={{
              ...item,
              result: results[item.id] ?? item.result,
            }}
            onResultChange={(result) => {
              setResults((prev) => ({ ...prev, [item.id]: result }));
            }}
          />
        ))}
      </div>
    </>
  );
}
