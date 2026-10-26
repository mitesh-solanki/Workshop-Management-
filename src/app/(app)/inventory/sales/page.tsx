import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { formatRupees, multiplyByQuantity } from "@/lib/money";
import { requireSession } from "@/lib/session";
import { listSales } from "@/modules/inventory/service";

export const instant = false;

export default async function DirectSalesPage() {
  const session = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations("inventory");
  const sales = await listSales(session);
  const canSale =
    session.role === "OWNER" ||
    session.role === "MANAGER" ||
    session.role === "ACCOUNTANT";

  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <main className="space-y-6 sm:space-y-8">
      <PageHeader
        title={t("salesTitle")}
        description={t("salesSubtitle")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary" size="md">
              <Link href="/inventory">{t("back")}</Link>
            </Button>
            {canSale ? (
              <Button asChild size="md">
                <Link href="/inventory/sales/new">{t("newSale")}</Link>
              </Button>
            ) : null}
          </div>
        }
      />

      {sales.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title={t("salesEmptyTitle")}
          description={t("salesEmpty")}
          action={
            canSale ? (
              <Button asChild size="sm">
                <Link href="/inventory/sales/new">{t("newSale")}</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-slate-200 bg-card">
          {sales.map((sale) => {
            const total = sale.lines.reduce((sum, line) => {
              return (
                sum + multiplyByQuantity(line.unitPricePaise, line.quantity)
              );
            }, 0);
            return (
              <li key={sale.id}>
                <Link
                  href={`/inventory/sales/${sale.id}`}
                  className="flex min-h-14 flex-col gap-1 px-4 py-3 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">
                      {sale.customer?.name ?? t("walkIn")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {dateFmt.format(sale.createdAt)} ·{" "}
                      {t("lineCount", { count: sale.lines.length })}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold tabular-nums text-slate-900">
                    {formatRupees(total)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
