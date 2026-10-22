import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { requireSession } from "@/lib/session";
import { WorkshopBoard } from "@/modules/service-orders/components/workshop-board";
import {
  getBayOccupancy,
  listBoardTechnicians,
  listOrders,
} from "@/modules/service-orders/service";
import type {
  ServiceOrderPriorityValue,
  ServiceOrderStatusValue,
} from "@/modules/service-orders/schema";

type Props = {
  searchParams: Promise<{ technicianId?: string; bay?: string }>;
};

export const instant = false;

export default async function WorkshopPage({ searchParams }: Props) {
  const session = await requireSession();
  const { technicianId: rawTechnicianId, bay: rawBay } = await searchParams;
  const selectedTechnicianId =
    session.role === "TECHNICIAN" ? "" : (rawTechnicianId?.trim() ?? "");
  const selectedBay = rawBay?.trim() ?? "";

  const t = await getTranslations("workshop");

  const filterOptions = {
    ...(selectedTechnicianId ? { technicianId: selectedTechnicianId } : {}),
  };

  const [orders, technicians, bays] = await Promise.all([
    listOrders(session, {
      ...filterOptions,
      ...(selectedBay ? { bay: selectedBay } : {}),
    }),
    listBoardTechnicians(session),
    // Occupancy chips stay visible for all bays under the technician scope.
    getBayOccupancy(session, filterOptions),
  ]);

  const canMutate =
    session.role === "OWNER" ||
    session.role === "MANAGER" ||
    session.role === "TECHNICIAN";

  const boardOrders = orders.map((order) => ({
    id: order.id,
    status: order.status as ServiceOrderStatusValue,
    priority: order.priority as ServiceOrderPriorityValue,
    expectedCompletion: order.expectedCompletion,
    bay: order.bay,
    vehicle: { registrationNumber: order.vehicle.registrationNumber },
    customer: { name: order.customer.name },
    technician: order.technician,
  }));

  return (
    <main className="space-y-4 sm:space-y-5">
      <PageHeader
        title={t("title")}
        description={
          session.role === "TECHNICIAN"
            ? t("subtitleTechnician")
            : t("subtitle")
        }
      />

      <WorkshopBoard
        orders={boardOrders}
        technicians={technicians}
        bays={bays}
        selectedTechnicianId={selectedTechnicianId}
        selectedBay={selectedBay}
        canFilterTechnicians={session.role !== "TECHNICIAN"}
        canMutate={canMutate && session.role !== "ACCOUNTANT"}
      />
    </main>
  );
}
