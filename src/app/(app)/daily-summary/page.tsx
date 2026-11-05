import { CalendarDays } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ForbiddenError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { DailySummaryPanel } from "@/modules/daily-summary/components/daily-summary-panel";
import { DailySummaryToolbar } from "@/modules/daily-summary/components/daily-summary-toolbar";
import { getDailySummary } from "@/modules/daily-summary/service";
import type { DailySummaryView } from "@/modules/daily-summary/service";

type Props = {
  searchParams: Promise<{ date?: string }>;
};

export const instant = false;

export default async function DailySummaryPage({ searchParams }: Props) {
  const session = await requireSession();
  const params = await searchParams;
  const t = await getTranslations("dailySummary");

  let summary: DailySummaryView | null = null;
  let forbidden = false;

  try {
    summary = await getDailySummary(session, params.date);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      forbidden = true;
    } else {
      throw error;
    }
  }

  if (forbidden || !summary) {
    return (
      <main className="space-y-6 sm:space-y-8">
        <PageHeader title={t("title")} description={t("subtitle")} />
        <EmptyState
          icon={CalendarDays}
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
        actions={<DailySummaryToolbar dateKey={summary.dateKey} />}
      />
      <DailySummaryPanel summary={summary} />
    </main>
  );
}
