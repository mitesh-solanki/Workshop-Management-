import { Suspense } from "react";
import { Columns3 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { TableSpinner } from "@/components/shared/page-spinner";
import { ForbiddenError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { CreateBayModal } from "@/modules/bays/components/create-bay-modal";
import { BaysTable } from "@/modules/bays/components/bays-table";
import {
  assertCanAccessBays,
  canWriteBays,
  listBays,
} from "@/modules/bays/service";

type Props = {
  searchParams: Promise<{
    q?: string;
    sort?: string;
    page?: string;
    pageSize?: string;
  }>;
};

export const instant = false;

export default async function BaysPage({ searchParams }: Props) {
  const session = await requireSession();
  const params = await searchParams;
  const t = await getTranslations("bays");

  try {
    assertCanAccessBays(session);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return (
        <main className="space-y-6 sm:space-y-8">
          <PageHeader title={t("title")} description={t("subtitle")} />
          <EmptyState
            icon={Columns3}
            title={t("forbiddenTitle")}
            description={t("forbidden")}
          />
        </main>
      );
    }
    throw error;
  }

  const result = await listBays(session, {
    q: params.q,
    sort: params.sort,
    page: params.page,
    pageSize: params.pageSize,
  });
  const canWrite = canWriteBays(session);
  const hasQuery = Boolean(params.q?.trim());

  return (
    <main className="space-y-6 sm:space-y-8">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={canWrite ? <CreateBayModal /> : undefined}
      />

      <Suspense fallback={<TableSpinner />}>
        <BaysTable
          bays={result.items}
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          canWrite={canWrite}
          empty={
            <EmptyState
              icon={Columns3}
              title={hasQuery ? t("emptySearchTitle") : t("emptyTitle")}
              description={
                hasQuery ? t("emptySearchDescription") : t("emptyDescription")
              }
              action={
                !hasQuery && canWrite ? (
                  <CreateBayModal size="sm" />
                ) : undefined
              }
            />
          }
        />
      </Suspense>
    </main>
  );
}
