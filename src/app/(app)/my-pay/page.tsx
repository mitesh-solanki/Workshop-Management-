import { Suspense } from "react";
import { Wallet } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { TableSpinner } from "@/components/shared/page-spinner";
import { ForbiddenError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { MyPayPanel } from "@/modules/payroll/components/my-pay-panel";
import { MyPayTabs } from "@/modules/payroll/components/my-pay-tabs";
import { listMyPay } from "@/modules/payroll/service";

type Props = {
  searchParams: Promise<{
    tab?: string;
    month?: string;
  }>;
};

export const instant = false;

export default async function MyPayPage({ searchParams }: Props) {
  const session = await requireSession();
  const params = await searchParams;
  const t = await getTranslations("myPay");

  const activeTab = params.tab === "advance" ? "advance" : "salary";
  const monthParam = params.month?.trim() ?? "";
  const yearMonth =
    monthParam === "all" || !monthParam
      ? "all"
      : /^\d{4}-\d{2}$/.test(monthParam)
        ? monthParam
        : "all";
  let lines: Awaited<ReturnType<typeof listMyPay>>["lines"] = [];
  let advances: Awaited<ReturnType<typeof listMyPay>>["advances"] = [];
  let forbidden = false;

  try {
    const data = await listMyPay(session);
    lines = data.lines;
    advances = data.advances;
  } catch (error) {
    if (error instanceof ForbiddenError) {
      forbidden = true;
    } else {
      throw error;
    }
  }

  if (forbidden) {
    return (
      <main className="space-y-6 sm:space-y-8">
        <PageHeader title={t("title")} description={t("subtitle")} />
        <EmptyState
          icon={Wallet}
          title={t("forbiddenTitle")}
          description={t("forbidden")}
        />
      </main>
    );
  }

  return (
    <main className="space-y-6 sm:space-y-8">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Suspense fallback={null}>
            <MyPayTabs activeTab={activeTab} />
          </Suspense>
        }
      />
      <Suspense fallback={<TableSpinner />}>
        <MyPayPanel
          activeTab={activeTab}
          yearMonth={yearMonth}
          lines={lines}
          advances={advances}
        />
      </Suspense>
    </main>
  );
}
