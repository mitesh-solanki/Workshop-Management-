import Link from "next/link";
import { Suspense } from "react";
import { FileText } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ForbiddenError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { InvoicesTable } from "@/modules/invoices/components/invoices-table";
import { listInvoices } from "@/modules/invoices/service";

type Props = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    page?: string;
    pageSize?: string;
  }>;
};

export const instant = false;

export default async function InvoicesPage({ searchParams }: Props) {
  const session = await requireSession();
  const params = await searchParams;
  const t = await getTranslations("invoices");

  let result: Awaited<ReturnType<typeof listInvoices>> | null = null;
  let forbidden = false;

  try {
    result = await listInvoices(session, {
      q: params.q,
      status: params.status,
      page: params.page,
      pageSize: params.pageSize,
    });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      forbidden = true;
    } else {
      throw error;
    }
  }

  if (forbidden || !result) {
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

  const hasQuery = Boolean(params.q?.trim());
  const hasStatus = Boolean(params.status);

  return (
    <main className="space-y-6 sm:space-y-8">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <InvoicesTable
          invoices={result.items}
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          empty={
            <EmptyState
              icon={FileText}
              title={
                hasQuery || hasStatus ? t("emptySearchTitle") : t("emptyTitle")
              }
              description={
                hasQuery || hasStatus
                  ? t("emptySearchDescription")
                  : t("emptyDescription")
              }
              action={
                !hasQuery && !hasStatus ? (
                  <Button asChild size="sm">
                    <Link href="/orders">{t("goToJobCards")}</Link>
                  </Button>
                ) : undefined
              }
            />
          }
        />
      </Suspense>
    </main>
  );
}
