import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { ForbiddenError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { ImportWizard } from "@/modules/data-import/components/import-wizard";

export const instant = false;

export default async function SettingsImportPage() {
  const session = await requireSession();
  const t = await getTranslations("dataImport");

  if (session.role !== "OWNER" && session.role !== "MANAGER") {
    throw new ForbiddenError();
  }

  return (
    <main className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Link
            href="/settings"
            className="inline-flex min-h-11 items-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-slate-50"
          >
            {t("backToSettings")}
          </Link>
        }
      />
      <ImportWizard />
    </main>
  );
}
