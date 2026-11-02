import Link from "next/link";
import { ChevronLeft, ShoppingCart } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ForbiddenError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { PurchaseOrderForm } from "@/modules/purchases/components/purchase-order-form";
import { assertCanAccessPurchaseOps } from "@/modules/purchases/service";
import { getPart } from "@/modules/inventory/service";
import { getVendorOptions } from "@/modules/vendors/service";

type Props = {
  searchParams: Promise<{
    partId?: string;
    vendorId?: string;
    serviceOrderId?: string;
    qty?: string;
  }>;
};

export const instant = false;

export default async function NewPurchaseOrderPage({ searchParams }: Props) {
  const session = await requireSession();
  const params = await searchParams;
  const t = await getTranslations("purchaseOrders");

  try {
    assertCanAccessPurchaseOps(session);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return (
        <main className="space-y-6 sm:space-y-8">
          <PageHeader title={t("newTitle")} description={t("newSubtitle")} />
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

  const vendors = await getVendorOptions(session);
  let prefillPart: { id: string; name: string } | null = null;
  if (params.partId?.trim()) {
    try {
      const part = await getPart(session, params.partId.trim());
      prefillPart = { id: part.id, name: part.name };
    } catch {
      prefillPart = null;
    }
  }

  const qty = Number(params.qty ?? 1);
  const quantity = Number.isFinite(qty) && qty >= 1 ? Math.floor(qty) : 1;

  return (
    <main className="w-full max-w-none space-y-4">
      <Link
        href="/purchase-orders"
        className="inline-flex h-5 max-h-5 items-center gap-0.5 px-0.5 text-[13px] leading-5 text-slate-700 hover:text-blue-700"
      >
        <ChevronLeft className="size-3.5 shrink-0" aria-hidden />
        {t("backToList")}
      </Link>

      <PageHeader title={t("newTitle")} description={t("newSubtitle")} />

      <PurchaseOrderForm
        mode="create"
        vendors={vendors}
        defaults={{
          vendorId: params.vendorId?.trim() || null,
          serviceOrderId: params.serviceOrderId?.trim() || null,
          lines: prefillPart
            ? [
                {
                  partId: prefillPart.id,
                  partName: prefillPart.name,
                  quantity,
                },
              ]
            : undefined,
        }}
      />
    </main>
  );
}
