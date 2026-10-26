import { Suspense } from "react";
import { ShoppingCart } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { TableSpinner } from "@/components/shared/page-spinner";
import { ForbiddenError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { CreatePurchaseOrderModal } from "@/modules/purchases/components/create-purchase-order-modal";
import { PurchaseOrdersTable } from "@/modules/purchases/components/purchase-orders-table";
import {
  assertCanAccessPurchaseOps,
  getOpenPartsRequests,
  listPurchaseOrders,
} from "@/modules/purchases/service";
import { getVendorOptions } from "@/modules/vendors/service";

type Props = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    sort?: string;
    page?: string;
    pageSize?: string;
    requestId?: string;
  }>;
};

export const instant = false;

export default async function PurchaseOrdersPage({ searchParams }: Props) {
  const session = await requireSession();
  const params = await searchParams;
  const t = await getTranslations("purchaseOrders");

  try {
    assertCanAccessPurchaseOps(session);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return (
        <main className="space-y-6 sm:space-y-8">
          <PageHeader title={t("title")} description={t("subtitle")} />
          <EmptyState
            icon={ShoppingCart}
            title={t("forbiddenTitle")}
            description={t("forbidden")}
          />
        </main>
      );
    }
    throw error;
  }

  const [result, vendors, openRequests] = await Promise.all([
    listPurchaseOrders(session, {
      q: params.q,
      status: params.status,
      sort: params.sort,
      page: params.page,
      pageSize: params.pageSize,
    }),
    getVendorOptions(session),
    getOpenPartsRequests(session),
  ]);

  const hasQuery = Boolean(params.q?.trim() || params.status);
  const preselected = params.requestId ? [params.requestId] : [];
  const createModal = (
    <CreatePurchaseOrderModal
      vendors={vendors}
      openRequests={openRequests}
      preselectedRequestIds={preselected}
      defaultOpen={Boolean(params.requestId)}
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
        <PurchaseOrdersTable
          orders={result.items}
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          empty={
            <EmptyState
              icon={ShoppingCart}
              title={hasQuery ? t("emptySearchTitle") : t("emptyTitle")}
              description={
                hasQuery ? t("emptySearchDescription") : t("emptyDescription")
              }
              action={
                !hasQuery ? (
                  <CreatePurchaseOrderModal
                    vendors={vendors}
                    openRequests={openRequests}
                    size="sm"
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
