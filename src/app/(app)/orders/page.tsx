import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireSession } from "@/lib/session";
import { listOrders } from "@/modules/service-orders/service";

export const instant = false;

export default async function OrdersPage() {
  const session = await requireSession();
  const t = await getTranslations("orders");
  const orders = await listOrders(session);

  return (
    <main className="space-y-6">
      <PageHeader
        title={t("title")}
        description={
          session.role === "TECHNICIAN" ? t("subtitleTechnician") : t("subtitle")
        }
      />

      {orders.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={t("emptyTitle")}
          description={t("empty")}
        />
      ) : (
        <ul className="divide-y rounded-md border">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/orders/${order.id}`}
                className="flex min-h-14 flex-col gap-1 px-3 py-3 hover:bg-secondary/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">
                    {order.vehicle.registrationNumber}
                  </p>
                  <span className="shrink-0 text-xs font-medium text-muted-foreground">
                    {t(`statuses.${order.status}`)}
                  </span>
                </div>
                <p className="truncate text-sm text-muted-foreground">
                  {order.customer.name} · {order.complaint}
                </p>
                {order.technician && (
                  <p className="text-xs text-muted-foreground">
                    {t("technician")}:{" "}
                    {order.technician.name?.trim() || order.technician.email}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
