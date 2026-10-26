import { Suspense } from "react";
import { FileText } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { TableSpinner } from "@/components/shared/page-spinner";
import { ForbiddenError } from "@/lib/errors";
import { formatRupees } from "@/lib/money";
import { requireSession } from "@/lib/session";
import { CreateVendorBillModal } from "@/modules/purchases/components/create-vendor-bill-modal";
import { VendorBillsTable } from "@/modules/purchases/components/vendor-bills-table";
import {
  assertCanAccessVendorMoney,
  listPurchaseOrders,
  listVendorBills,
} from "@/modules/purchases/service";
import { getVendorOptions } from "@/modules/vendors/service";

type Props = {
  searchParams: Promise<{
    q?: string;
    sort?: string;
    page?: string;
    pageSize?: string;
  }>;
};

export const instant = false;

export default async function VendorBillsPage({ searchParams }: Props) {
  const session = await requireSession();
  const params = await searchParams;
  const t = await getTranslations("vendorBills");

  try {
    assertCanAccessVendorMoney(session);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return (
        <main className="space-y-6 sm:space-y-8">
          <PageHeader title={t("title")} description={t("subtitle")} />
          <EmptyState
            icon={FileText}
            title={t("forbiddenTitle")}
            description={t("forbidden")}
          />
        </main>
      );
    }
    throw error;
  }

  const [result, vendors, poResult] = await Promise.all([
    listVendorBills(session, {
      q: params.q,
      sort: params.sort,
      page: params.page,
      pageSize: params.pageSize,
    }),
    getVendorOptions(session),
    listPurchaseOrders(session, { pageSize: 50 }).catch(() => null),
  ]);

  const purchaseOrders =
    poResult?.items.map((po) => ({
      id: po.id,
      number: po.number,
      vendorId: po.vendor.id,
    })) ?? [];

  const canWrite =
    session.role === "OWNER" ||
    session.role === "MANAGER" ||
    session.role === "ACCOUNTANT";
  const hasQuery = Boolean(params.q?.trim());
  const createModal = canWrite ? (
    <CreateVendorBillModal vendors={vendors} purchaseOrders={purchaseOrders} />
  ) : null;

  return (
    <main className="space-y-6 sm:space-y-8">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={createModal ?? undefined}
      />

      <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3">
        <p className="text-sm text-amber-900">
          {t("totalOutstanding")}
          <span className="ml-2 text-lg font-semibold tabular-nums">
            {formatRupees(result.totalOutstandingPaise)}
          </span>
        </p>
      </div>

      <Suspense fallback={<TableSpinner />}>
        <VendorBillsTable
          bills={result.items}
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          empty={
            <EmptyState
              icon={FileText}
              title={hasQuery ? t("emptySearchTitle") : t("emptyTitle")}
              description={
                hasQuery ? t("emptySearchDescription") : t("emptyDescription")
              }
              action={
                !hasQuery && canWrite ? (
                  <CreateVendorBillModal
                    vendors={vendors}
                    purchaseOrders={purchaseOrders}
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
