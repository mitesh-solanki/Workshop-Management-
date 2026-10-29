import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Car } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { TableSpinner } from "@/components/shared/page-spinner";
import { homePathForRole } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { listCustomers } from "@/modules/customers/service";
import { ImportModal } from "@/modules/data-import/components/import-modal";
import { CreateVehicleFromListModal } from "@/modules/vehicles/components/create-vehicle-from-list-modal";
import { VehiclesTable } from "@/modules/vehicles/components/vehicles-table";
import { listVehicles } from "@/modules/vehicles/service";

type Props = {
  searchParams: Promise<{
    q?: string;
    sort?: string;
    page?: string;
    pageSize?: string;
  }>;
};

export const instant = false;

export default async function VehiclesPage({ searchParams }: Props) {
  const session = await requireSession();
  if (session.role === "TECHNICIAN") {
    redirect(homePathForRole(session.role));
  }
  const params = await searchParams;
  const t = await getTranslations("vehicles");
  const [result, customers] = await Promise.all([
    listVehicles(session, {
      q: params.q,
      sort: params.sort,
      page: params.page,
      pageSize: params.pageSize,
    }),
    listCustomers(session, { pageSize: 50, sort: "newest" }),
  ]);
  const canWrite =
    session.role === "OWNER" || session.role === "MANAGER";
  const canImport = canWrite;
  const hasQuery = Boolean(params.q?.trim());
  const customerOptions = customers.items.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
  }));

  return (
    <main className="space-y-6 sm:space-y-8">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <>
            {canImport ? <ImportModal entity="vehicles" /> : null}
            {canWrite ? (
              <CreateVehicleFromListModal customers={customerOptions} />
            ) : null}
          </>
        }
      />

      <Suspense fallback={<TableSpinner />}>
        <VehiclesTable
          vehicles={result.items}
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          canWrite={canWrite}
          empty={
            <EmptyState
              icon={Car}
              title={hasQuery ? t("emptySearchTitle") : t("emptyTitle")}
              description={
                hasQuery ? t("emptySearchDescription") : t("emptyDescription")
              }
              action={
                !hasQuery && (canImport || canWrite) ? (
                  <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
                    {canImport ? (
                      <ImportModal entity="vehicles" size="sm" />
                    ) : null}
                    {canWrite ? (
                      customers.items.length > 0 ? (
                        <CreateVehicleFromListModal
                          size="sm"
                          customers={customerOptions}
                        />
                      ) : (
                        <Button asChild size="sm">
                          <Link href="/customers">{t("goToCustomers")}</Link>
                        </Button>
                      )
                    ) : null}
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
