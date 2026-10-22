import Link from "next/link";
import { Package } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { formatRupees } from "@/lib/money";
import { requireSession } from "@/lib/session";
import { listParts } from "@/modules/inventory/service";

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export default async function InventoryPage({ searchParams }: Props) {
  const session = await requireSession();
  const params = await searchParams;
  const t = await getTranslations("inventory");
  const parts = await listParts(session, { q: params.q });
  const canWrite = session.role === "OWNER" || session.role === "MANAGER";
  const canSale =
    session.role === "OWNER" ||
    session.role === "MANAGER" ||
    session.role === "ACCOUNTANT";

  return (
    <main className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary" size="md">
              <Link
                href={
                  params.q
                    ? `/inventory/export?q=${encodeURIComponent(params.q)}`
                    : "/inventory/export"
                }
              >
                {t("export")}
              </Link>
            </Button>
            {canSale ? (
              <Button asChild variant="secondary" size="md">
                <Link href="/inventory/sales/new">{t("directSale")}</Link>
              </Button>
            ) : null}
            {canWrite ? (
              <Button asChild size="md">
                <Link href="/inventory/new">{t("add")}</Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <form className="flex gap-2" method="get">
        <label htmlFor="q" className="sr-only">
          {t("searchLabel")}
        </label>
        <input
          id="q"
          name="q"
          defaultValue={params.q ?? ""}
          placeholder={t("searchPlaceholder")}
          className="min-h-12 w-full max-w-md rounded-md border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" variant="secondary" size="md">
          {t("search")}
        </Button>
      </form>

      {parts.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            canWrite ? (
              <Button asChild size="sm">
                <Link href="/inventory/new">{t("add")}</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <ul className="divide-y rounded-md border">
          {parts.map((part) => {
            const low = part.quantityOnHand <= part.lowStockLevel;
            return (
              <li key={part.id}>
                <Link
                  href={`/inventory/${part.id}`}
                  className="flex min-h-14 flex-col gap-1 px-3 py-3 hover:bg-secondary/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate font-medium">{part.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {part.sku} · {part.unit} · {t("hsn")} {part.hsn}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-baseline gap-3 text-sm">
                    <span
                      className={
                        low
                          ? "font-semibold text-amber-800"
                          : "text-muted-foreground"
                      }
                    >
                      {t("stockCount", {
                        count: part.quantityOnHand,
                        unit: part.unit,
                      })}
                      {low ? ` · ${t("lowBadge")}` : ""}
                    </span>
                    <span className="font-medium">
                      {formatRupees(part.sellingPricePaise)}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {canSale ? (
        <p className="text-sm text-muted-foreground">
          <Link href="/inventory/sales" className="underline">
            {t("viewSales")}
          </Link>
        </p>
      ) : null}
    </main>
  );
}
