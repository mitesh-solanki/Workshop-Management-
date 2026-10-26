import { Suspense } from "react";
import { PackagePlus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { TableSpinner } from "@/components/shared/page-spinner";
import { ForbiddenError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { listParts } from "@/modules/inventory/service";
import { CreatePartsRequestModal } from "@/modules/purchases/components/create-parts-request-modal";
import { PartsRequestsTable } from "@/modules/purchases/components/parts-requests-table";
import {
  assertCanAccessPurchaseOps,
  getOpenPartsRequests,
  listPartsRequests,
} from "@/modules/purchases/service";
import { getVendorOptions } from "@/modules/vendors/service";

type Props = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    sort?: string;
    page?: string;
    pageSize?: string;
    partId?: string;
    serviceOrderLineId?: string;
  }>;
};

export const instant = false;

export default async function PartsRequestsPage({ searchParams }: Props) {
  const session = await requireSession();
  const params = await searchParams;
  const t = await getTranslations("partsRequests");

  try {
    assertCanAccessPurchaseOps(session);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return (
        <main className="space-y-6 sm:space-y-8">
          <PageHeader title={t("title")} description={t("subtitle")} />
          <EmptyState
            icon={PackagePlus}
            title={t("forbiddenTitle")}
            description={t("forbidden")}
          />
        </main>
      );
    }
    throw error;
  }

  const [result, parts, vendors, openRequests] = await Promise.all([
    listPartsRequests(session, {
      q: params.q,
      status: params.status,
      sort: params.sort,
      page: params.page,
      pageSize: params.pageSize,
    }),
    listParts(session),
    getVendorOptions(session),
    getOpenPartsRequests(session),
  ]);

  const partOptions = parts.map((part) => ({
    id: part.id,
    name: part.name,
    sku: part.sku,
    unit: part.unit,
  }));
  const hasQuery = Boolean(params.q?.trim() || params.status);
  const createModal = (
    <CreatePartsRequestModal
      parts={partOptions}
      defaultPartId={params.partId}
      defaultServiceOrderLineId={params.serviceOrderLineId}
      defaultOpen={Boolean(params.partId || params.serviceOrderLineId)}
      stayAndRefresh
      allowAddPart
    />
  );

  return (
    <main className="space-y-6 sm:space-y-8">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={createModal}
      />

      <Suspense fallback={<TableSpinner />}>
        <PartsRequestsTable
          requests={result.items}
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          vendors={vendors}
          openRequests={openRequests}
          empty={
            <EmptyState
              icon={PackagePlus}
              title={hasQuery ? t("emptySearchTitle") : t("emptyTitle")}
              description={
                hasQuery ? t("emptySearchDescription") : t("emptyDescription")
              }
              action={
                !hasQuery ? (
                  <CreatePartsRequestModal
                    parts={partOptions}
                    size="sm"
                    stayAndRefresh
                    allowAddPart
                  />
                ) : undefined
              }
            />
          }
        />
      </Suspense>
    </main>
  );
}
