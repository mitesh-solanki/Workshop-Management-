import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Package,
  PackageSearch,
  Plus,
  Search,
  UserPlus,
  Wrench,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard, type StatCardTone } from "@/components/ui/stat-card";
import {
  SERVICE_ORDER_STATUSES,
  type ServiceOrderStatus,
} from "@/lib/service-order-status";
import { requireSession } from "@/lib/session";
import { getGarageSettings } from "@/modules/settings/service";

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
  const tStatus = await getTranslations("orders.status");

  const displayName = session.name ?? session.email;
  const isTechnician = session.role === "TECHNICIAN";
  const isAccountant = session.role === "ACCOUNTANT";
  const canCreateWorkshop =
    session.role === "OWNER" || session.role === "MANAGER";

  const todayLabel = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const statusCounts: Record<ServiceOrderStatus, number> = {
    WAITING: 0,
    INSPECTION: 0,
    IN_PROGRESS: 0,
    WAITING_FOR_PARTS: 0,
    READY: 0,
    COMPLETED: 0,
  };
  const overdueCount = 0;

  if (isTechnician) {
    return (
      <main className="space-y-6">
        <header className="space-y-1">
          <p className="text-caption font-medium tracking-wide text-slate-500 uppercase">
            {garage.name}
          </p>
          <h1 className="text-page-title text-slate-900">
            {t("greeting", { name: displayName })}
          </h1>
          <p className="text-body text-slate-600">{todayLabel}</p>
        </header>

        <section className="space-y-3" aria-labelledby="my-jobs-heading">
          <h2 id="my-jobs-heading" className="text-section-title text-slate-900">
            {t("myJobs")}
          </h2>
          <EmptyState
            compact
            icon={ClipboardList}
            title={t("myJobsEmptyTitle")}
            description={t("myJobsEmptyDescription")}
            action={
              <Button asChild variant="secondary" size="sm">
                <Link href="/orders">{t("viewOrders")}</Link>
              </Button>
            }
          />
        </section>
      </main>
    );
  }

  return (
    <main className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary" size="md">
              <Link href="/customers/new">
                <UserPlus className="size-4" aria-hidden />
                {t("newCustomer")}
              </Link>
            </Button>
            <Button asChild size="md">
              <Link href="/orders">
                <Plus className="size-4" aria-hidden />
                {t("newOrder")}
              </Link>
            </Button>
          </div>
        ) : null}
      </header>

      {!isAccountant ? (
        <section
          className="space-y-3"
          aria-labelledby="orders-by-status-heading"
        >
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2
              id="orders-by-status-heading"
              className="text-section-title text-slate-900"
            >
              {t("ordersByStatus")}
            </h2>
            <p className="text-caption text-slate-500">
              {t("countsPlaceholder")}
            </p>
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

      <section className="grid gap-6 lg:grid-cols-2">
        {!isAccountant ? (
          <div className="space-y-3">
            <h2 className="text-section-title text-slate-900">
              {t("dueToday")}
            </h2>
            <EmptyState
              compact
              icon={ClipboardList}
              title={t("dueTodayEmptyTitle")}
              description={t("dueTodayEmptyDescription")}
              action={
                canCreateWorkshop ? (
                  <Button asChild size="sm">
                    <Link href="/orders">
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
          </div>
        ) : null}

        <div className="space-y-3">
          <h2 className="text-section-title text-slate-900">{t("lowStock")}</h2>
          <EmptyState
            compact
            icon={Package}
            title={t("lowStockEmptyTitle")}
            description={t("lowStockEmptyDescription")}
            action={
              <Button variant="secondary" size="sm" disabled>
                {t("manageStockSoon")}
              </Button>
            }
          />
        </div>
      </section>
    </main>
  );
}
