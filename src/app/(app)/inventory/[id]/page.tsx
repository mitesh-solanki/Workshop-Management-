import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { formatRupees } from "@/lib/money";
import { requireSession } from "@/lib/session";
import { EditPartModal } from "@/modules/inventory/components/edit-part-modal";
import {
  StockAdjustForm,
  StockInForm,
  StockOutForm,
} from "@/modules/inventory/components/stock-forms";
import { getPartHistory } from "@/modules/inventory/service";

type Props = {
  params: Promise<{ id: string }>;
};

export const instant = false;

export default async function PartDetailPage({ params }: Props) {
  const session = await requireSession();
  const { id } = await params;
  const locale = await getLocale();
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
  const unitLabel =
    part.unit === "pcs" ||
    part.unit === "set" ||
    part.unit === "pair" ||
    part.unit === "litre" ||
    part.unit === "ml" ||
    part.unit === "kg" ||
    part.unit === "g" ||
    part.unit === "metre"
      ? t(`units.${part.unit}`)
      : part.unit;

  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const editValues = {
    id: part.id,
    name: part.name,
    sku: part.sku,
    unit: part.unit,
    purchasePricePaise: part.purchasePricePaise,
    sellingPricePaise: part.sellingPricePaise,
    gstRatePercent: part.gstRatePercent,
    hsn: part.hsn,
    lowStockLevel: part.lowStockLevel,
  };

  return (
    <main className="space-y-6 sm:space-y-8">
      <PageHeader
        title={part.name}
        description={`${part.sku} · ${unitLabel} · ${t("hsn")} ${part.hsn}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-right">
              <p
                className={
                  low
                    ? "text-lg font-semibold text-amber-800"
                    : "text-lg font-semibold text-slate-900"
                }
              >
                {t("stockCount", {
                  count: part.quantityOnHand,
                  unit: unitLabel,
                })}
              </p>
              {low ? <Badge variant="warning">{t("lowBadge")}</Badge> : null}
            </div>
            {canWrite ? (
              <EditPartModal
                part={editValues}
                trigger={
                  <Button type="button" variant="secondary" size="md">
                    {t("edit")}
                  </Button>
                }
              />
            ) : null}
            <Button asChild variant="secondary" size="md">
              <Link href="/inventory">{t("back")}</Link>
            </Button>
          </div>
        }
      />

      <dl className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-card p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">{t("purchasePrice")}</dt>
          <dd className="mt-0.5 font-medium">
            {formatRupees(part.purchasePricePaise)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("sellingPrice")}</dt>
          <dd className="mt-0.5 font-medium">
            {formatRupees(part.sellingPricePaise)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("gstRate")}</dt>
          <dd className="mt-0.5 font-medium">{part.gstRatePercent}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("lowStockLevel")}</dt>
          <dd className="mt-0.5 font-medium">
            {t("stockCount", { count: part.lowStockLevel, unit: unitLabel })}
          </dd>
        </div>
      </dl>

      {canWrite ? (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">
            {t("stockActions")}
          </h2>
          <div className="grid gap-4 lg:grid-cols-3">
            <StockInForm partId={part.id} />
            <StockOutForm partId={part.id} />
            <StockAdjustForm partId={part.id} />
          </div>
        </section>
      ) : null}

      <Card className="gap-0 py-0">
        <CardHeader className="border-b border-border px-4 py-3">
          <CardTitle className="text-base">{t("movements")}</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {movements.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              {t("movementsEmpty")}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {movements.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {t(`movementTypes.${m.type}`)}{" "}
                      <span
                        className={
                          m.quantityChange < 0
                            ? "text-destructive"
                            : "text-emerald-700"
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
                  <p className="shrink-0 text-muted-foreground">
                    {dateFmt.format(m.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </main>
  );
}
