import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { listCustomers } from "@/modules/customers/service";
import { DirectSaleForm } from "@/modules/inventory/components/direct-sale-form";
import { listParts } from "@/modules/inventory/service";

export default async function NewDirectSalePage() {
  const session = await requireSession();
  requireRole(session, ["OWNER", "MANAGER", "ACCOUNTANT"]);
  const t = await getTranslations("inventory");
  const [parts, customers] = await Promise.all([
    listParts(session),
    listCustomers(session),
  ]);

  return (
    <main className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/inventory/sales"
          className="text-sm text-muted-foreground underline"
        >
          {t("backToSales")}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{t("newSaleTitle")}</h1>
        <p className="text-base text-muted-foreground">{t("newSaleSubtitle")}</p>
      </div>
      <DirectSaleForm
        parts={parts.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          unit: p.unit,
          sellingPricePaise: p.sellingPricePaise,
          gstRatePercent: p.gstRatePercent,
          quantityOnHand: p.quantityOnHand,
        }))}
        customers={customers.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
        }))}
      />
    </main>
  );
}
