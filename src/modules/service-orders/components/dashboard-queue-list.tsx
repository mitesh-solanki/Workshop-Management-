import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { StatusBadge } from "@/components/ui/status-badge";
import type { ServiceOrderStatus } from "@/lib/service-order-status";
import { cn } from "@/lib/utils";

export type DashboardQueueOrder = {
  id: string;
  jobCardNumber: number;
  status: ServiceOrderStatus;
  expectedCompletion: Date | string | null;
  vehicle: { registrationNumber: string; make: string; model: string };
  customer: { name: string };
};

type Props = {
  orders: DashboardQueueOrder[];
  emptyTitle: string;
  emptyDescription: string;
  showDue?: boolean;
  limit?: number;
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
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

function isOverdue(value: Date | string | null): boolean {
  if (!value) {
    return false;
  }
  const date = value instanceof Date ? value : new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}

export async function DashboardQueueList({
  orders,
  emptyTitle,
  emptyDescription,
  showDue = true,
  limit = 3,
}: Props) {
  const tOrders = await getTranslations("orders");
  const locale = await getLocale();
  const visible = orders.slice(0, limit);

  if (orders.length === 0) {
    return (
      <div className="flex flex-1 flex-col justify-center px-4 py-6 text-center sm:px-5">
        <p className="text-sm font-semibold text-slate-800">{emptyTitle}</p>
        <p className="mt-1 text-sm text-slate-500">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {visible.map((order) => {
        const overdue =
          order.status !== "COMPLETED" && isOverdue(order.expectedCompletion);
        const dueLabel = showDue
          ? formatDue(
              order.expectedCompletion,
              locale,
              tOrders("dueNone"),
            )
          : null;
        return (
          <li key={order.id}>
            <Link
              href={`/orders/${order.id}`}
              className="flex min-h-12 items-center justify-between gap-3 px-3.5 py-2.5 transition-colors hover:bg-slate-50/80 sm:px-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-baseline gap-2">
                  <p className="truncate text-base font-semibold text-slate-900">
                    {order.vehicle.registrationNumber}
                  </p>
                  <p className="shrink-0 font-mono text-sm font-semibold text-slate-500">
                    {tOrders("jobCardNumberShort", {
                      number: order.jobCardNumber,
                    })}
                  </p>
                </div>
                <p
                  className={cn(
                    "mt-0.5 truncate text-sm text-slate-600",
                    overdue && "text-amber-800",
                  )}
                >
                  {order.customer.name}
                  {dueLabel ? (
                    <>
                      <span className="text-slate-300"> · </span>
                      <span className={overdue ? "font-medium" : undefined}>
                        {dueLabel}
                      </span>
                    </>
                  ) : null}
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
    </ul>
  );
}
