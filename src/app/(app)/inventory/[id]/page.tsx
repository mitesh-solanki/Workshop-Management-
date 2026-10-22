import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { formatRupees } from "@/lib/money";
import { requireSession } from "@/lib/session";
import { PartForm } from "@/modules/inventory/components/part-form";
import {
  StockAdjustForm,
  StockInForm,
  StockOutForm,
} from "@/modules/inventory/components/stock-forms";
import { getPartHistory } from "@/modules/inventory/service";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function PartDetailPage({ params }: Props) {
  const session = await requireSession();
  const { id } = await params;
  const t = await getTranslations("inventory");

  let data: Awaited<ReturnType<typeof getPartHistory>>;
  try {
    data = await getPartHistory(session, id);
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ForbiddenError) {
      notFound();
    }
    throw error;
  }

  const { part, movements } = data;
  const canWrite = session.role === "OWNER" || session.role === "MANAGER";
  const low = part.quantityOnHand <= part.lowStockLevel;

  return (
    <main className="space-y-8">
      <div className="space-y-2">
        <Link
          href="/inventory"
          className="text-sm text-muted-foreground underline"
        >
          {t("back")}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{part.name}</h1>
            <p className="text-base text-muted-foreground">
              {part.sku} · {part.unit} · {t("hsn")} {part.hsn}
            </p>
          </div>
          <div className="text-right">
            <p
              className={
                low
                  ? "text-lg font-semibold text-amber-800"
                  : "text-lg font-semibold"
              }
            >
              {t("stockCount", {
                count: part.quantityOnHand,
                unit: part.unit,
              })}
            </p>
            {low ? (
              <p className="text-sm text-amber-800">{t("lowBadge")}</p>
            ) : null}
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">{t("purchasePrice")}</dt>
          <dd>{formatRupees(part.purchasePricePaise)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("sellingPrice")}</dt>
          <dd>{formatRupees(part.sellingPricePaise)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("gstRate")}</dt>
          <dd>{part.gstRatePercent}%</dd>
        </div>
      </dl>

      {canWrite ? (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">{t("stockActions")}</h2>
          <div className="grid gap-4 lg:grid-cols-3">
            <StockInForm partId={part.id} />
            <StockOutForm partId={part.id} />
            <StockAdjustForm partId={part.id} />
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">{t("movements")}</h2>
        {movements.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("movementsEmpty")}</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {movements.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {t(`movementTypes.${m.type}`)}{" "}
                    <span
                      className={
                        m.quantityChange < 0 ? "text-destructive" : "text-success"
                      }
                    >
                      {m.quantityChange > 0 ? "+" : ""}
                      {m.quantityChange}
                    </span>
                  </p>
                  {m.note ? (
                    <p className="text-muted-foreground">{m.note}</p>
                  ) : null}
                </div>
                <p className="text-muted-foreground">
                  {m.createdAt.toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canWrite ? (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">{t("editTitle")}</h2>
          <PartForm
            mode="edit"
            partId={part.id}
            part={{
              name: part.name,
              sku: part.sku,
              unit: part.unit,
              purchasePricePaise: part.purchasePricePaise,
              sellingPricePaise: part.sellingPricePaise,
              gstRatePercent: part.gstRatePercent,
              hsn: part.hsn,
              lowStockLevel: part.lowStockLevel,
            }}
          />
        </section>
      ) : null}
    </main>
  );
}
