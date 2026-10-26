"use client";

import { useLocale, useTranslations } from "next-intl";
import { NotebookPen, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { computeLineGst, sumLineGst } from "@/lib/gst";
import { formatRupees } from "@/lib/money";
import type { DirectSaleTableRow } from "@/modules/inventory/components/direct-sales-table";

type Props = {
  sale: DirectSaleTableRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DirectSaleViewModal({ sale, open, onOpenChange }: Props) {
  const t = useTranslations("inventory");
  const locale = useLocale();

  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const isWalkIn = !sale.customer;
  const buyerName = sale.customer?.name
    ? sale.customer.name
    : sale.walkInName?.trim()
      ? sale.walkInName.trim()
      : t("walkIn");

  const totals = sumLineGst(
    sale.lines.map((line) => ({
      quantity: line.quantity,
      unitPricePaise: line.unitPricePaise,
      gstRatePercent: line.gstRatePercent,
    })),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border bg-slate-50/80 px-5 py-4 text-left sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-[20px] leading-tight">
                {t("saleDetailTitle")}
              </DialogTitle>
              <DialogDescription className="text-[14px] text-[#5c6b7e]">
                {dateFmt.format(new Date(sale.createdAt))}
                <span className="text-slate-300"> · </span>
                {t("lineCount", { count: sale.lines.length })}
              </DialogDescription>
            </div>
            <Badge
              variant={isWalkIn ? "secondary" : "success"}
              className="min-h-8 shrink-0 px-2.5"
            >
              {isWalkIn ? t("walkIn") : t("customer")}
            </Badge>
          </div>
        </DialogHeader>

        <div className="max-h-[min(75vh,36rem)] space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="flex gap-3 rounded-xl border border-border bg-card px-4 py-3.5">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <UserRound className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-caption font-medium text-slate-500">
                {t("saleDetailBuyer")}
              </p>
              <p className="truncate text-body font-medium text-slate-900">
                {buyerName}
              </p>
              {sale.customer?.phone ? (
                <p className="text-caption text-muted-foreground">
                  {sale.customer.phone}
                </p>
              ) : null}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border">
            <div className="border-b border-border bg-slate-100 px-4 py-2.5">
              <p className="text-sm font-medium text-slate-700">
                {t("saleLines")}
              </p>
            </div>
            <ul className="divide-y divide-border">
              {sale.lines.map((line) => {
                const amounts = computeLineGst({
                  quantity: line.quantity,
                  unitPricePaise: line.unitPricePaise,
                  gstRatePercent: line.gstRatePercent,
                });
                return (
                  <li
                    key={line.id}
                    className="flex items-start justify-between gap-3 px-4 py-3.5"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">
                        {line.part.name}
                      </p>
                      <p className="mt-0.5 text-caption text-muted-foreground">
                        {line.part.sku}
                        <span className="text-slate-300"> · </span>
                        {line.quantity} {line.part.unit}
                        <span className="text-slate-300"> · </span>
                        {formatRupees(line.unitPricePaise)}
                        <span className="text-slate-300"> · </span>
                        {t("gstRate")} {line.gstRatePercent}%
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-semibold tabular-nums text-slate-900">
                        {formatRupees(amounts.totalPaise)}
                      </p>
                      <p className="text-caption tabular-nums text-muted-foreground">
                        {t("gstTotal")} {formatRupees(amounts.gstPaise)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-slate-50/90 px-4 py-4">
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{t("taxableTotal")}</span>
                <span className="tabular-nums text-foreground">
                  {formatRupees(totals.taxablePaise)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{t("gstTotal")}</span>
                <span className="tabular-nums text-foreground">
                  {formatRupees(totals.gstPaise)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                <span className="text-base font-semibold text-blue-900">
                  {t("saleTotal")}
                </span>
                <span className="text-xl font-semibold tabular-nums text-blue-700">
                  {formatRupees(totals.totalPaise)}
                </span>
              </div>
            </div>
          </div>

          {sale.notes?.trim() ? (
            <div className="flex gap-3 rounded-xl border border-border px-4 py-3.5">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <NotebookPen className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-caption font-medium text-slate-500">
                  {t("notes")}
                </p>
                <p className="text-body whitespace-pre-wrap text-slate-900">
                  {sale.notes}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
