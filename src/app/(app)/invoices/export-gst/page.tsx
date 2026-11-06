import { FileSpreadsheet } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ForbiddenError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { GstExportPanel } from "@/modules/invoices/components/gst-export-panel";
import { listGstExportInvoices } from "@/modules/invoices/service";
import { currentYearMonth } from "@/modules/payroll/date";

type Props = {
  searchParams: Promise<{ month?: string }>;
};

export const instant = false;

export default async function InvoicesGstExportPage({ searchParams }: Props) {
  const session = await requireSession();
  const params = await searchParams;
  const t = await getTranslations("invoices");

  const monthParam = params.month?.trim() ?? "";
  const yearMonth = /^\d{4}-\d{2}$/.test(monthParam)
    ? monthParam
    : currentYearMonth();

  let result: Awaited<ReturnType<typeof listGstExportInvoices>> | null = null;
  let forbidden = false;

  try {
    result = await listGstExportInvoices(session, { yearMonth });
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
        <PageHeader
          title={t("gstExport.title")}
          description={t("gstExport.subtitle")}
        />
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
      <GstExportPanel
        key={result.yearMonth}
        yearMonth={result.yearMonth}
        invoices={result.items}
      />
    </main>
  );
}
