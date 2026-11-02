import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { homePathForRole } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { JobSlipsBoard } from "@/modules/job-slips/components/job-slips-board";
import { listJobSlips } from "@/modules/job-slips/service";
import type { ServiceOrderStatusValue } from "@/modules/service-orders/schema";

export const instant = false;

export default async function JobSlipsPage() {
  const session = await requireSession();
  if (session.role === "TECHNICIAN") {
    redirect(homePathForRole(session.role));
  }

  const t = await getTranslations("jobSlips");
  const orders = await listJobSlips(session);

  const slips = orders.map((order) => {
    const status = order.status as ServiceOrderStatusValue;
    const needsPricing =
      status !== "COMPLETED" &&
      order.lines.some(
        (line) =>
          line.type === "PART" &&
          line.unitPricePaise === 0 &&
          Boolean(line.partId) &&
          (line.part?.sellingPricePaise ?? 0) <= 0,
      );

    return {
      id: order.id,
      status,
      needsPricing,
      complaint: order.complaint,
      bay: order.bay,
      createdAt: order.createdAt.toISOString(),
      expectedCompletion: order.expectedCompletion?.toISOString() ?? null,
      vehicle: {
        registrationNumber: order.vehicle.registrationNumber,
        make: order.vehicle.make,
        model: order.vehicle.model,
      },
      customer: {
        name: order.customer.name,
        phone: order.customer.phone,
      },
      technician: order.technician,
      technicianAssignments: order.technicianAssignments,
      lines: order.lines.map((line) => ({
        id: line.id,
        type: line.type as "LABOUR" | "PART",
        description: line.description,
        quantity: line.quantity,
      })),
    };
  });

  return (
    <main className="space-y-4 sm:space-y-5">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <JobSlipsBoard slips={slips} />
    </main>
  );
}
