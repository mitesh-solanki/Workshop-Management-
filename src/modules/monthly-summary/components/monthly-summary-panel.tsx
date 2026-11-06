"use client";

import { useState } from "react";
import { CalendarRange, TrendingDown, TrendingUp } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Cell, Pie, PieChart } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRupees, type Paise } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  CHART_RANGE_OPTIONS,
  type ChartRangeOption,
  type MonthlySummaryView,
} from "@/modules/monthly-summary/types";
import { formatYearMonthLabel } from "@/modules/payroll/date";

const PAYMENT_COLORS = ["#2563eb", "#0d9488", "#d97706"] as const;

type Props = {
  summary: MonthlySummaryView;
};

type KpiTone = "blue" | "emerald" | "violet" | "amber";

const KPI_VALUE: Record<KpiTone, string> = {
  blue: "text-blue-700",
  emerald: "text-emerald-700",
  violet: "text-violet-700",
  amber: "text-amber-700",
};

function KpiCard({
  label,
  value,
  hint,
  live,
  liveTone,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  live?: string;
  liveTone?: "up" | "down" | "flat";
  tone: KpiTone;
}) {
  return (
    <Card className="gap-0 py-0">
      <CardBody className="px-4 py-4 sm:px-5 sm:py-5">
        <p className="text-sm font-semibold text-foreground sm:text-base">
          {label}
        </p>
        {hint ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        ) : null}
        <div className="mt-2 flex items-baseline justify-between gap-2">
          <p
            className={cn(
              "text-xl font-bold tabular-nums sm:text-2xl",
              KPI_VALUE[tone],
            )}
          >
            {value}
          </p>
          {live ? (
            <p
              className={cn(
                "inline-flex items-center gap-1 text-xs font-medium tabular-nums",
                liveTone === "up"
                  ? "text-emerald-600"
                  : liveTone === "down"
                    ? "text-red-600"
                    : "text-muted-foreground",
              )}
            >
              {liveTone === "up" ? (
                <TrendingUp className="size-3.5 shrink-0" aria-hidden />
              ) : null}
              {liveTone === "down" ? (
                <TrendingDown className="size-3.5 shrink-0" aria-hidden />
              ) : null}
              <span>{live}</span>
            </p>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}

function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function MetricTile({
  label,
  value,
  tone,
  changePct,
}: {
  label: string;
  value: string;
  tone: KpiTone;
  changePct: number | null;
}) {
  const t = useTranslations("monthlySummary");
  const isUp = changePct !== null && changePct > 0;
  const isDown = changePct !== null && changePct < 0;
  const changeText =
    changePct === null
      ? null
      : isUp
        ? t("activity.risePct", { pct: changePct })
        : isDown
          ? t("activity.fallPct", { pct: Math.abs(changePct) })
          : t("activity.flatPct");

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <p
          className={cn(
            "text-2xl font-bold tabular-nums",
            KPI_VALUE[tone],
          )}
        >
          {value}
        </p>
        {changeText ? (
          <p
            className={cn(
              "inline-flex items-center gap-1 text-xs font-medium tabular-nums",
              isUp
                ? "text-emerald-600"
                : isDown
                  ? "text-red-600"
                  : "text-muted-foreground",
            )}
          >
            {isUp ? (
              <TrendingUp className="size-3.5 shrink-0" aria-hidden />
            ) : null}
            {isDown ? (
              <TrendingDown className="size-3.5 shrink-0" aria-hidden />
            ) : null}
            <span>{changeText}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ChartFilter({
  id,
  value,
  onChange,
}: {
  id: string;
  value: ChartRangeOption;
  onChange: (value: ChartRangeOption) => void;
}) {
  const t = useTranslations("monthlySummary");

  return (
    <div className="shrink-0 space-y-1">
      <label
        htmlFor={id}
        className="block text-xs font-medium text-muted-foreground"
      >
        {t("compareWith")}
      </label>
      <Select
        value={value}
        onValueChange={(next) => onChange(next as ChartRangeOption)}
      >
        <SelectTrigger
          id={id}
          className="h-9 min-h-9 w-[11.5rem]"
          aria-label={t("compareWith")}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CHART_RANGE_OPTIONS.map((option) => (
            <SelectItem key={option} value={option}>
              {t(`range.${option}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SectionCard({
  title,
  description,
  filterId,
  range,
  onRangeChange,
  children,
}: {
  title: string;
  description: string;
  filterId: string;
  range: ChartRangeOption;
  onRangeChange: (value: ChartRangeOption) => void;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base font-bold">{title}</CardTitle>
            <p className="text-sm font-normal text-muted-foreground">
              {description}
            </p>
          </div>
          <ChartFilter
            id={filterId}
            value={range}
            onChange={onRangeChange}
          />
        </div>
      </CardHeader>
      <CardBody className="px-3 py-4 sm:px-5 sm:py-5">{children}</CardBody>
    </Card>
  );
}

function activityRow(
  points: MonthlySummaryView["charts"]["activity"][ChartRangeOption],
  key: MonthlySummaryView["charts"]["activity"][ChartRangeOption][number]["labelKey"],
) {
  return (
    points.find((row) => row.labelKey === key) ?? {
      key,
      labelKey: key,
      count: 0,
      previousCount: 0,
    }
  );
}

function PaymentsCompareChart({
  rows,
  compareLabel,
  money,
}: {
  rows: Array<{
    key: string;
    label: string;
    amountPaise: Paise;
    previousAmountPaise: Paise;
  }>;
  compareLabel: string;
  money: (paise: Paise) => string;
}) {
  const t = useTranslations("monthlySummary");
  const chartConfig = {
    amount: { label: t("charts.thisMonth"), color: "#2563eb" },
  } satisfies ChartConfig;

  const data = rows.map((row) => ({
    key: row.key,
    label: row.label,
    amount: row.amountPaise / 100,
    amountPaise: row.amountPaise,
  }));

  const totalPaise = rows.reduce(
    (sum, row) => (sum + row.amountPaise) as Paise,
    0 as Paise,
  );

  return (
    <div className="flex flex-col items-stretch gap-5 sm:flex-row sm:items-center sm:gap-10 sm:pl-2">
      <div className="relative mx-auto h-56 w-56 shrink-0 sm:mx-0">
        <ChartContainer
          config={chartConfig}
          className="aspect-square! h-56 w-56"
        >
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  nameKey="label"
                  formatter={(value) =>
                    money(Math.round(Number(value) * 100) as Paise)
                  }
                />
              }
            />
            <Pie
              data={data}
              dataKey="amount"
              nameKey="label"
              innerRadius={58}
              outerRadius={96}
              paddingAngle={3}
              strokeWidth={3}
              stroke="#ffffff"
            >
              {data.map((entry, index) => (
                <Cell
                  key={entry.key}
                  fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]}
                />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="text-xs font-medium text-muted-foreground">
            {t("charts.thisMonth")}
          </p>
          <p className="max-w-28 text-sm font-bold tabular-nums text-slate-800">
            {money(totalPaise)}
          </p>
        </div>
      </div>
      <ul className="mx-auto w-full max-w-sm space-y-3 sm:mx-0">
        {rows.map((row, index) => {
          const changePct = percentChange(
            row.amountPaise,
            row.previousAmountPaise,
          );
          const isUp = changePct !== null && changePct > 0;
          const isDown = changePct !== null && changePct < 0;
          return (
            <li key={row.key} className="space-y-1">
              <div className="flex items-center gap-3 text-sm">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      PAYMENT_COLORS[index % PAYMENT_COLORS.length],
                  }}
                  aria-hidden
                />
                <span className="w-16 shrink-0 font-medium text-slate-700">
                  {row.label}
                </span>
                <span className="min-w-0 flex-1 text-center tabular-nums font-semibold text-slate-800">
                  {money(row.amountPaise)}
                </span>
                {changePct !== null ? (
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-0.5 text-xs font-medium tabular-nums",
                      isUp
                        ? "text-emerald-600"
                        : isDown
                          ? "text-red-600"
                          : "text-muted-foreground",
                    )}
                  >
                    {isUp ? (
                      <TrendingUp className="size-3 shrink-0" aria-hidden />
                    ) : null}
                    {isDown ? (
                      <TrendingDown className="size-3 shrink-0" aria-hidden />
                    ) : null}
                    {isUp
                      ? t("activity.risePct", { pct: changePct })
                      : isDown
                        ? t("activity.fallPct", {
                            pct: Math.abs(changePct),
                          })
                        : t("activity.flatPct")}
                  </span>
                ) : (
                  <span className="w-16 shrink-0" />
                )}
              </div>
              <p className="pl-[1.625rem] text-xs text-muted-foreground">
                {t("charts.previousAmount", {
                  compare: compareLabel,
                  amount: money(row.previousAmountPaise),
                })}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function MonthlySummaryPanel({ summary }: Props) {
  const t = useTranslations("monthlySummary");
  const locale = useLocale();
  const moneyLocale = locale.startsWith("hi")
    ? "hi-IN"
    : locale.startsWith("gu")
      ? "gu-IN"
      : "en-IN";

  const [paymentsRange, setPaymentsRange] =
    useState<ChartRangeOption>("lastMonth");
  const [activityRange, setActivityRange] =
    useState<ChartRangeOption>("lastMonth");

  function money(paise: Paise) {
    return formatRupees(paise, moneyLocale);
  }

  function kpiLive(current: Paise, lastMonth: Paise) {
    const changePct = percentChange(current, lastMonth);
    if (changePct === null) {
      return { live: undefined, liveTone: undefined as undefined };
    }
    if (changePct > 0) {
      return {
        live: t("activity.risePct", { pct: changePct }),
        liveTone: "up" as const,
      };
    }
    if (changePct < 0) {
      return {
        live: t("activity.fallPct", { pct: Math.abs(changePct) }),
        liveTone: "down" as const,
      };
    }
    return { live: t("activity.flatPct"), liveTone: "flat" as const };
  }

  const monthLabel = formatYearMonthLabel(summary.yearMonth, locale);
  const paymentsCompareLabel = t(`range.${paymentsRange}`);
  const profitPaise = (
    summary.kpis.profitPaise > 0 ? summary.kpis.profitPaise : 0
  ) as Paise;
  const lossPaise = (
    summary.kpis.profitPaise < 0 ? Math.abs(summary.kpis.profitPaise) : 0
  ) as Paise;
  const profitPositive = summary.kpis.profitPaise >= 0;

  const paymentRows = summary.charts.payments[paymentsRange].map((row) => ({
    key: row.key,
    label: t(`paymentMethods.${row.labelKey}`),
    amountPaise: row.amountPaise,
    previousAmountPaise: row.previousAmountPaise,
  }));

  const activity = summary.charts.activity[activityRange];

  const inTotal = summary.breakdown
    .filter((row) => row.side === "in")
    .reduce((sum, row) => sum + row.amountPaise, 0) as Paise;
  const outTotal = summary.breakdown
    .filter((row) => row.side === "out")
    .reduce((sum, row) => sum + row.amountPaise, 0) as Paise;

  if (summary.isEmpty) {
    return (
      <EmptyState
        icon={CalendarRange}
        title={t("emptyTitle")}
        description={t("emptyDescription", { month: monthLabel })}
        className="flex min-h-[min(28rem,70vh)] w-full items-center justify-center"
      />
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          tone="emerald"
          label={t("kpi.moneyIn")}
          value={money(summary.kpis.moneyInPaise)}
          {...kpiLive(
            summary.kpis.moneyInPaise,
            summary.kpis.lastMonthMoneyInPaise,
          )}
        />
        <KpiCard
          tone="amber"
          label={t("kpi.moneyOut")}
          value={money(summary.kpis.moneyOutPaise)}
          {...kpiLive(
            summary.kpis.moneyOutPaise,
            summary.kpis.lastMonthMoneyOutPaise,
          )}
        />
        <KpiCard
          tone="blue"
          label={t("kpi.profit")}
          value={money(profitPaise)}
          hint={
            summary.kpis.profitPaise < 0 ? t("kpi.profitInLossHint") : undefined
          }
          {...(summary.kpis.profitPaise > 0
            ? kpiLive(
                summary.kpis.profitPaise,
                summary.kpis.lastMonthProfitPaise,
              )
            : {})}
        />
        <KpiCard
          tone="violet"
          label={t("kpi.loss")}
          value={money(lossPaise)}
          hint={
            summary.kpis.profitPaise < 0 ? t("kpi.lossHint") : undefined
          }
          {...(lossPaise > 0
            ? kpiLive(lossPaise, (
                summary.kpis.lastMonthProfitPaise < 0
                  ? Math.abs(summary.kpis.lastMonthProfitPaise)
                  : 0
              ) as Paise)
            : {})}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          title={t("charts.paymentsTitle")}
          description={t("charts.paymentsDescription")}
          filterId="monthly-payments-range"
          range={paymentsRange}
          onRangeChange={setPaymentsRange}
        >
          <PaymentsCompareChart
            rows={paymentRows}
            compareLabel={paymentsCompareLabel}
            money={money}
          />
        </SectionCard>

        <SectionCard
          title={t("charts.activityTitle")}
          description={t("charts.activityDescription")}
          filterId="monthly-activity-range"
          range={activityRange}
          onRangeChange={setActivityRange}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["customers", "blue"],
                ["vehicles", "blue"],
                ["partsUsed", "amber"],
                ["partsIn", "emerald"],
                ["jobCards", "violet"],
                ["outsideWork", "violet"],
              ] as const
            ).map(([key, tone]) => {
              const row = activityRow(activity, key);
              return (
                <MetricTile
                  key={key}
                  tone={tone}
                  label={t(`activity.${key}`)}
                  value={String(row.count)}
                  changePct={percentChange(row.count, row.previousCount)}
                />
              );
            })}
          </div>
        </SectionCard>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
          <CardTitle className="flex items-center justify-between gap-3 text-base font-bold">
            <span>{t("table.title")}</span>
            <Badge className="border-transparent bg-blue-100 px-2.5 py-1 text-sm font-semibold text-blue-800">
              {t("table.rows", { count: summary.breakdown.length })}
            </Badge>
          </CardTitle>
          <p className="text-sm font-normal text-muted-foreground">
            {t("table.description")}
          </p>
        </CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <Table className="w-full">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>{t("table.category")}</TableHead>
                  <TableHead>{t("table.side")}</TableHead>
                  <TableHead className="text-right">
                    {t("table.amount")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.breakdown.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      {t(`categories.${row.categoryKey}`)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={row.side === "in" ? "success" : "warning"}
                      >
                        {row.side === "in"
                          ? t("table.incoming")
                          : t("table.outgoing")}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-semibold tabular-nums",
                        row.side === "in"
                          ? "text-emerald-700"
                          : "text-amber-700",
                      )}
                    >
                      {money(row.amountPaise)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-slate-50 font-semibold">
                  <TableCell>{t("table.totals")}</TableCell>
                  <TableCell />
                  <TableCell className="space-y-1 text-right text-sm">
                    <p className="tabular-nums text-emerald-700">
                      {t("table.inTotal", { amount: money(inTotal) })}
                    </p>
                    <p className="tabular-nums text-amber-700">
                      {t("table.outTotal", { amount: money(outTotal) })}
                    </p>
                    <p
                      className={cn(
                        "tabular-nums",
                        profitPositive ? "text-blue-700" : "text-violet-700",
                      )}
                    >
                      {t("table.net", {
                        amount: money(summary.kpis.profitPaise),
                      })}
                    </p>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
