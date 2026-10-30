import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { homePathForRole } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { getEstimateForInspection } from "@/modules/estimates/service";
import { InspectionPageForm } from "@/modules/inspections/components/inspection-page-form";
import { getInspection } from "@/modules/inspections/service";
import { getLiveLinkStatusForInspection } from "@/modules/live-link/service";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ section?: string }>;
};

export const instant = false;

export default async function InspectionDetailPage({
  params,
  searchParams,
}: Props) {
  const session = await requireSession();
  if (session.role === "TECHNICIAN") {
    redirect(homePathForRole(session.role));
  }
  const { id } = await params;
  const { section } = await searchParams;
  const t = await getTranslations("inspections");

  let inspection: Awaited<ReturnType<typeof getInspection>>;
  let estimateData: Awaited<ReturnType<typeof getEstimateForInspection>>;
  let liveLinkStatus: Awaited<
    ReturnType<typeof getLiveLinkStatusForInspection>
  > = { active: null };
  try {
    inspection = await getInspection(session, id);
    [estimateData, liveLinkStatus] = await Promise.all([
      getEstimateForInspection(session, id),
      getLiveLinkStatusForInspection(session, id).catch(() => ({
        active: null,
      })),
    ]);
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ForbiddenError) {
      notFound();
    }
    throw error;
  }

  const canEdit =
    (session.role === "OWNER" || session.role === "MANAGER") &&
    inspection.serviceOrder?.status !== "COMPLETED";

  const canEditLiveLink =
    session.role === "OWNER" ||
    session.role === "MANAGER" ||
    session.role === "ACCOUNTANT";

  return (
    <main className="w-full space-y-4">
      <Link
        href="/inspections"
        className="inline-flex h-5 max-h-5 items-center gap-0.5 px-0.5 text-[13px] leading-5 text-slate-700 hover:text-blue-700"
      >
        <ChevronLeft className="size-3.5 shrink-0" aria-hidden />
        {t("back")}
      </Link>

      <InspectionPageForm
        mode="edit"
        canEdit={canEdit}
        initialSection={section}
        inspection={{
          id: inspection.id,
          complaint: inspection.complaint,
          recommendedNotes: inspection.recommendedNotes,
          expectedCompletion: inspection.expectedCompletion,
          customerId: inspection.customerId,
          vehicleId: inspection.vehicleId,
          serviceOrderId: inspection.serviceOrderId,
          customer: inspection.customer,
          vehicle: inspection.vehicle,
        }}
        items={inspection.items.map((item) => ({
          id: item.id,
          key: item.key,
          label: item.label,
          result: item.result,
          notes: item.notes,
          quantity: item.quantity,
          unitPricePaise: item.unitPricePaise,
          externalCheck: item.externalCheck,
          media: item.media.map((m) => ({
            id: m.id,
            kind: m.kind,
            url: m.url,
            contentType: m.contentType,
          })),
        }))}
        estimate={{
          current: estimateData.current
            ? {
                id: estimateData.current.id,
                revisionNumber: estimateData.current.revisionNumber,
                askPermission: estimateData.current.askPermission,
                permissionVia: estimateData.current.permissionVia,
                notes: estimateData.current.notes,
                lines: estimateData.current.lines.map((line) => ({
                  id: line.id,
                  type: line.type,
                  description: line.description,
                  quantity: line.quantity,
                  unitPricePaise: line.unitPricePaise,
                  approvalState: line.approvalState,
                })),
                totals: {
                  all: {
                    taxablePaise: estimateData.current.totals.all.taxablePaise,
                    totalPaise: estimateData.current.totals.all.totalPaise,
                  },
                  approved: {
                    totalPaise:
                      estimateData.current.totals.approved.totalPaise,
                  },
                  pending: {
                    totalPaise: estimateData.current.totals.pending.totalPaise,
                  },
                },
              }
            : null,
          liveLinkActive: liveLinkStatus.active,
          canEditLiveLink,
        }}
      />
    </main>
  );
}
