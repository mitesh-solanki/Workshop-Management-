import { ClipboardList } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { AddChecklistItemForm } from "@/modules/inspections/components/add-checklist-item-form";
import { InspectionConditionGrid } from "@/modules/inspections/components/inspection-condition-grid";
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
  inspection: {
    items: Item[];
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
      <div>
        <EmptyState icon={ClipboardList} title={t("emptyReadOnly")} compact />
      </div>
    );
  }

  return (
    <div className="space-y-5">
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
    </div>
  );
}
