import { Suspense } from "react";
import { Receipt } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { TableSpinner } from "@/components/shared/page-spinner";
import { ForbiddenError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { CreateExpenseModal } from "@/modules/expenses/components/create-expense-modal";
import { ExpensesTable } from "@/modules/expenses/components/expenses-table";
import {
  assertCanAccessExpenses,
  canWriteExpenses,
  listExpenseCategoryOptions,
  listExpenseVendorOptions,
  listExpenses,
} from "@/modules/expenses/service";

type Props = {
  searchParams: Promise<{
    q?: string;
    category?: string;
    status?: string;
    sort?: string;
    page?: string;
    pageSize?: string;
    create?: string;
  }>;
};

export const instant = false;

export default async function ExpensesPage({ searchParams }: Props) {
  const session = await requireSession();
  const params = await searchParams;
  const t = await getTranslations("expenses");

  try {
    assertCanAccessExpenses(session);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return (
        <main className="space-y-6 sm:space-y-8">
          <PageHeader title={t("title")} description={t("subtitle")} />
          <EmptyState
            icon={Receipt}
            title={t("forbiddenTitle")}
            description={t("forbidden")}
          />
        </main>
      );
    }
    throw error;
  }

  const [result, usedCategories, vendors] = await Promise.all([
    listExpenses(session, {
      q: params.q,
      category: params.category,
      status: params.status,
      sort: params.sort,
      page: params.page,
      pageSize: params.pageSize,
    }),
    listExpenseCategoryOptions(session),
    listExpenseVendorOptions(session),
  ]);
  const canWrite = canWriteExpenses(session);
  const hasFilters =
    Boolean(params.q?.trim()) ||
    Boolean(params.category?.trim()) ||
    (Boolean(params.status) && params.status !== "ALL");

  return (
    <main className="space-y-6 sm:space-y-8">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          canWrite ? (
            <CreateExpenseModal
              defaultOpen={params.create === "1"}
              usedCategories={usedCategories}
              vendors={vendors}
            />
          ) : undefined
        }
      />

      <Suspense fallback={<TableSpinner />}>
        <ExpensesTable
          expenses={result.items.map((item) => ({
            id: item.id,
            amountPaise: item.amountPaise,
            spentAt: item.spentAt,
            status: item.status,
            method: item.method as "CASH" | "UPI" | "CARD" | null,
            category: item.category,
            note: item.note,
            vendorId: item.vendorId,
            gstSplit: item.gstSplit,
            gstRatePercent: item.gstRatePercent,
            billStorageKey: item.billStorageKey,
            billFileName: item.billFileName,
          }))}
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          canWrite={canWrite}
          usedCategories={usedCategories}
          vendors={vendors}
          empty={
            <EmptyState
              icon={Receipt}
              title={hasFilters ? t("emptySearchTitle") : t("emptyTitle")}
              description={
                hasFilters
                  ? t("emptySearchDescription")
                  : t("emptyDescription")
              }
              action={
                !hasFilters && canWrite ? (
                  <CreateExpenseModal
                    size="sm"
                    usedCategories={usedCategories}
                    vendors={vendors}
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
