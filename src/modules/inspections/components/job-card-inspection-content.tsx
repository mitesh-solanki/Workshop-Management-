import { ClipboardList } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { AddChecklistItemForm } from "@/modules/inspections/components/add-checklist-item-form";
import { InspectionConditionGrid } from "@/modules/inspections/components/inspection-condition-grid";
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
      <div className="px-4 py-5 sm:px-5">
        <EmptyState icon={ClipboardList} title={t("emptyReadOnly")} compact />
      </div>
    );
  }

  return (
    <div className="space-y-5 px-4 py-5 sm:px-5">
      <InspectionConditionGrid
        orderId={orderId}
        canEdit={canEdit}
        items={inspection.items}
      />

      {canEdit ? (
        <div className="rounded-[10px] border border-dashed border-slate-300 bg-slate-50/80 p-4">
          <AddChecklistItemForm orderId={orderId} />
        </div>
      ) : null}

      <div className="border-t-2 border-slate-300 pt-5">
        <SuggestedRepairSection
          orderId={orderId}
          canEdit={canEdit}
          repairs={inspection.suggestedRepairs}
        />
      </div>
    </div>
  );
}
