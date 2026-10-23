import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { computeLineGst } from "@/lib/gst";
import { requireSession } from "@/lib/session";
import { JobCardBillingContent } from "@/modules/billing/components/job-card-billing-content";
import {
  getGarageBillingProfile,
  getInvoicesForOrder,
} from "@/modules/billing/service";
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
  const te = await getTranslations("estimates");
  const tb = await getTranslations("billing");
  const tGst = await getTranslations("gst");

  let order: Awaited<ReturnType<typeof getOrder>>;
  let timeline: Awaited<ReturnType<typeof getOrderTimeline>>;
  let inspection: Awaited<ReturnType<typeof getOrCreateInspection>>;
  let estimate: Awaited<ReturnType<typeof getEstimateForOrder>>;
  let invoices: Awaited<ReturnType<typeof getInvoicesForOrder>>;
  let technicians: Awaited<ReturnType<typeof listAssignableTechnicians>>;
  let parts: Awaited<ReturnType<typeof listParts>> = [];
  let garage: Awaited<ReturnType<typeof getGarageBillingProfile>> = null;

  try {
    order = await getOrder(session, id);
    [timeline, inspection, estimate, invoices, technicians, parts, garage] =
      await Promise.all([
        getOrderTimeline(session, id),
        getOrCreateInspection(session, id),
        getEstimateForOrder(session, id),
        getInvoicesForOrder(session, id),
        listAssignableTechnicians(session),
        listParts(session),
        getGarageBillingProfile(session),
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

  const canBill =
    session.role === "OWNER" ||
    session.role === "MANAGER" ||
    session.role === "ACCOUNTANT";

  const billedEstimateLineIds = new Set<string>();
  for (const invoice of invoices) {
    for (const line of invoice.lines) {
      if (line.estimateLineId) {
        billedEstimateLineIds.add(line.estimateLineId);
      }
    }
  }

  const approvedLines =
    estimate.current?.lines.filter(
      (line) => line.approvalState === "APPROVED",
    ) ?? [];
  const unbilledApprovedLines = approvedLines.filter(
    (line) => !billedEstimateLineIds.has(line.id),
  );
  const hasApprovedEstimateLines = approvedLines.length > 0;
  const hasUnbilledApprovedLines = unbilledApprovedLines.length > 0;

  const approvedPreviewLines = unbilledApprovedLines.map((line) => {
    const amounts = computeLineGst(line);
    const typeKey =
      line.type === "PART" || line.type === "LABOUR" ? line.type : "LABOUR";
    return {
      id: line.id,
      description: line.description,
      typeLabel: te(`lineTypes.${typeKey}`),
      quantity: line.quantity,
      unitPricePaise: line.unitPricePaise,
      taxablePaise: amounts.taxablePaise,
      taxPaise: amounts.gstPaise,
      totalPaise: amounts.totalPaise,
    };
  });

  const approvedTaxablePaise = approvedPreviewLines.reduce(
    (sum, line) => sum + line.taxablePaise,
    0,
  );
  const approvedTaxPaise = approvedPreviewLines.reduce(
    (sum, line) => sum + line.taxPaise,
    0,
  );
  const approvedTotalPaise = approvedPreviewLines.reduce(
    (sum, line) => sum + line.totalPaise,
    0,
  );

  const placeCode = order.vehicle.stateCode || "24";
  let placeLabel = placeCode;
  try {
    placeLabel = `${tGst(`states.${placeCode}`)} (${placeCode})`;
  } catch {
    placeLabel = placeCode;
  }

  const initialSection = isJobCardSection(sectionParam)
    ? sectionParam
    : "details";

  return (
    <main className="w-full max-w-none space-y-4">
      <Link
        href="/orders"
        className="inline-flex h-5 max-h-5 items-center gap-0.5 px-0.5 text-[13px] leading-5 text-muted-foreground hover:text-blue-700"
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
        billingContent={
          <JobCardBillingContent
            orderId={order.id}
            canEdit={canBill}
            invoices={invoices}
            hasApprovedEstimateLines={hasApprovedEstimateLines}
            hasUnbilledApprovedLines={hasUnbilledApprovedLines}
            defaultPlaceOfSupplyStateCode={order.vehicle.stateCode}
            preview={{
              garageName: garage?.name ?? t("title"),
              garageAddress: garage?.address ?? null,
              garageGstin: garage?.gstin ?? null,
              customerName: order.customer.name,
              customerPhone: order.customer.phone,
              vehicleRegistration: order.vehicle.registrationNumber,
              vehicleLabel:
                `${order.vehicle.make} ${order.vehicle.model}`.trim(),
              jobLabel: t("detailsTitle"),
              placeOfSupplyLabel: `${tb("placeOfSupply")}: ${placeLabel}`,
              approvedLines: approvedPreviewLines,
              approvedTaxablePaise,
              approvedTaxPaise,
              approvedTotalPaise,
              approvedTaxLabel: te("gstShort"),
            }}
          />
        }
      />
    </main>
  );
}
