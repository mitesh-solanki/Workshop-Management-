import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft, IndianRupee } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ForbiddenError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { AddPayrollForm } from "@/modules/payroll/components/add-payroll-form";
import { AddPayrollMonthPicker } from "@/modules/payroll/components/add-payroll-month-picker";
import { currentYearMonth } from "@/modules/payroll/date";
import { getAddPayrollForm } from "@/modules/payroll/service";

type Props = {
  searchParams: Promise<{ month?: string }>;
};

export const instant = false;

export default async function AddPayrollPage({ searchParams }: Props) {
  const session = await requireSession();
  const params = await searchParams;
  const t = await getTranslations("payroll");

  const yearMonth =
    params.month && /^\d{4}-\d{2}$/.test(params.month)
      ? params.month
      : currentYearMonth();

  let data: Awaited<ReturnType<typeof getAddPayrollForm>> | null = null;
  let forbidden = false;

  try {
    data = await getAddPayrollForm(session, yearMonth);
  } catch (e) {
    if (e instanceof ForbiddenError) {
      forbidden = true;
    } else {
      throw e;
    }
  }

  if (forbidden || !data) {
    return (
      <main className="space-y-6 sm:space-y-8">
        <PageHeader
          title={t("addPayrollTitle")}
          description={t("addPayrollSubtitle")}
        />
        <EmptyState
          icon={IndianRupee}
          title={t("forbiddenTitle")}
          description={t("forbidden")}
        />
      </main>
    );
  }

  return (
    <main className="space-y-6 sm:space-y-8">
      <Link
        href="/payroll"
        className="inline-flex h-5 max-h-5 items-center gap-0.5 px-0.5 text-[13px] leading-5 text-slate-700 hover:text-blue-700"
      >
        <ChevronLeft className="size-3.5 shrink-0" aria-hidden />
        {t("back")}
      </Link>
      <PageHeader
        title={t("addPayrollTitle")}
        description={t("addPayrollSubtitle")}
        actions={<AddPayrollMonthPicker yearMonth={data.yearMonth} />}
      />
      {data.members.length === 0 ? (
        <EmptyState
          icon={IndianRupee}
          title={t("emptyMonthTitle")}
          description={t("allMembersOnPayroll")}
        />
      ) : (
        <AddPayrollForm yearMonth={data.yearMonth} members={data.members} />
      )}
    </main>
  );
}
