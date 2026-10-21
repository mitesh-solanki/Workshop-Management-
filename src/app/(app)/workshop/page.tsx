import { getTranslations } from "next-intl/server";
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
  searchParams: Promise<{ technicianId?: string }>;
};

export default async function WorkshopPage({ searchParams }: Props) {
  const session = await requireSession();
  const { technicianId: rawTechnicianId } = await searchParams;
  const selectedTechnicianId =
    session.role === "TECHNICIAN" ? "" : (rawTechnicianId?.trim() ?? "");

  const t = await getTranslations("workshop");

  const [orders, technicians, bays] = await Promise.all([
    listOrders(session, {
      ...(selectedTechnicianId ? { technicianId: selectedTechnicianId } : {}),
    }),
    listBoardTechnicians(session),
    getBayOccupancy(session, {
      ...(selectedTechnicianId ? { technicianId: selectedTechnicianId } : {}),
    }),
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
    <main className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-base text-muted-foreground">
          {session.role === "TECHNICIAN"
            ? t("subtitleTechnician")
            : t("subtitle")}
        </p>
      </div>

      <WorkshopBoard
        orders={boardOrders}
        technicians={technicians}
        bays={bays}
        selectedTechnicianId={selectedTechnicianId}
        canFilterTechnicians={session.role !== "TECHNICIAN"}
        canMutate={canMutate && session.role !== "ACCOUNTANT"}
      />
    </main>
  );
}
