import { CalendarRange } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ForbiddenError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { MonthlySummaryPanel } from "@/modules/monthly-summary/components/monthly-summary-panel";
import { MonthlySummaryToolbar } from "@/modules/monthly-summary/components/monthly-summary-toolbar";
import {
  getMonthlySummary,
  type MonthlySummaryView,
} from "@/modules/monthly-summary/service";

type Props = {
  searchParams: Promise<{ month?: string }>;
};

export const instant = false;

export default async function MonthlySummaryPage({ searchParams }: Props) {
  const session = await requireSession();
  const params = await searchParams;
  const t = await getTranslations("monthlySummary");

  let summary: MonthlySummaryView | null = null;
  let forbidden = false;

  try {
    summary = await getMonthlySummary(session, params.month);
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
          icon={CalendarRange}
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
        actions={<MonthlySummaryToolbar summary={summary} />}
      />
      <MonthlySummaryPanel summary={summary} />
    </main>
  );
}
