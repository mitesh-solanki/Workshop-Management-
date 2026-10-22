import Link from "next/link";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { CustomerSearch } from "@/modules/customers/components/customer-search";
import { listCustomers } from "@/modules/customers/service";

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export default async function CustomersPage({ searchParams }: Props) {
  const session = await requireSession();
  const params = await searchParams;
  const t = await getTranslations("customers");
  const customers = await listCustomers(session, { q: params.q });
  const canWrite =
    session.role === "OWNER" ||
    session.role === "MANAGER" ||
    session.role === "TECHNICIAN";

  return (
    <main className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-base text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Link
            href={
              params.q
                ? `/customers/export?q=${encodeURIComponent(params.q)}`
                : "/customers/export"
            }
            className="inline-flex min-h-12 items-center rounded-md border px-4 text-base font-medium"
          >
            {t("export")}
          </Link>
          {canWrite ? (
            <Link
              href="/customers/new"
              className="inline-flex min-h-12 items-center rounded-md bg-primary px-4 text-base font-medium text-primary-foreground"
            >
              {t("add")}
            </Link>
          ) : null}
        </div>
      </div>

      <Suspense
        fallback={
          <p className="text-sm text-muted-foreground">{t("searching")}</p>
        }
      >
        <CustomerSearch />
      </Suspense>

      {customers.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {customers.map((customer) => (
            <li key={customer.id}>
              <Link
                href={`/customers/${customer.id}`}
                className="flex min-h-14 flex-col gap-1 px-3 py-3 hover:bg-secondary/50"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate font-medium">{customer.name}</p>
                  <p className="shrink-0 text-sm text-muted-foreground">
                    {customer.phone}
                  </p>
                </div>
                {customer.vehicles.length > 0 ? (
                  <p className="truncate text-sm text-muted-foreground">
                    {customer.vehicles
                      .map((v) => {
                        return v.registrationNumber;
                      })
                      .join(" · ")}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("noVehicles")}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
