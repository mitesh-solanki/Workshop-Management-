"use client";

import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { formatRupees, type Paise } from "@/lib/money";
import {
  formatPeriodLabel,
  formatPeriodMonthYear,
} from "@/modules/payroll/date";

export type MyPayLineDetail = {
  id: string;
  basicPaise: number;
  bonusPaise: number;
  commissionPaise: number;
  advanceDeductedPaise: number;
  adjustmentPaise: number;
  adjustmentNote: string | null;
  note: string | null;
  netPaise: number;
  status: "DRAFT" | "PAID";
  paidAt: string | null;
  paidMethod: "CASH" | "UPI" | "CARD" | "MIXED" | null;
  periodStart: string;
  periodEnd: string;
};

type Props = {
  line: MyPayLineDetail;
};

export function MyPayDetail({ line }: Props) {
  const t = useTranslations("myPay");
  const tp = useTranslations("payroll");
  const locale = useLocale();
  const monthLabel = formatPeriodMonthYear(line.periodStart, locale);
  const periodLabel = formatPeriodLabel(
    line.periodStart,
    line.periodEnd,
    locale,
  );

  const rows: { label: string; value: string; tone?: string }[] = [
    {
      label: tp("columns.basic"),
      value: formatRupees(line.basicPaise as Paise, locale),
    },
    {
      label: tp("columns.bonus"),
      value: formatRupees(line.bonusPaise as Paise, locale),
      tone: "text-emerald-700",
    },
    {
      label: tp("columns.commission"),
      value: formatRupees(line.commissionPaise as Paise, locale),
    },
    {
      label: tp("columns.advance"),
      value: formatRupees(line.advanceDeductedPaise as Paise, locale),
      tone: "text-amber-700",
    },
    {
      label: tp("columns.adjustment"),
      value: formatRupees(line.adjustmentPaise as Paise, locale),
    },
  ];

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h2 className="text-lg font-semibold text-foreground">
              {t("detailHeading", { month: monthLabel })}
            </h2>
            <p className="text-sm text-muted-foreground">{periodLabel}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant={line.status === "PAID" ? "success" : "warning"}>
              {line.status === "PAID" ? t("paid") : t("unpaid")}
            </Badge>
            <p className="text-xl font-semibold tabular-nums text-blue-700">
              {formatRupees(line.netPaise as Paise, locale)}
            </p>
            <p className="text-caption text-muted-foreground">{t("netPay")}</p>
          </div>
        </div>

        {line.status === "PAID" && line.paidAt ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {t("paidOnDate", {
              date: new Intl.DateTimeFormat(locale, {
                day: "numeric",
                month: "short",
                year: "numeric",
              }).format(new Date(line.paidAt)),
            })}
            {line.paidMethod
              ? ` · ${t("paidVia", { method: tp(`methods.${line.paidMethod}`) })}`
              : null}
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          {t("breakdown")}
        </h3>
        <dl className="grid gap-3 sm:grid-cols-2">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5"
            >
              <dt className="text-sm text-muted-foreground">{row.label}</dt>
              <dd
                className={`text-sm font-medium tabular-nums ${row.tone ?? "text-foreground"}`}
              >
                {row.value}
              </dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-slate-50 px-3 py-2.5 sm:col-span-2">
            <dt className="text-sm font-semibold text-foreground">
              {tp("columns.net")}
            </dt>
            <dd className="text-sm font-semibold tabular-nums text-blue-700">
              {formatRupees(line.netPaise as Paise, locale)}
            </dd>
          </div>
        </dl>

        {line.adjustmentNote ? (
          <p className="mt-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {t("adjustmentNote")}:{" "}
            </span>
            {line.adjustmentNote}
          </p>
        ) : null}
        {line.note ? (
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{t("note")}: </span>
            {line.note}
          </p>
        ) : null}
      </section>
    </div>
  );
}
