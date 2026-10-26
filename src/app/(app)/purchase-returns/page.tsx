import { Suspense } from "react";
import { RotateCcw } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { TableSpinner } from "@/components/shared/page-spinner";
import { ForbiddenError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { listParts } from "@/modules/inventory/service";
import { CreatePurchaseReturnModal } from "@/modules/purchases/components/create-purchase-return-modal";
import { PurchaseReturnsTable } from "@/modules/purchases/components/purchase-returns-table";
import {
  assertCanAccessVendorMoney,
  listPurchaseReturns,
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

export default async function PurchaseReturnsPage({ searchParams }: Props) {
  const session = await requireSession();
  const params = await searchParams;
  const t = await getTranslations("purchaseReturns");

  try {
    assertCanAccessVendorMoney(session);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return (
        <main className="space-y-6 sm:space-y-8">
          <PageHeader title={t("title")} description={t("subtitle")} />
          <EmptyState
            icon={RotateCcw}
            title={t("forbiddenTitle")}
            description={t("forbidden")}
          />
        </main>
      );
    }
    throw error;
  }

  const [result, vendors, parts, billsResult] = await Promise.all([
    listPurchaseReturns(session, {
      q: params.q,
      sort: params.sort,
      page: params.page,
      pageSize: params.pageSize,
    }),
    getVendorOptions(session),
    listParts(session),
    listVendorBills(session, { pageSize: 50 }),
  ]);

  const partOptions = parts.map((part) => ({
    id: part.id,
    name: part.name,
    sku: part.sku,
    unit: part.unit,
  }));
  const billOptions = billsResult.items.map((bill) => ({
    id: bill.id,
    label: bill.billNumber
      ? `${bill.billNumber} · ${bill.vendor.name}`
      : bill.vendor.name,
    vendorId: bill.vendor.id,
  }));

  const hasQuery = Boolean(params.q?.trim());
  const createModal = (
    <CreatePurchaseReturnModal
      vendors={vendors}
      parts={partOptions}
      bills={billOptions}
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
        <PurchaseReturnsTable
          returns={result.items}
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          empty={
            <EmptyState
              icon={RotateCcw}
              title={hasQuery ? t("emptySearchTitle") : t("emptyTitle")}
              description={
                hasQuery ? t("emptySearchDescription") : t("emptyDescription")
              }
              action={
                !hasQuery ? (
                  <CreatePurchaseReturnModal
                    vendors={vendors}
                    parts={partOptions}
                    bills={billOptions}
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
