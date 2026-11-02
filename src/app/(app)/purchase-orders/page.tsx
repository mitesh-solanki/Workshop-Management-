import Link from "next/link";
import { Suspense } from "react";
import { Plus, ShoppingCart } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { TableSpinner } from "@/components/shared/page-spinner";
import { ForbiddenError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { PurchaseOrdersTable } from "@/modules/purchases/components/purchase-orders-table";
import {
  assertCanAccessPurchaseOps,
  listPurchaseOrders,
} from "@/modules/purchases/service";

type Props = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    sort?: string;
    page?: string;
    pageSize?: string;
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

  const result = await listPurchaseOrders(session, {
    q: params.q,
    status: params.status,
    sort: params.sort,
    page: params.page,
    pageSize: params.pageSize,
  });

  const hasQuery = Boolean(params.q?.trim() || params.status);
  const createButton = (
    <Button asChild size="md">
      <Link href="/purchase-orders/new">
        <Plus className="size-4" aria-hidden />
        {t("add")}
      </Link>
    </Button>
  );

  return (
    <main className="space-y-6 sm:space-y-8">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={createButton}
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
              action={!hasQuery ? createButton : undefined}
            />
          }
        />
      </Suspense>
    </main>
  );
}
