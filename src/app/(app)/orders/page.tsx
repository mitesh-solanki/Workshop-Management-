import Link from "next/link";
import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { requireSession } from "@/lib/session";
import { OrdersTable } from "@/modules/service-orders/components/orders-table";
import { listOrders } from "@/modules/service-orders/service";

export const instant = false;

export default async function OrdersPage() {
  const session = await requireSession();
  const t = await getTranslations("orders");
  const orders = await listOrders(session);
  const canWrite =
    session.role === "OWNER" ||
    session.role === "MANAGER" ||
    session.role === "TECHNICIAN";
  const canDelete =
    session.role === "OWNER" || session.role === "MANAGER";
  const canCreate =
    session.role === "OWNER" || session.role === "MANAGER";
  const showNeedsPricing =
    session.role === "OWNER" || session.role === "MANAGER";

  const createAction = canCreate ? (
    <Button asChild size="md">
      <Link href="/orders/new">
        <Plus className="size-4" aria-hidden />
        {t("createShort")}
      </Link>
    </Button>
  ) : undefined;

  return (
    <main className="space-y-6 sm:space-y-8">
      <PageHeader
        title={t("title")}
        description={
          session.role === "TECHNICIAN" ? t("subtitleTechnician") : t("subtitle")
        }
        actions={createAction}
      />

      <OrdersTable
        canWrite={canWrite}
        canDelete={canDelete}
        showNeedsPricing={showNeedsPricing}
        orders={orders.map((order) => ({
          id: order.id,
          customerId: order.customerId,
          status: order.status,
          complaint: order.complaint,
          bay: order.bay,
          createdAt: order.createdAt,
          expectedCompletion: order.expectedCompletion,
          needsPricing:
            showNeedsPricing &&
            order.status !== "COMPLETED" &&
            order.lines.length > 0,
          vehicle: {
            registrationNumber: order.vehicle.registrationNumber,
            make: order.vehicle.make,
            model: order.vehicle.model,
          },
          customer: { name: order.customer.name },
          technician: order.technician
            ? {
                name: order.technician.name,
                email: order.technician.email,
              }
            : null,
          technicianAssignments: order.technicianAssignments,
        }))}
        emptyAction={createAction}
      />
    </main>
  );
}
