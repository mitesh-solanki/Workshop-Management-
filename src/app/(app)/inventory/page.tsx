import { Suspense } from "react";
import Link from "next/link";
import { Package } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireSession } from "@/lib/session";
import { CsvExportButton } from "@/modules/data-export/components/csv-export-button";
import { CreatePartModal } from "@/modules/inventory/components/create-part-modal";
import { InventoryTable } from "@/modules/inventory/components/inventory-table";
import { listParts } from "@/modules/inventory/service";

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export const instant = false;

export default async function InventoryPage({ searchParams }: Props) {
  const session = await requireSession();
  const params = await searchParams;
  const t = await getTranslations("inventory");
  const parts = await listParts(session, { q: params.q });
  const canWrite = session.role === "OWNER" || session.role === "MANAGER";
  const canSale =
    session.role === "OWNER" ||
    session.role === "MANAGER" ||
    session.role === "ACCOUNTANT";
  const hasQuery = Boolean(params.q?.trim());

  return (
    <main className="space-y-6 sm:space-y-8">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <div className="flex flex-wrap gap-2">
            <CsvExportButton
              href={
                params.q
                  ? `/inventory/export?q=${encodeURIComponent(params.q)}`
                  : "/inventory/export"
              }
              label={t("export")}
            />
            {canSale ? (
              <Button asChild variant="secondary" size="md">
                <Link href="/inventory/sales">{t("viewSales")}</Link>
              </Button>
            ) : null}
            {canSale ? (
              <Button asChild variant="secondary" size="md">
                <Link href="/inventory/sales/new">{t("directSale")}</Link>
              </Button>
            ) : null}
            {canWrite ? <CreatePartModal /> : null}
          </div>
        }
      />

      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <InventoryTable
          items={parts}
          canWrite={canWrite}
          empty={
            <EmptyState
              icon={Package}
              title={hasQuery ? t("emptySearchTitle") : t("emptyTitle")}
              description={
                hasQuery ? t("emptySearchDescription") : t("emptyDescription")
              }
              action={
                canWrite && !hasQuery ? (
                  <CreatePartModal size="sm" />
                ) : undefined
              }
            />
          }
        />
      </Suspense>
    </main>
  );
}
