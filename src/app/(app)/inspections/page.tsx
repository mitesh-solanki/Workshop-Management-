import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { TableSpinner } from "@/components/shared/page-spinner";
import { homePathForRole } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { InspectionsTable } from "@/modules/inspections/components/inspections-table";
import { NewInspectionButton } from "@/modules/inspections/components/new-inspection-button";
import {
  INSPECTION_APPROVAL_STATUSES,
  type InspectionApprovalStatus,
} from "@/modules/inspections/approval-status";
import {
  INSPECTION_SORTS,
  type InspectionSort,
} from "@/modules/inspections/schema";
import { listGarageInspections } from "@/modules/inspections/service";

type Props = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    sort?: string;
    page?: string;
    pageSize?: string;
  }>;
};

export const instant = false;

function parseInspectionSort(value: string | undefined): InspectionSort {
  if (
    value &&
    (INSPECTION_SORTS as readonly string[]).includes(value)
  ) {
    return value as InspectionSort;
  }
  return "newest";
}

function parseApprovalStatus(
  value: string | undefined,
): InspectionApprovalStatus | undefined {
  if (
    value &&
    (INSPECTION_APPROVAL_STATUSES as readonly string[]).includes(value)
  ) {
    return value as InspectionApprovalStatus;
  }
  return undefined;
}

export default async function InspectionsPage({ searchParams }: Props) {
  const session = await requireSession();
  if (session.role === "TECHNICIAN") {
    redirect(homePathForRole(session.role));
  }
  const params = await searchParams;
  const t = await getTranslations("inspections");

  const page = Number(params.page) || 1;
  const pageSize = Number(params.pageSize) || 20;
  const sort = parseInspectionSort(params.sort);
  const approvalStatus = parseApprovalStatus(params.status);
  const result = await listGarageInspections(session, {
    q: params.q,
    approvalStatus,
    sort,
    page,
    pageSize,
  });

  const canWrite =
    session.role === "OWNER" || session.role === "MANAGER";

  const createAction = canWrite ? <NewInspectionButton /> : undefined;

  const hasQuery = Boolean(params.q?.trim()) || Boolean(approvalStatus);

  return (
    <main className="space-y-6 sm:space-y-8">
      <PageHeader
        title={t("listTitle")}
        description={t("listSubtitle")}
        actions={createAction}
      />

      <Suspense fallback={<TableSpinner />}>
        <InspectionsTable
          inspections={result.items.map((item) => ({
            id: item.id,
            createdAt: item.createdAt,
            expectedCompletion: item.expectedCompletion,
            customer: { id: item.customer.id, name: item.customer.name },
            vehicle: {
              id: item.vehicle.id,
              registrationNumber: item.vehicle.registrationNumber,
              make: item.vehicle.make,
              model: item.vehicle.model,
            },
            serviceOrderId: item.serviceOrderId,
            itemCount: item._count.items,
            approvalStatus: item.approvalStatus,
          }))}
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          empty={
            <EmptyState
              icon={ClipboardList}
              title={hasQuery ? t("emptySearchTitle") : t("emptyTitle")}
              description={
                hasQuery ? t("emptySearchDescription") : t("emptyDescription")
              }
              action={!hasQuery ? createAction : undefined}
            />
          }
        />
      </Suspense>
    </main>
  );
}
