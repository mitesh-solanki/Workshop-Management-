import { Suspense } from "react";
import { ChartColumn } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { TableSpinner } from "@/components/shared/page-spinner";
import { ForbiddenError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { ReportsWorkspace } from "@/modules/reports/components/reports-workspace";
import {
  getDetailReportsDashboard,
  getReportsDashboard,
} from "@/modules/reports/service";
import { exportUserSlug } from "@/modules/reports/sleek-export";

export const instant = false;

export default async function ReportsPage() {
  const session = await requireSession();
  const t = await getTranslations("reports");
  const userSlug = exportUserSlug(session.name, session.email);

  let dashboard: Awaited<ReturnType<typeof getReportsDashboard>> | null = null;
  let detailDashboard: Awaited<
    ReturnType<typeof getDetailReportsDashboard>
  > | null = null;
  let forbidden = false;

  try {
    [dashboard, detailDashboard] = await Promise.all([
      getReportsDashboard(session, {}),
      getDetailReportsDashboard(session, {}),
    ]);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      forbidden = true;
    } else {
      throw error;
    }
  }

  if (forbidden || !dashboard || !detailDashboard) {
    return (
      <main className="space-y-6 sm:space-y-8">
        <PageHeader title={t("title")} description={t("subtitle")} />
        <EmptyState
          icon={ChartColumn}
          title={t("forbiddenTitle")}
          description={t("forbidden")}
        />
      </main>
    );
  }

  return (
    <main className="space-y-6 sm:space-y-8">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <Suspense fallback={<TableSpinner />}>
        <ReportsWorkspace
          dashboard={dashboard}
          detailDashboard={detailDashboard}
          exportUserSlug={userSlug}
        />
      </Suspense>
    </main>
  );
}
