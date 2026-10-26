import Link from "next/link";
import { ChevronLeft, ShoppingBag } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSession } from "@/lib/session";
import { listCustomers } from "@/modules/customers/service";
import { CreateDirectSaleModal } from "@/modules/inventory/components/create-direct-sale-modal";
import { DirectSalesTable } from "@/modules/inventory/components/direct-sales-table";
import { listParts, listSales } from "@/modules/inventory/service";

export const instant = false;

export default async function DirectSalesPage() {
  const session = await requireSession();
  const t = await getTranslations("inventory");
  const canSale =
    session.role === "OWNER" ||
    session.role === "MANAGER" ||
    session.role === "ACCOUNTANT";

  const [sales, parts, customers] = await Promise.all([
    listSales(session),
    canSale ? listParts(session) : Promise.resolve([]),
    canSale
      ? listCustomers(session, { pageSize: 50 })
      : Promise.resolve({
          items: [] as { id: string; name: string; phone: string }[],
        }),
  ]);

  const partOptions = parts.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    unit: p.unit,
    sellingPricePaise: p.sellingPricePaise,
    gstRatePercent: p.gstRatePercent,
    quantityOnHand: p.quantityOnHand,
  }));
  const customerOptions = customers.items.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
  }));

  const createModal = canSale ? (
    <CreateDirectSaleModal parts={partOptions} customers={customerOptions} />
  ) : null;

  const empty = (
    <EmptyState
      icon={ShoppingBag}
      title={t("salesEmptyTitle")}
      description={t("salesEmpty")}
      action={
        canSale ? (
          <CreateDirectSaleModal
            parts={partOptions}
            customers={customerOptions}
            size="sm"
          />
        ) : undefined
      }
    />
  );

  return (
    <main className="w-full space-y-4">
      <Link
        href="/inventory"
        className="inline-flex h-5 max-h-5 items-center gap-0.5 px-0.5 text-[13px] leading-5 text-slate-700 hover:text-blue-700"
      >
        <ChevronLeft className="size-3.5 shrink-0" aria-hidden />
        {t("back")}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-[clamp(24px,3.5vw,30px)] leading-tight font-semibold tracking-[0.02em] text-[#152238]">
            {t("salesTitle")}
          </h1>
          <p className="text-[14px] text-[#5c6b7e]">{t("salesSubtitle")}</p>
        </div>
        {createModal}
      </header>

      <DirectSalesTable
        sales={sales}
        empty={empty}
        canWrite={canSale}
        parts={partOptions}
        customers={customerOptions}
        toolbarActions={undefined}
      />
    </main>
  );
}
