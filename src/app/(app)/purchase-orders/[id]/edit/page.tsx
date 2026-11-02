import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ShoppingCart } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { PurchaseOrderForm } from "@/modules/purchases/components/purchase-order-form";
import { purchaseOrderIsEditable } from "@/modules/purchases/po-status";
import {
  assertCanAccessPurchaseOps,
  getPurchaseOrder,
} from "@/modules/purchases/service";
import { getVendorOptions } from "@/modules/vendors/service";

type Props = {
  params: Promise<{ id: string }>;
};

export const instant = false;

export default async function EditPurchaseOrderPage({ params }: Props) {
  const session = await requireSession();
  const { id } = await params;
  const t = await getTranslations("purchaseOrders");

  try {
    assertCanAccessPurchaseOps(session);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return (
        <main className="space-y-6 sm:space-y-8">
          <PageHeader title={t("editTitle")} description={t("editSubtitle")} />
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

  let po: Awaited<ReturnType<typeof getPurchaseOrder>>;
  try {
    po = await getPurchaseOrder(session, id);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }

  if (
    !purchaseOrderIsEditable(po.status) ||
    po.lines.some((line) => line.quantityReceived > 0)
  ) {
    notFound();
  }

  const vendors = await getVendorOptions(session);

  return (
    <main className="w-full max-w-none space-y-4">
      <Link
        href={`/purchase-orders/${po.id}`}
        className="inline-flex h-5 max-h-5 items-center gap-0.5 px-0.5 text-[13px] leading-5 text-slate-700 hover:text-blue-700"
      >
        <ChevronLeft className="size-3.5 shrink-0" aria-hidden />
        {t("backToDetail")}
      </Link>

      <PageHeader
        title={t("editTitle")}
        description={t("editSubtitleWithNumber", { number: po.number })}
      />

      <PurchaseOrderForm
        mode="edit"
        vendors={vendors}
        defaults={{
          purchaseOrderId: po.id,
          number: po.number,
          vendorId: po.vendorId ?? "",
          notes: po.notes,
          canDelete: po.lines.every((line) => line.quantityReceived === 0),
          lines: po.lines.map((line) => ({
            partId: line.partId,
            partName: line.part.name,
            quantity: line.quantityOrdered,
          })),
        }}
      />
    </main>
  );
}
