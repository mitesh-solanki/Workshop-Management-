import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { listOrders } from "@/modules/service-orders/service";

export default async function OrdersPage() {
  const session = await requireSession();
  const t = await getTranslations("orders");
  const orders = await listOrders(session);

  return (
    <main className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-base text-muted-foreground">
          {session.role === "TECHNICIAN" ? t("subtitleTechnician") : t("subtitle")}
        </p>
      </div>

      {orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
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
