import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { computeLineGst, sumLineGst } from "@/lib/gst";
import { formatRupees } from "@/lib/money";
import { requireSession } from "@/lib/session";
import { getSale } from "@/modules/inventory/service";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function DirectSaleDetailPage({ params }: Props) {
  const session = await requireSession();
  const { id } = await params;
  const t = await getTranslations("inventory");

  let sale: Awaited<ReturnType<typeof getSale>>;
  try {
    sale = await getSale(session, id);
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ForbiddenError) {
      notFound();
    }
    throw error;
  }

  const totals = sumLineGst(
    sale.lines.map((line) => ({
      quantity: line.quantity,
      unitPricePaise: line.unitPricePaise,
      gstRatePercent: line.gstRatePercent,
    })),
  );

  return (
    <main className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/inventory/sales"
          className="text-sm text-muted-foreground underline"
        >
          {t("backToSales")}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("saleDetailTitle")}
        </h1>
        <p className="text-base text-muted-foreground">
          {sale.customer?.name ?? t("walkIn")} · {sale.createdAt.toLocaleString()}
        </p>
      </div>

      {sale.notes ? (
        <p className="text-sm whitespace-pre-wrap">{sale.notes}</p>
      ) : null}

      <ul className="divide-y rounded-md border">
        {sale.lines.map((line) => {
          const amounts = computeLineGst({
            quantity: line.quantity,
            unitPricePaise: line.unitPricePaise,
            gstRatePercent: line.gstRatePercent,
          });
          return (
            <li
              key={line.id}
              className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-3 text-sm"
            >
              <div>
                <p className="font-medium">
                  {line.part.name} ({line.part.sku})
                </p>
                <p className="text-muted-foreground">
                  {line.quantity} {line.part.unit} ·{" "}
                  {formatRupees(line.unitPricePaise)} · {t("gstRate")}{" "}
                  {line.gstRatePercent}% · {t("hsn")} {line.hsn}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">{formatRupees(amounts.totalPaise)}</p>
                <p className="text-xs text-muted-foreground">
                  {t("gstTotal")} {formatRupees(amounts.gstPaise)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="space-y-1 text-sm">
        <p className="flex justify-between gap-3">
          <span>{t("taxableTotal")}</span>
          <span>{formatRupees(totals.taxablePaise)}</span>
        </p>
        <p className="flex justify-between gap-3">
          <span>{t("gstTotal")}</span>
          <span>{formatRupees(totals.gstPaise)}</span>
        </p>
        <p className="flex justify-between gap-3 text-lg font-semibold">
          <span>{t("saleTotal")}</span>
          <span>{formatRupees(totals.totalPaise)}</span>
        </p>
      </div>
    </main>
  );
}
