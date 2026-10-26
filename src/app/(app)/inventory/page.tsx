import { Suspense } from "react";
import { Package } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireSession } from "@/lib/session";
import { ImportModal } from "@/modules/data-import/components/import-modal";
import { CreatePartModal } from "@/modules/inventory/components/create-part-modal";
import { InventoryTable } from "@/modules/inventory/components/inventory-table";
import { listParts } from "@/modules/inventory/service";

type Props = {
  searchParams: Promise<{ q?: string; sort?: string }>;
};

export const instant = false;

export default async function InventoryPage({ searchParams }: Props) {
  const session = await requireSession();
  const params = await searchParams;
  const t = await getTranslations("inventory");
  const parts = await listParts(session, { q: params.q, sort: params.sort });
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
          <>
            {canWrite ? <ImportModal entity="parts" /> : null}
            {canWrite ? <CreatePartModal /> : null}
          </>
        }
      />

      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <InventoryTable
          items={parts}
          canWrite={canWrite}
          canSale={canSale}
          empty={
            <EmptyState
              icon={Package}
              title={hasQuery ? t("emptySearchTitle") : t("emptyTitle")}
              description={
                hasQuery ? t("emptySearchDescription") : t("emptyDescription")
              }
              action={
                canWrite && !hasQuery ? (
                  <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
                    <ImportModal entity="parts" size="sm" />
                    <CreatePartModal size="sm" />
                  </div>
                ) : undefined
              }
            />
          }
        />
      </Suspense>
    </main>
  );
}
