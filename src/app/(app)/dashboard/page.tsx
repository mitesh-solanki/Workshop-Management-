import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Kanban,
  Package,
  PackageSearch,
  Plus,
  Search,
  UserPlus,
  Wrench,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard, type StatCardTone } from "@/components/ui/stat-card";
import {
  SERVICE_ORDER_STATUSES,
  type ServiceOrderStatus,
} from "@/lib/service-order-status";
import { requireSession } from "@/lib/session";
import { LowStockAlertList } from "@/modules/inventory/components/low-stock-alert-list";
import { getLowStockAlerts } from "@/modules/inventory/service";
import { getGarageSettings } from "@/modules/settings/service";
import { DashboardTodayOrders } from "@/modules/service-orders/components/dashboard-today-orders";
import {
  getDashboardOrderCounts,
  listDashboardTodayOrders,
} from "@/modules/service-orders/service";

/** Auth session uses request-time crypto — do not prerender this route. */
export const instant = false;

const STATUS_TONE: Record<ServiceOrderStatus, StatCardTone> = {
  WAITING: "waiting",
  INSPECTION: "inspection",
  IN_PROGRESS: "in-progress",
  WAITING_FOR_PARTS: "waiting-parts",
  READY: "ready",
  COMPLETED: "completed",
};

const STATUS_ICON = {
  WAITING: Clock,
  INSPECTION: Search,
  IN_PROGRESS: Wrench,
  WAITING_FOR_PARTS: PackageSearch,
  READY: CheckCircle2,
  COMPLETED: CheckCircle2,
} as const;

export default async function DashboardPage() {
  const session = await requireSession();
  const garage = await getGarageSettings(session);
  const locale = await getLocale();
  const t = await getTranslations("dashboard");
  const tn = await getTranslations("nav");
  const ti = await getTranslations("inventory");
  const tStatus = await getTranslations("orders.statuses");

  const displayName = session.name ?? session.email;
  const isTechnician = session.role === "TECHNICIAN";
  const isAccountant = session.role === "ACCOUNTANT";
  const canCreateWorkshop =
    session.role === "OWNER" || session.role === "MANAGER";
  const canManageStock =
    session.role === "OWNER" || session.role === "MANAGER";
  const showOrderStats = !isAccountant;
  const showLowStock = !isTechnician;

  const lowStock = showLowStock ? await getLowStockAlerts(session) : [];
  const [orderCounts, todayOrders] = showOrderStats
    ? await Promise.all([
        getDashboardOrderCounts(session),
        listDashboardTodayOrders(session),
      ])
    : [null, []];
  const statusCounts = orderCounts?.statusCounts ?? {
    WAITING: 0,
    INSPECTION: 0,
    IN_PROGRESS: 0,
    WAITING_FOR_PARTS: 0,
    READY: 0,
    COMPLETED: 0,
  };
  const overdueCount = orderCounts?.overdueCount ?? 0;

  const todayLabel = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <main className="w-full max-w-[1600px] space-y-8">
      <header className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:justify-between sm:text-left">
        <div className="min-w-0 space-y-1">
          <p className="text-caption font-medium tracking-wide text-slate-500 uppercase">
            {garage.name}
          </p>
          <h1 className="text-page-title text-slate-900">
            {t("greeting", { name: displayName })}
          </h1>
          <p className="text-body text-slate-600">{todayLabel}</p>
        </div>
        {canCreateWorkshop ? (
          <div className="flex flex-wrap justify-center gap-2 sm:justify-end">
            <Button asChild variant="secondary" size="md">
              <Link href="/customers/new">
                <UserPlus className="size-4" aria-hidden />
                {t("newCustomer")}
              </Link>
            </Button>
            <Button asChild size="md">
              <Link href="/orders/new">
                <Plus className="size-4" aria-hidden />
                {t("newOrder")}
              </Link>
            </Button>
          </div>
        ) : isTechnician ? (
          <div className="flex flex-wrap justify-center gap-2 sm:justify-end">
            <Button asChild variant="secondary" size="md">
              <Link href="/workshop">
                <Kanban className="size-4" aria-hidden />
                {tn("workshop")}
              </Link>
            </Button>
            <Button asChild size="md">
              <Link href="/orders">
                <ClipboardList className="size-4" aria-hidden />
                {t("viewOrders")}
              </Link>
            </Button>
          </div>
        ) : null}
      </header>

      {showOrderStats ? (
        <section
          className="space-y-3"
          aria-labelledby="orders-by-status-heading"
        >
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2
              id="orders-by-status-heading"
              className="text-section-title text-slate-900"
            >
              {isTechnician ? t("myOrdersByStatus") : t("ordersByStatus")}
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {SERVICE_ORDER_STATUSES.map((status) => {
              const count = statusCounts[status];
              const emphasize =
                status === "WAITING_FOR_PARTS" && count > 0;
              return (
                <StatCard
                  key={status}
                  title={tStatus(status)}
                  value={count}
                  icon={STATUS_ICON[status]}
                  tone={STATUS_TONE[status]}
                  emphasize={emphasize}
                />
              );
            })}
            <StatCard
              title={t("overdue")}
              value={overdueCount}
              icon={AlertTriangle}
              tone="danger"
              emphasize={overdueCount > 0}
            />
          </div>
        </section>
      ) : null}

      <section
        className={
          showLowStock ? "grid gap-6 lg:grid-cols-2" : "grid gap-6"
        }
      >
        {showOrderStats ? (
          <div className="space-y-3">
            <h2 className="text-section-title text-slate-900">
              {isTechnician ? t("myDueToday") : t("dueToday")}
            </h2>
            {todayOrders.length === 0 ? (
              <EmptyState
                compact
                icon={ClipboardList}
                title={t("dueTodayEmptyTitle")}
                description={
                  isTechnician
                    ? t("dueTodayEmptyTechnician")
                    : t("dueTodayEmptyDescription")
                }
                action={
                  canCreateWorkshop ? (
                    <Button asChild size="sm">
                      <Link href="/orders/new">
                        <Plus className="size-4" aria-hidden />
                        {t("newOrder")}
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild variant="secondary" size="sm">
                      <Link href="/orders">{t("viewOrders")}</Link>
                    </Button>
                  )
                }
              />
            ) : (
              <DashboardTodayOrders orders={todayOrders} />
            )}
          </div>
        ) : null}

        {showLowStock ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-section-title text-slate-900">
                  {t("lowStock")}
                </h2>
                {lowStock.length > 0 ? (
                  <Badge variant="warning">{lowStock.length}</Badge>
                ) : null}
              </div>
              {canManageStock ? (
                <Button asChild size="sm">
                  <Link href="/inventory">{ti("title")}</Link>
                </Button>
              ) : null}
            </div>
            {lowStock.length === 0 ? (
              <EmptyState
                compact
                icon={Package}
                title={t("lowStockEmptyTitle")}
                description={t("lowStockEmptyDescription")}
              />
            ) : (
              <LowStockAlertList
                parts={lowStock}
                canRequest={canManageStock}
                requestLabel={t("requestPart")}
              />
            )}
          </div>
        ) : null}
      </section>
    </main>
  );
}
