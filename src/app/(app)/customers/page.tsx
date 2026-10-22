import { Suspense } from "react";
import { Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireSession } from "@/lib/session";
import { CreateCustomerModal } from "@/modules/customers/components/create-customer-modal";
import { CustomersTable } from "@/modules/customers/components/customers-table";
import { listCustomers } from "@/modules/customers/service";
import { CsvExportButton } from "@/modules/data-export/components/csv-export-button";

type Props = {
  searchParams: Promise<{ q?: string; page?: string; pageSize?: string }>;
};

export const instant = false;

export default async function CustomersPage({ searchParams }: Props) {
  const session = await requireSession();
  const params = await searchParams;
  const t = await getTranslations("customers");
  const result = await listCustomers(session, {
    q: params.q,
    page: params.page,
    pageSize: params.pageSize,
  });
  const canWrite =
    session.role === "OWNER" ||
    session.role === "MANAGER" ||
    session.role === "TECHNICIAN";
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
                  ? `/customers/export?q=${encodeURIComponent(params.q)}`
                  : "/customers/export"
              }
              label={t("export")}
            />
            {canWrite ? <CreateCustomerModal /> : null}
          </div>
        }
      />

      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <CustomersTable
          customers={result.items}
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          canWrite={canWrite}
          empty={
            <EmptyState
              icon={Users}
              title={hasQuery ? t("emptySearchTitle") : t("emptyTitle")}
              description={
                hasQuery ? t("emptySearchDescription") : t("emptyDescription")
              }
              action={
                canWrite && !hasQuery ? (
                  <CreateCustomerModal size="sm" />
                ) : undefined
              }
            />
          }
        />
      </Suspense>
    </main>
  );
}
