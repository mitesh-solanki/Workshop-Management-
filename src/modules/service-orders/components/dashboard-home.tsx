import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  ClipboardList,
  FileText,
  Kanban,
  Package,
  Plus,
  UserPlus,
  Wallet,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ServiceOrderStatus } from "@/lib/service-order-status";
import { LowStockAlertList } from "@/modules/inventory/components/low-stock-alert-list";
import {
  DashboardQueueList,
  type DashboardQueueOrder,
} from "@/modules/service-orders/components/dashboard-queue-list";

type LowStockPart = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  quantityOnHand: number;
  lowStockLevel: number;
};

type Props = {
  displayName: string;
  isAccountant: boolean;
  canCreateWorkshop: boolean;
  canManageStock: boolean;
  showOrderStats: boolean;
  statusCounts: Record<ServiceOrderStatus, number>;
  overdueCount: number;
  receivedTodayLabel: string;
  receivedTodayPaise: number;
  dueSoonOrders: DashboardQueueOrder[];
  needsPricingOrders: DashboardQueueOrder[];
  readyOrders: DashboardQueueOrder[];
  lowStock: LowStockPart[];
};

function FloorMeter({
  href,
  value,
  label,
  hint,
  accentClass,
  active,
  compactValue = false,
}: {
  href: string;
  value: number | string;
  label: string;
  hint: string;
  accentClass: string;
  active: boolean;
  compactValue?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex min-h-22 flex-col justify-between overflow-hidden rounded-lg border bg-white px-4 py-3 transition",
        "hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/35",
        active ? "border-slate-300 shadow-sm" : "border-slate-200",
      )}
    >
      <span
        className={cn("absolute inset-y-0 left-0 w-1", accentClass)}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-2 pl-2">
        <p
          className={cn(
            "font-semibold tracking-tight tabular-nums",
            compactValue
              ? "text-xl sm:text-2xl"
              : "text-3xl sm:text-[2rem]",
            active ? "text-slate-900" : "text-slate-400",
          )}
        >
          {value}
        </p>
        <ArrowUpRight
          className="size-4 shrink-0 text-slate-300 transition group-hover:text-blue-600"
          aria-hidden
        />
      </div>
      <div className="pl-2">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <p className="mt-0.5 text-xs leading-snug text-slate-500">{hint}</p>
      </div>
    </Link>
  );
}

function LaneHeader({
  title,
  hint,
  count,
  href,
  viewLabel,
  accentClass,
}: {
  title: string;
  hint: string;
  count: number;
  href: string;
  viewLabel: string;
  accentClass: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 shrink-0 rounded-full", accentClass)} />
          <h2 className="truncate text-sm font-semibold text-slate-900">
            {title}
          </h2>
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-700">
            {count}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
      </div>
      <Link
        href={href}
        className="shrink-0 text-sm font-semibold text-blue-700 hover:underline"
      >
        {viewLabel}
      </Link>
    </div>
  );
}

function QuickActionLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Kanban;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-blue-300 hover:bg-blue-50/60"
    >
      <span className="flex min-w-0 items-center gap-2">
        <Icon className="size-4 shrink-0 text-blue-700" aria-hidden />
        <span className="truncate">{label}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-slate-400" aria-hidden />
    </Link>
  );
}

