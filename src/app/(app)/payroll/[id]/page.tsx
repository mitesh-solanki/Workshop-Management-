import { notFound, redirect } from "next/navigation";
import { AppError, ForbiddenError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { toDateInputValue } from "@/modules/payroll/date";
import { getPayrollRun } from "@/modules/payroll/service";

type Props = {
  params: Promise<{ id: string }>;
};

export const instant = false;

/** Old run detail URLs land on the month payroll tab. */
export default async function PayrollRunRedirectPage({ params }: Props) {
  const session = await requireSession();
  const { id } = await params;

  let run: Awaited<ReturnType<typeof getPayrollRun>>;
  try {
    run = await getPayrollRun(session, id);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      redirect("/payroll");
    }
    if (error instanceof AppError && error.code === "payroll.not_found") {
      notFound();
    }
    throw error;
  }

  const month = toDateInputValue(run.periodStart).slice(0, 7);
  redirect(`/payroll?tab=payroll&month=${month}`);
}
