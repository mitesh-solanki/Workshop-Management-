import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ChevronLeft, FileText } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { VendorBillDetailPanel } from "@/modules/purchases/components/vendor-bill-detail-panel";
import {
  assertCanAccessVendorMoney,
  canWriteVendorMoney,
  getVendorBill,
} from "@/modules/purchases/service";

type Props = {
  params: Promise<{ id: string }>;
};

export const instant = false;

export default async function VendorBillDetailPage({ params }: Props) {
  const session = await requireSession();
  const { id } = await params;
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

  let bill: Awaited<ReturnType<typeof getVendorBill>>;
  try {
    bill = await getVendorBill(session, id);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }

  return (
    <main className="w-full space-y-4">
      <Link
        href="/vendor-bills"
        className="inline-flex h-5 max-h-5 items-center gap-0.5 px-0.5 text-[13px] leading-5 text-slate-700 hover:text-blue-700"
      >
        <ChevronLeft className="size-3.5 shrink-0" aria-hidden />
        {t("backToList")}
      </Link>
      <VendorBillDetailPanel
        bill={bill}
        canWrite={canWriteVendorMoney(session)}
      />
    </main>
  );
}
