import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { IndianRupee, Plus } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { TableSpinner } from "@/components/shared/page-spinner";
import { ForbiddenError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { AdvancesTable } from "@/modules/payroll/components/advances-table";
import { BonusesTable } from "@/modules/payroll/components/bonuses-table";
import { MoneyEntryModal } from "@/modules/payroll/components/money-entry-modal";
import { PayrollManagement } from "@/modules/payroll/components/payroll-management";
import { currentYearMonth } from "@/modules/payroll/date";
import {
  getPayrollManagement,
  listPayrollAdvances,
  listPayrollBonuses,
} from "@/modules/payroll/service";

type Props = {
  searchParams: Promise<{
    tab?: string;
    month?: string;
    member?: string;
    status?: string;
    q?: string;
    create?: string;
  }>;
};

export const instant = false;

export default async function PayrollPage({ searchParams }: Props) {
  const session = await requireSession();
  const params = await searchParams;
  const t = await getTranslations("payroll");

  const tab =
    params.tab === "bonuses" || params.tab === "advances"
      ? params.tab
      : "payroll";
  const monthParam = params.month?.trim() ?? "";
  const yearMonth =
    monthParam === "all"
      ? "all"
      : /^\d{4}-\d{2}$/.test(monthParam)
        ? monthParam
        : tab === "payroll"
          ? "all"
          : currentYearMonth();
  const addMonth =
    yearMonth !== "all" && /^\d{4}-\d{2}$/.test(yearMonth)
      ? yearMonth
      : currentYearMonth();

  if (params.create === "1" && tab === "payroll") {
    redirect(`/payroll/new?month=${addMonth}`);
  }

  const status =
    params.status === "DRAFT" || params.status === "PAID"
      ? params.status
      : "ALL";
  const searchQuery = params.q?.trim() || "";
  const memberId = params.member?.trim() || "";
  const createOpen = params.create === "1";

  let payrollData: Awaited<ReturnType<typeof getPayrollManagement>> | null =
    null;
  let bonusesData: Awaited<ReturnType<typeof listPayrollBonuses>> | null = null;
  let advancesData: Awaited<ReturnType<typeof listPayrollAdvances>> | null =
    null;
  let forbidden = false;

  try {
    if (tab === "bonuses") {
      bonusesData = await listPayrollBonuses(session, {
        yearMonth: addMonth,
        memberId,
      });
    } else if (tab === "advances") {
      advancesData = await listPayrollAdvances(session, {
        yearMonth: addMonth,
        memberId,
      });
    } else {
      payrollData = await getPayrollManagement(session, {
        yearMonth,
        status,
      });
    }
  } catch (e) {
    if (e instanceof ForbiddenError) {
      forbidden = true;
    } else {
      throw e;
    }
  }

  const members =
    payrollData?.members ??
    bonusesData?.members ??
    advancesData?.members ??
    [];

  if (forbidden) {
    return (
      <main className="space-y-6 sm:space-y-8">
        <PageHeader title={t("title")} description={t("subtitle")} />
        <EmptyState
          icon={IndianRupee}
          title={t("forbiddenTitle")}
          description={t("forbidden")}
        />
      </main>
    );
  }

  const title =
    tab === "bonuses"
      ? t("bonusesTitle")
      : tab === "advances"
        ? t("advancesTitle")
        : t("title");
  const description =
    tab === "bonuses"
      ? t("bonusesSubtitle")
      : tab === "advances"
        ? t("advancesSubtitle")
        : t("subtitleSalary");

  return (
    <main className="space-y-6 sm:space-y-8">
      <PageHeader
        title={title}
        description={description}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <MoneyEntryModal
              kind="bonus"
              members={members}
              variant="outline"
              defaultOpen={createOpen && tab === "bonuses"}
            />
            <MoneyEntryModal
              kind="advance"
              members={members}
              variant="outline"
              defaultOpen={createOpen && tab === "advances"}
            />
            <Button asChild size="md" className="min-h-11 gap-2">
              <Link href={`/payroll/new?month=${addMonth}`}>
                <Plus className="size-4" aria-hidden />
                {t("addPayroll")}
              </Link>
            </Button>
          </div>
        }
      />
      <Suspense fallback={<TableSpinner />}>
        {tab === "bonuses" && bonusesData ? (
          <BonusesTable
            yearMonth={bonusesData.yearMonth}
            searchQuery={searchQuery}
            members={bonusesData.members}
            bonuses={bonusesData.bonuses}
          />
        ) : tab === "advances" && advancesData ? (
          <AdvancesTable
            yearMonth={advancesData.yearMonth}
            searchQuery={searchQuery}
            members={advancesData.members}
            advances={advancesData.advances}
          />
        ) : payrollData ? (
          <PayrollManagement
            yearMonth={payrollData.yearMonth}
            status={status}
            searchQuery={searchQuery}
            lines={payrollData.lines}
          />
        ) : (
          <EmptyState
            icon={IndianRupee}
            title={t("forbiddenTitle")}
            description={t("forbidden")}
          />
        )}
      </Suspense>
    </main>
  );
}
