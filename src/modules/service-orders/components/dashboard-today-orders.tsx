import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { StatusBadge } from "@/components/ui/status-badge";
import type { ServiceOrderStatus } from "@/lib/service-order-status";
import { cn } from "@/lib/utils";

type TodayOrder = {
  id: string;
  status: ServiceOrderStatus;
  expectedCompletion: Date | string | null;
  vehicle: { registrationNumber: string; make: string; model: string };
  customer: { name: string };
};

type Props = {
  orders: TodayOrder[];
};

function formatDue(
  value: Date | string | null,
  locale: string,
  empty: string,
): string {
  if (!value) {
    return empty;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return empty;
  }
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function isOverdue(value: Date | string | null): boolean {
  if (!value) {
    return false;
  }
  const date = value instanceof Date ? value : new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}

export async function DashboardTodayOrders({ orders }: Props) {
  const t = await getTranslations("dashboard");
  const tOrders = await getTranslations("orders");
  const locale = await getLocale();

  return (
    <ul className="divide-y divide-slate-200 overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-[0_3px_17px_rgba(36,58,99,0.06)]">
      {orders.map((order) => {
        const overdue =
          order.status !== "COMPLETED" && isOverdue(order.expectedCompletion);
        return (
          <li key={order.id}>
            <Link
              href={`/orders/${order.id}`}
              className="flex min-h-14 items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-slate-50 sm:px-5"
            >
              <div className="min-w-0 space-y-1">
                <p className="truncate text-[15px] font-semibold text-slate-900">
                  {order.vehicle.registrationNumber}
                </p>
                <p className="truncate text-[13px] text-slate-600">
                  {order.customer.name}
                  <span className="text-slate-300"> · </span>
                  {`${order.vehicle.make} ${order.vehicle.model}`.trim()}
                </p>
                <p
                  className={cn(
                    "text-[12px] text-slate-500",
                    overdue && "font-medium text-amber-700",
                  )}
                >
                  {`${tOrders("columns.dueDate")}: ${formatDue(
                    order.expectedCompletion,
                    locale,
                    tOrders("dueNone"),
                  )}`}
                </p>
              </div>
              <StatusBadge
                status={order.status}
                label={tOrders(`statuses.${order.status}`)}
                className="shrink-0"
              />
            </Link>
          </li>
        );
      })}
      {orders.length >= 25 ? (
        <li className="px-4 py-3 text-center text-[13px] text-slate-600 sm:px-5">
          <Link
            href="/orders"
            className="font-medium text-blue-700 underline-offset-4 hover:underline"
          >
            {t("viewOrders")}
          </Link>
        </li>
      ) : null}
    </ul>
  );
}
