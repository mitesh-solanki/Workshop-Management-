import { FileSpreadsheet } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ForbiddenError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { PurchaseGstExportPanel } from "@/modules/gst-purchase-export/components/purchase-gst-export-panel";
import { listPurchaseGstExportRows } from "@/modules/gst-purchase-export/service";
import { currentYearMonth } from "@/modules/payroll/date";

type Props = {
  searchParams: Promise<{ month?: string }>;
};

export const instant = false;

export default async function PurchasesGstExportPage({ searchParams }: Props) {
  const session = await requireSession();
  const params = await searchParams;
  const t = await getTranslations("gstPurchaseExport");

  const monthParam = params.month?.trim() ?? "";
  const yearMonth = /^\d{4}-\d{2}$/.test(monthParam)
    ? monthParam
    : currentYearMonth();

  let result: Awaited<ReturnType<typeof listPurchaseGstExportRows>> | null =
    null;
  let forbidden = false;

  try {
    result = await listPurchaseGstExportRows(session, { yearMonth });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      forbidden = true;
    } else {
      throw error;
    }
  }

  if (forbidden || !result) {
    return (
      <main className="space-y-6 sm:space-y-8">
        <PageHeader title={t("title")} description={t("subtitle")} />
        <EmptyState
          icon={FileSpreadsheet}
          title={t("forbiddenTitle")}
          description={t("forbidden")}
        />
      </main>
    );
  }

  return (
    <main>
      <PurchaseGstExportPanel
        key={result.yearMonth}
        yearMonth={result.yearMonth}
        rows={result.items}
      />
    </main>
  );
}
