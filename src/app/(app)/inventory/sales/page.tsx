import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { formatRupees, multiplyByQuantity } from "@/lib/money";
import { requireSession } from "@/lib/session";
import { listSales } from "@/modules/inventory/service";

export default async function DirectSalesPage() {
  const session = await requireSession();
  const t = await getTranslations("inventory");
  const sales = await listSales(session);
  const canSale =
    session.role === "OWNER" ||
    session.role === "MANAGER" ||
    session.role === "ACCOUNTANT";

  return (
    <main className="space-y-6">
      <PageHeader
        title={t("salesTitle")}
        description={t("salesSubtitle")}
        actions={
          canSale ? (
            <Button asChild size="md">
              <Link href="/inventory/sales/new">{t("newSale")}</Link>
            </Button>
          ) : null
        }
      />

      <Link href="/inventory" className="text-sm text-muted-foreground underline">
        {t("back")}
      </Link>

      {sales.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("salesEmpty")}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {sales.map((sale) => {
            const total = sale.lines.reduce((sum, line) => {
              return sum + multiplyByQuantity(line.unitPricePaise, line.quantity);
            }, 0);
            return (
              <li key={sale.id}>
                <Link
                  href={`/inventory/sales/${sale.id}`}
                  className="flex min-h-14 flex-col gap-1 px-3 py-3 hover:bg-secondary/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">
                      {sale.customer?.name ?? t("walkIn")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {sale.createdAt.toLocaleString()} ·{" "}
                      {t("lineCount", { count: sale.lines.length })}
                    </p>
                  </div>
                  <p className="font-medium">{formatRupees(total)}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
