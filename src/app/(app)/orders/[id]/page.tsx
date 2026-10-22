import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { JobCardEstimateContent } from "@/modules/estimates/components/job-card-estimate-content";
import { getEstimateForOrder } from "@/modules/estimates/service";
import { JobCardInspectionContent } from "@/modules/inspections/components/job-card-inspection-content";
import { getOrCreateInspection } from "@/modules/inspections/service";
import { JobCardDetailPanel } from "@/modules/service-orders/components/job-card-detail-panel";
import { isJobCardSection } from "@/modules/service-orders/job-card-sections";
import { listParts } from "@/modules/inventory/service";
import {
  getOrder,
  getOrderTimeline,
  listAssignableTechnicians,
} from "@/modules/service-orders/service";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ section?: string }>;
};

export const instant = false;

export default async function OrderEditPage({ params, searchParams }: Props) {
  const session = await requireSession();
  const { id } = await params;
  const { section: sectionParam } = await searchParams;
  const locale = await getLocale();
  const t = await getTranslations("orders");

  let order: Awaited<ReturnType<typeof getOrder>>;
  let timeline: Awaited<ReturnType<typeof getOrderTimeline>>;
  let inspection: Awaited<ReturnType<typeof getOrCreateInspection>>;
  let estimate: Awaited<ReturnType<typeof getEstimateForOrder>>;
  let technicians: Awaited<ReturnType<typeof listAssignableTechnicians>>;
  let parts: Awaited<ReturnType<typeof listParts>> = [];

  try {
    order = await getOrder(session, id);
    [timeline, inspection, estimate, technicians, parts] = await Promise.all([
      getOrderTimeline(session, id),
      getOrCreateInspection(session, id),
      getEstimateForOrder(session, id),
      listAssignableTechnicians(session),
      listParts(session),
    ]);
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ForbiddenError) {
      notFound();
    }
    throw error;
  }

  const canMutate =
    (session.role === "OWNER" ||
      session.role === "MANAGER" ||
      (session.role === "TECHNICIAN" &&
        order.technicianId === session.userId)) &&
    order.status !== "COMPLETED";

  const initialSection = isJobCardSection(sectionParam)
    ? sectionParam
    : "details";

  return (
    <main className="w-full max-w-none space-y-4">
      <Link
        href="/orders"
        className="inline-flex h-5 max-h-5 items-center gap-0.5 px-0.5 text-[13px] leading-5 text-muted-foreground hover:text-teal-700"
      >
        <ChevronLeft className="size-3.5 shrink-0" aria-hidden />
        {t("back")}
      </Link>

      <JobCardDetailPanel
        order={{
          id: order.id,
          status: order.status,
          priority: order.priority,
          complaint: order.complaint,
          requestedServices: order.requestedServices,
          odometerIn: order.odometerIn,
          expectedCompletion: order.expectedCompletion,
          bay: order.bay,
          technicianId: order.technicianId,
          customerId: order.customerId,
          customer: { name: order.customer.name },
          vehicle: {
            registrationNumber: order.vehicle.registrationNumber,
            make: order.vehicle.make,
            model: order.vehicle.model,
          },
          technician: order.technician
            ? {
                name: order.technician.name,
                email: order.technician.email,
              }
            : null,
          lines: order.lines.map((line) => ({
            id: line.id,
            type: line.type,
            description: line.description,
            quantity: line.quantity,
            unitPricePaise: line.unitPricePaise,
          })),
        }}
        timeline={timeline}
        technicians={technicians}
        canMutate={canMutate}
        locale={locale}
        initialSection={initialSection}
        parts={parts.map((part) => ({
          id: part.id,
          name: part.name,
          sku: part.sku,
          unit: part.unit,
          sellingPricePaise: part.sellingPricePaise,
          quantityOnHand: part.quantityOnHand,
        }))}
        inspectionContent={
          <JobCardInspectionContent
            orderId={order.id}
            canEdit={canMutate}
            inspection={
              inspection
                ? {
                    items: inspection.items,
                    suggestedRepairs: inspection.suggestedRepairs,
                  }
                : null
            }
          />
        }
        estimateContent={
          <JobCardEstimateContent
            orderId={order.id}
            canEdit={canMutate}
            data={estimate}
          />
        }
      />
    </main>
  );
}