export async function DashboardHome({
  displayName,
  isAccountant,
  canCreateWorkshop,
  canManageStock,
  showOrderStats,
  statusCounts,
  overdueCount,
  receivedTodayLabel,
  receivedTodayPaise,
  dueSoonOrders,
  needsPricingOrders,
  readyOrders,
  lowStock,
}: Props) {
  const t = await getTranslations("dashboard");
  const ti = await getTranslations("inventory");
  const tStatus = await getTranslations("orders.statuses");

  const openJobs =
    statusCounts.WAITING +
    statusCounts.INSPECTION +
    statusCounts.IN_PROGRESS +
    statusCounts.WAITING_FOR_PARTS +
    statusCounts.READY;

  const attentionCount =
    overdueCount +
    needsPricingOrders.length +
    statusCounts.READY +
    lowStock.length;

  const summary = showOrderStats
    ? attentionCount > 0
      ? t("summaryNeedsAttention", { count: attentionCount })
      : openJobs > 0
        ? t("summaryWorkshopOpen", { count: openJobs })
        : t("summaryAllClear")
    : t("summaryAccountant");

  return (
    <main className="w-full max-w-[1600px] space-y-5 sm:space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            {t("greeting", { name: displayName })}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">{summary}</p>
        </div>
        {canCreateWorkshop ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button asChild variant="secondary" size="md">
              <Link href="/customers?create=1">
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
        ) : null}
      </header>

      {showOrderStats ? (
        <section
          aria-label={t("floorMetersLabel")}
          className="grid grid-cols-2 gap-2.5 lg:grid-cols-4"
        >
          <FloorMeter
            href="/orders?due=overdue"
            value={overdueCount}
            label={t("overdue")}
            hint={
              overdueCount > 0 ? t("overdueHelper") : t("overdueHelperClear")
            }
            accentClass="bg-red-500"
            active={overdueCount > 0}
          />
          <FloorMeter
            href="/orders?status=WAITING_FOR_PARTS"
            value={statusCounts.WAITING_FOR_PARTS}
            label={t("partsRequired")}
            hint={t("partsRequiredHelper")}
            accentClass="bg-amber-500"
            active={statusCounts.WAITING_FOR_PARTS > 0}
          />
          <FloorMeter
            href="/orders?status=IN_PROGRESS"
            value={statusCounts.IN_PROGRESS}
            label={tStatus("IN_PROGRESS")}
            hint={t("inProgressHint")}
            accentClass="bg-blue-600"
            active={statusCounts.IN_PROGRESS > 0}
          />
          <FloorMeter
            href="/invoices"
            value={receivedTodayLabel}
            label={t("receivedToday")}
            hint={t("receivedTodayHelper")}
            accentClass="bg-emerald-600"
            active={receivedTodayPaise > 0}
            compactValue
          />
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <FloorMeter
            href="/invoices"
            value={receivedTodayLabel}
            label={t("receivedToday")}
            hint={t("receivedTodayHelper")}
            accentClass="bg-emerald-600"
            active={receivedTodayPaise > 0}
            compactValue
          />
        </section>
      )}

      {showOrderStats ? (
        <section aria-label={t("floorLanesLabel")} className="space-y-2">
          <h2 className="px-0.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            {t("floorLanesLabel")}
          </h2>
          <div className="grid gap-3 xl:grid-cols-3">
            <article className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
              <LaneHeader
                title={t("dueSoon")}
                hint={t("dueSoonHint")}
                count={dueSoonOrders.length}
                href="/orders?due=soon"
                viewLabel={t("viewFiltered")}
                accentClass="bg-slate-700"
              />
              <DashboardQueueList
                orders={dueSoonOrders}
                emptyTitle={t("dueSoonEmptyTitle")}
                emptyDescription={t("dueSoonEmptyDescription")}
                limit={3}
              />
            </article>

            <article className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
              <LaneHeader
                title={t("needsPricing")}
                hint={t("needsPricingHint")}
                count={needsPricingOrders.length}
                href="/orders?status=NEEDS_PRICING"
                viewLabel={t("viewFiltered")}
                accentClass="bg-rose-500"
              />
              <DashboardQueueList
                orders={needsPricingOrders}
                emptyTitle={t("needsPricingEmptyTitle")}
                emptyDescription={t("needsPricingEmptyDescription")}
                limit={3}
              />
            </article>

            <article className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
              <LaneHeader
                title={t("readyToDeliver")}
                hint={t("readyLaneHint")}
                count={readyOrders.length}
                href="/orders?status=READY"
                viewLabel={t("viewFiltered")}
                accentClass="bg-teal-600"
              />
              <DashboardQueueList
                orders={readyOrders}
                emptyTitle={t("readyLaneEmptyTitle")}
                emptyDescription={t("readyLaneEmptyDescription")}
                showDue={false}
                limit={3}
              />
            </article>
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-slate-200 bg-white px-4 py-5 sm:px-5">
          <h2 className="text-sm font-semibold text-slate-900">
            {t("accountantTitle")}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            {t("accountantBody")}
          </p>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold">
            <Link href="/invoices" className="text-blue-700 hover:underline">
              {t("goInvoices")}
            </Link>
            <Link href="/vendor-bills" className="text-blue-700 hover:underline">
              {t("goVendorBills")}
            </Link>
            <Link href="/customers" className="text-blue-700 hover:underline">
              {t("goCustomers")}
            </Link>
          </div>
        </section>
      )}

      <div className="grid items-stretch gap-3 xl:grid-cols-3">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white xl:col-span-2">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900">
                {t("lowStock")}
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {t("lowStockSectionHint")}
              </p>
            </div>
            <Link
              href="/inventory?stock=low"
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-blue-700 hover:underline"
            >
              {ti("title")}
              <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          </div>
          <div className="p-4 sm:p-5">
            {lowStock.length === 0 ? (
              <div className="flex items-start gap-3 text-sm text-slate-600">
                <Package
                  className="mt-0.5 size-4 shrink-0 text-slate-400"
                  aria-hidden
                />
                <div>
                  <p className="font-semibold text-slate-800">
                    {t("lowStockEmptyTitle")}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {t("lowStockEmptyDescription")}
                  </p>
                </div>
              </div>
            ) : (
              <LowStockAlertList
                parts={lowStock}
                canRequest={canManageStock}
                requestLabel={t("requestPart")}
                limit={3}
              />
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
            <h2 className="text-sm font-semibold text-slate-900">
              {t("quickActions")}
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {t("quickActionsHint")}
            </p>
          </div>
          <div className="flex flex-col gap-2 p-4 sm:p-5">
            {isAccountant ? (
              <>
                <QuickActionLink
                  href="/invoices"
                  icon={FileText}
                  label={t("goInvoices")}
                />
                <QuickActionLink
                  href="/vendor-bills"
                  icon={Wallet}
                  label={t("goVendorBills")}
                />
                <QuickActionLink
                  href="/inventory"
                  icon={Package}
                  label={ti("title")}
                />
              </>
            ) : (
              <>
                <QuickActionLink
                  href="/workshop"
                  icon={Kanban}
                  label={t("goBoard")}
                />
                <QuickActionLink
                  href="/orders"
                  icon={ClipboardList}
                  label={t("goOrders")}
                />
                <QuickActionLink
                  href="/customers"
                  icon={UserPlus}
                  label={t("goCustomers")}
                />
                <QuickActionLink
                  href="/inventory"
                  icon={Package}
                  label={ti("title")}
                />
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
