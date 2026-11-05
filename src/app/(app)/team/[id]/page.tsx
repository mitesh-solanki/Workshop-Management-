import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { AppError, ForbiddenError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { currentYearMonth } from "@/modules/payroll/date";
import {
  getAddPayrollForm,
  getMemberPayroll,
} from "@/modules/payroll/service";
import { MemberDetailPanel } from "@/modules/team/components/member-detail-panel";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string; addPayroll?: string }>;
};

export const instant = false;

export default async function TeamMemberPage({ params, searchParams }: Props) {
  const session = await requireSession();
  const { id } = await params;
  const { month, addPayroll } = await searchParams;
  const locale = await getLocale();
  const tt = await getTranslations("team");

  const yearMonth =
    month && /^\d{4}-\d{2}$/.test(month) ? month : currentYearMonth();
  const openAddPayroll = addPayroll === "1";

  let data: Awaited<ReturnType<typeof getMemberPayroll>>;
  try {
    data = await getMemberPayroll(session, id);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return (
        <main className="space-y-6">
          <PageHeader title={tt("title")} description={tt("forbidden")} />
        </main>
      );
    }
    if (error instanceof AppError && error.code === "payroll.member_not_found") {
      notFound();
    }
    throw error;
  }

  const showPay = data.canMoney && data.member.role !== "OWNER";
  const isSelf = session.userId === data.member.id;
  const canManageAccess =
    session.role === "OWNER" &&
    !isSelf &&
    data.member.role !== "OWNER";
  const canManageOwnPassword = session.role === "OWNER" && isSelf;
  const canEditRole = canManageAccess;

  let payrollMember: Awaited<
    ReturnType<typeof getAddPayrollForm>
  >["members"][number] | null = null;

  if (showPay && !data.onCurrentMonthPayroll) {
    try {
      const addForm = await getAddPayrollForm(session, yearMonth);
      payrollMember =
        addForm.members.find((member) => member.id === data.member.id) ?? null;
    } catch (error) {
      if (!(error instanceof ForbiddenError)) {
        throw error;
      }
    }
  }

  return (
    <main className="space-y-4 sm:space-y-5">
      <MemberDetailPanel
        member={{
          id: data.member.id,
          name: data.member.name,
          email: data.member.email,
          role: data.member.role,
          isActive: data.member.isActive,
          hasPassword: data.member.hasPassword,
        }}
        showPay={showPay}
        canManageAccess={canManageAccess}
        canManageOwnPassword={canManageOwnPassword}
        canEditRole={canEditRole}
        yearMonth={yearMonth}
        payrollMember={payrollMember}
        onCurrentMonthPayroll={data.onCurrentMonthPayroll}
        openAddPayroll={openAddPayroll && !data.onCurrentMonthPayroll}
        openAdvancePaise={data.openAdvancePaise}
        payrollLines={data.payrollLines.map((line) => ({
          id: line.id,
          payrollRunId: line.payrollRunId,
          basicPaise: line.basicPaise,
          bonusPaise: line.bonusPaise,
          commissionPaise: line.commissionPaise,
          advanceDeductedPaise: line.advanceDeductedPaise,
          adjustmentPaise: line.adjustmentPaise,
          adjustmentNote: line.adjustmentNote,
          netPaise: line.netPaise,
          status: line.status,
          paidAt: line.paidAt ? line.paidAt.toISOString() : null,
          paidMethod: line.paidMethod,
          periodStart: line.payrollRun.periodStart.toISOString(),
          periodEnd: line.payrollRun.periodEnd.toISOString(),
        }))}
        advances={data.advances.map((advance) => ({
          id: advance.id,
          remainingPaise: advance.remainingPaise,
          amountPaise: advance.amountPaise,
          givenOn: advance.givenOn.toISOString(),
          method: advance.method,
          note: advance.note,
        }))}
        locale={locale}
      />
    </main>
  );
}
