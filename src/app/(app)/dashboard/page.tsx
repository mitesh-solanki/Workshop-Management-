import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { formatRupees } from "@/lib/money";
import { homePathForRole } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { getDashboardPaymentsReceivedToday } from "@/modules/billing/service";
import { getLowStockAlerts } from "@/modules/inventory/service";
import { DashboardHome } from "@/modules/service-orders/components/dashboard-home";
import {
  getDashboardOrderCounts,
  listDashboardDueSoonOrders,
  listDashboardNeedsPricingOrders,
  listDashboardReadyOrders,
} from "@/modules/service-orders/service";

/** Auth session uses request-time crypto — do not prerender this route. */
export const instant = false;

export default async function DashboardPage() {
  const session = await requireSession();
  if (session.role === "TECHNICIAN") {
    redirect(homePathForRole(session.role));
  }
  const locale = await getLocale();

  const displayName = session.name ?? session.email;
  const isAccountant = session.role === "ACCOUNTANT";
  const canCreateWorkshop =
    session.role === "OWNER" || session.role === "MANAGER";
  const canManageStock = canCreateWorkshop;
  const showOrderStats = !isAccountant;

  const lowStock = await getLowStockAlerts(session);
  const [
    orderCounts,
    dueSoonOrders,
    needsPricingOrders,
    readyOrders,
    receivedTodayPaise,
  ] = await Promise.all([
    showOrderStats ? getDashboardOrderCounts(session) : Promise.resolve(null),
    showOrderStats
      ? listDashboardDueSoonOrders(session)
      : Promise.resolve([]),
    showOrderStats
      ? listDashboardNeedsPricingOrders(session)
      : Promise.resolve([]),
    showOrderStats ? listDashboardReadyOrders(session) : Promise.resolve([]),
    getDashboardPaymentsReceivedToday(session),
  ]);
  const statusCounts = orderCounts?.statusCounts ?? {
    WAITING: 0,
    INSPECTION: 0,
    IN_PROGRESS: 0,
    WAITING_FOR_PARTS: 0,
    READY: 0,
    COMPLETED: 0,
  };
  const overdueCount = orderCounts?.overdueCount ?? 0;
  const receivedTodayLabel = formatRupees(receivedTodayPaise, locale);

  return (
    <DashboardHome
      displayName={displayName}
      isAccountant={isAccountant}
      canCreateWorkshop={canCreateWorkshop}
      canManageStock={canManageStock}
      showOrderStats={showOrderStats}
      statusCounts={statusCounts}
      overdueCount={overdueCount}
      receivedTodayLabel={receivedTodayLabel}
      receivedTodayPaise={receivedTodayPaise}
      dueSoonOrders={dueSoonOrders}
      needsPricingOrders={needsPricingOrders}
      readyOrders={readyOrders}
      lowStock={lowStock}
    />
  );
}
