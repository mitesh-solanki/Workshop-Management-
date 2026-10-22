import { ClipboardList } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { AddChecklistItemForm } from "@/modules/inspections/components/add-checklist-item-form";
import { ChecklistItemCard } from "@/modules/inspections/components/checklist-item-card";
import { SuggestedRepairSection } from "@/modules/inspections/components/suggested-repair-form";
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

type Repair = {
  id: string;
  type: "LABOUR" | "PART";
  description: string;
  quantity: number;
  unitPricePaise: number;
};

type Props = {
  orderId: string;
  canEdit: boolean;
  inspection: {
    items: Item[];
    suggestedRepairs: Repair[];
  } | null;
};

export async function JobCardInspectionContent({
  orderId,
  canEdit,
  inspection,
}: Props) {
  const t = await getTranslations("inspections");

  if (!inspection) {
    return (
      <div className="px-5 py-5 sm:px-6">
        <EmptyState icon={ClipboardList} title={t("emptyReadOnly")} compact />
      </div>
    );
  }

  const checkedCount = inspection.items.filter((item) => item.result).length;
  const totalCount = inspection.items.length;
  const progressPercent =
    totalCount === 0 ? 0 : Math.round((checkedCount / totalCount) * 100);

  return (
    <div className="space-y-4 px-3 py-3 sm:px-4 sm:py-4">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <header className="border-b border-slate-100 px-5 py-5 sm:px-6">
          <h2 className="text-[21px] font-semibold tracking-tight text-slate-900">
            {t("pageHeading")}
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">
            {t("pageIntro")}
          </p>
        </header>

        <section
          className="border-b border-slate-100 bg-slate-50/80 px-5 py-4 sm:px-6"
          aria-label={t("checklist")}
        >
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 text-[13px]">
            <strong className="font-semibold text-slate-900">
              {t("checklist")}
            </strong>
            <span className="text-slate-500">
              {t("componentsToInspect", { count: totalCount })}
              {checkedCount > 0
                ? ` · ${t("checkedCount", { checked: checkedCount, total: totalCount })}`
                : null}
            </span>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-slate-200"
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
        </section>

        <div className="px-5 py-5 sm:px-6 sm:py-6">
          <div className="mb-4 sm:mb-5">
            <h3 className="text-base font-semibold text-slate-900">
              {t("vehicleCondition")}
            </h3>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
              {t("vehicleConditionHint")}
            </p>
            <ul className="mt-3 space-y-1.5 text-[12px] leading-snug text-slate-600">
              <li>
                <span className="font-semibold text-green-800">
                  {t("resultMarks.OK")} {t("results.OK")}
                </span>
                {" — "}
                {t("resultMeanings.OK")}
              </li>
              <li>
                <span className="font-semibold text-orange-800">
                  {t("resultMarks.NEEDS_ATTENTION")}{" "}
                  {t("results.NEEDS_ATTENTION")}
                </span>
                {" — "}
                {t("resultMeanings.NEEDS_ATTENTION")}
              </li>
              <li>
                <span className="font-semibold text-red-700">
                  {t("resultMarks.URGENT")} {t("results.URGENT")}
                </span>
                {" — "}
                {t("resultMeanings.URGENT")}
              </li>
            </ul>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {inspection.items.map((item) => (
              <ChecklistItemCard
                key={item.id}
                orderId={orderId}
                canEdit={canEdit}
                item={item}
              />
            ))}
          </div>

          {canEdit ? (
            <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-3">
              <AddChecklistItemForm orderId={orderId} />
            </div>
          ) : null}
        </div>

        <footer className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs leading-relaxed text-slate-500">
            {t("footerHint")}
          </p>
          <p className="text-xs font-medium text-slate-600">
            {t("checkedCount", { checked: checkedCount, total: totalCount })}
          </p>
        </footer>
      </div>

      <SuggestedRepairSection
        orderId={orderId}
        canEdit={canEdit}
        repairs={inspection.suggestedRepairs}
      />
    </div>
  );
}
