import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { TableSpinner } from "@/components/shared/page-spinner";
import { homePathForRole } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { CreateCustomerModal } from "@/modules/customers/components/create-customer-modal";
import { CustomersTable } from "@/modules/customers/components/customers-table";
import { listCustomers } from "@/modules/customers/service";
import { ImportModal } from "@/modules/data-import/components/import-modal";

type Props = {
  searchParams: Promise<{
    q?: string;
    sort?: string;
    page?: string;
    pageSize?: string;
  }>;
};

export const instant = false;

export default async function CustomersPage({ searchParams }: Props) {
  const session = await requireSession();
  if (session.role === "TECHNICIAN") {
    redirect(homePathForRole(session.role));
  }
  const params = await searchParams;
  const t = await getTranslations("customers");
  const result = await listCustomers(session, {
    q: params.q,
    sort: params.sort,
    page: params.page,
    pageSize: params.pageSize,
  });
  const canWrite =
    session.role === "OWNER" || session.role === "MANAGER";
  const canImport = canWrite;
  const hasQuery = Boolean(params.q?.trim());

  return (
    <main className="space-y-6 sm:space-y-8">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <>
            {canImport ? <ImportModal entity="customers" /> : null}
            {canWrite ? <CreateCustomerModal /> : null}
          </>
        }
      />

      <Suspense fallback={<TableSpinner />}>
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
                !hasQuery && (canImport || canWrite) ? (
                  <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
                    {canImport ? (
                      <ImportModal entity="customers" size="sm" />
                    ) : null}
                    {canWrite ? <CreateCustomerModal size="sm" /> : null}
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
