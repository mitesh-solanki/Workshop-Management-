import { Suspense } from "react";
import { Truck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { TableSpinner } from "@/components/shared/page-spinner";
import { ForbiddenError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { CreateVendorModal } from "@/modules/vendors/components/create-vendor-modal";
import { VendorsTable } from "@/modules/vendors/components/vendors-table";
import {
  assertCanAccessVendors,
  canWriteVendors,
  listVendors,
} from "@/modules/vendors/service";

type Props = {
  searchParams: Promise<{
    q?: string;
    sort?: string;
    page?: string;
    pageSize?: string;
  }>;
};

export const instant = false;

export default async function VendorsPage({ searchParams }: Props) {
  const session = await requireSession();
  const params = await searchParams;
  const t = await getTranslations("vendors");

  try {
    assertCanAccessVendors(session);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return (
        <main className="space-y-6 sm:space-y-8">
          <PageHeader title={t("title")} description={t("subtitle")} />
          <EmptyState
            icon={Truck}
            title={t("forbiddenTitle")}
            description={t("forbidden")}
          />
        </main>
      );
    }
    throw error;
  }

  const result = await listVendors(session, {
    q: params.q,
    sort: params.sort,
    page: params.page,
    pageSize: params.pageSize,
  });
  const canWrite = canWriteVendors(session);
  const hasQuery = Boolean(params.q?.trim());

  return (
    <main className="space-y-6 sm:space-y-8">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={canWrite ? <CreateVendorModal /> : undefined}
      />

      <Suspense fallback={<TableSpinner />}>
        <VendorsTable
          vendors={result.items}
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          canWrite={canWrite}
          empty={
            <EmptyState
              icon={Truck}
              title={hasQuery ? t("emptySearchTitle") : t("emptyTitle")}
              description={
                hasQuery ? t("emptySearchDescription") : t("emptyDescription")
              }
              action={
                !hasQuery && canWrite ? (
                  <CreateVendorModal size="sm" />
                ) : undefined
              }
            />
          }
        />
      </Suspense>
    </main>
  );
}
