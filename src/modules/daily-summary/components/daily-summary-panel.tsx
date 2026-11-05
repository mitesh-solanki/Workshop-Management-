"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { DailySummaryView } from "@/modules/daily-summary/service";

type Props = {
  summary: DailySummaryView;
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
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: KpiTone;
}) {
  return (
    <Card className="gap-0 py-0">
      <CardBody className="px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="text-sm font-semibold text-foreground sm:text-base">
              {label}
            </p>
            {hint ? (
              <p className="text-sm text-muted-foreground">{hint}</p>
            ) : null}
          </div>
          <p
            className={cn(
              "shrink-0 text-xl font-bold tabular-nums sm:text-2xl",
              KPI_VALUE[tone],
            )}
          >
            {value}
          </p>
        </div>
      </CardBody>
    </Card>
  );
}

function Section({
  title,
  description,
  empty,
  children,
  count,
  recordLabel,
}: {
  title: string;
  description?: string;
  empty: string;
  count: number;
  recordLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
        <CardTitle className="flex items-center justify-between gap-3 text-base font-bold">
          <span className="min-w-0">{title}</span>
          <Badge className="shrink-0 border-transparent bg-blue-100 px-2.5 py-1 text-sm font-semibold text-blue-800">
            {recordLabel}
          </Badge>
        </CardTitle>
        {description ? (
          <p className="text-sm font-normal text-muted-foreground">
            {description}
          </p>
        ) : null}
      </CardHeader>
      <CardBody className="p-0">
        {count === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground sm:px-5">
            {empty}
          </p>
        ) : (
          children
        )}
      </CardBody>
    </Card>
  );
}

function SummaryTable({ children }: { children: React.ReactNode }) {
  return <Table className="w-full">{children}</Table>;
}

/** Shrink-wrap column (money, status). Pair with one `w-full` flex column. */
const COL_HUG = "whitespace-nowrap";
/** Eye column: no fixed width; keep space from amount and from the card edge. */
const COL_EYE = "pl-4 pr-5";

function SummaryTableHeader({ children }: { children: React.ReactNode }) {
  return (
    <TableHeader className="border-t border-slate-200 bg-slate-50">
      {children}
    </TableHeader>
  );
}

function ViewEye({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild variant="outline" size="icon-sm">
      <Link href={href} aria-label={label}>
        <Eye className="size-4" aria-hidden />
      </Link>
    </Button>
  );
}

function formatTime(value: Date | string, locale: string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function DailySummaryPanel({ summary }: Props) {
  const t = useTranslations("dailySummary");
  const locale = useLocale();
  const moneyLocale = locale.startsWith("hi")
    ? "hi-IN"
    : locale.startsWith("gu")
      ? "gu-IN"
      : "en-IN";

  function money(paise: Paise) {
    return formatRupees(paise, moneyLocale);
  }

  function records(count: number) {
    return t("recordCount", { count });
  }

  const { kpis } = summary;
  const moneyOutPaise = kpis.expensePaise + kpis.refundedPaise;

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          tone="blue"
          label={t("kpi.jobCards")}
          value={String(kpis.jobCardsCreated)}
          hint={t("kpi.inspectionsHint", { count: kpis.inspections })}
        />
        <KpiCard
          tone="emerald"
          label={t("kpi.completed")}
          value={String(kpis.jobsCompleted)}
          hint={t("kpi.openJobsHint", { count: kpis.openJobsNow })}
        />
        <KpiCard
          tone="violet"
          label={t("kpi.moneyIn")}
          value={money(kpis.collectedPaise)}
          hint={t("kpi.collectedSplit", {
            cash: money(kpis.cashCollectedPaise),
            upi: money(kpis.upiCollectedPaise),
            card: money(kpis.cardCollectedPaise),
          })}
        />
        <KpiCard
          tone="amber"
          label={t("kpi.moneyOut")}
          value={money(moneyOutPaise)}
          hint={t("kpi.moneyOutHint", {
            expenses: money(kpis.expensePaise),
            refunds: money(kpis.refundedPaise),
          })}
        />
      </div>

      <Section
        title={t("sections.jobCards")}
        empty={t("sections.jobCardsEmpty")}
        count={summary.jobCards.length}
        recordLabel={records(summary.jobCards.length)}
      >
        <SummaryTable>
          <SummaryTableHeader>
            <TableRow>
              <TableHead className={COL_HUG}>{t("columns.jobCard")}</TableHead>
              <TableHead className={COL_HUG}>{t("columns.customer")}</TableHead>
              <TableHead className={COL_HUG}>{t("columns.vehicle")}</TableHead>
              <TableHead className={COL_HUG}>{t("columns.status")}</TableHead>
              <TableHead className={COL_HUG}>{t("columns.time")}</TableHead>
              <TableHead className={COL_EYE} />
            </TableRow>
          </SummaryTableHeader>
          <TableBody>
            {summary.jobCards.map((row) => (
              <TableRow key={row.id}>
                <TableCell className={cn(COL_HUG, "font-medium")}>
                  #{row.jobCardNumber}
                </TableCell>
                <TableCell className={cn(COL_HUG, "truncate")}>
                  {row.customerName}
                </TableCell>
                <TableCell
                  className={cn(COL_HUG, "text-muted-foreground")}
                >
                  {row.registrationNumber}
                </TableCell>
                <TableCell className={COL_HUG}>
                  <Badge variant="secondary">{row.status}</Badge>
                </TableCell>
                <TableCell
                  className={cn(COL_HUG, "tabular-nums text-muted-foreground")}
                >
                  {formatTime(row.createdAt, locale)}
                </TableCell>
                <TableCell className={COL_EYE}>
                  <ViewEye
                    href={`/orders/${row.id}`}
                    label={t("viewRow")}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </SummaryTable>
      </Section>

      <Section
        title={t("sections.inspections")}
        empty={t("sections.inspectionsEmpty")}
        count={summary.inspections.length}
        recordLabel={records(summary.inspections.length)}
      >
        <SummaryTable>
          <SummaryTableHeader>
            <TableRow>
              <TableHead className={COL_HUG}>{t("columns.customer")}</TableHead>
              <TableHead className={COL_HUG}>{t("columns.vehicle")}</TableHead>
              <TableHead className={COL_HUG}>{t("columns.time")}</TableHead>
              <TableHead className={COL_EYE} />
            </TableRow>
          </SummaryTableHeader>
          <TableBody>
            {summary.inspections.map((row) => (
              <TableRow key={row.id}>
                <TableCell className={cn(COL_HUG, "truncate font-medium")}>
                  {row.customerName}
                </TableCell>
                <TableCell
                  className={cn(COL_HUG, "text-muted-foreground")}
                >
                  {row.registrationNumber}
                </TableCell>
                <TableCell
                  className={cn(COL_HUG, "tabular-nums text-muted-foreground")}
                >
                  {formatTime(row.createdAt, locale)}
                </TableCell>
                <TableCell className={COL_EYE}>
                  <ViewEye
                    href={`/inspections/${row.id}`}
                    label={t("viewRow")}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </SummaryTable>
      </Section>

      <Section
        title={t("sections.invoices")}
        empty={t("sections.invoicesEmpty")}
        count={summary.invoices.length}
        recordLabel={records(summary.invoices.length)}
      >
        <SummaryTable>
          <SummaryTableHeader>
            <TableRow>
              <TableHead className={COL_HUG}>{t("columns.invoice")}</TableHead>
              <TableHead className={COL_HUG}>{t("columns.customer")}</TableHead>
              <TableHead className={COL_HUG}>{t("columns.vehicle")}</TableHead>
              <TableHead className={COL_HUG}>{t("columns.jobCard")}</TableHead>
              <TableHead className={cn(COL_HUG, "text-right")}>
                {t("columns.amount")}
              </TableHead>
              <TableHead className={COL_HUG}>
                {t("columns.paymentStatus")}
              </TableHead>
              <TableHead className={COL_EYE} />
            </TableRow>
          </SummaryTableHeader>
          <TableBody>
            {summary.invoices.map((row) => (
              <TableRow key={row.id}>
                <TableCell className={cn(COL_HUG, "font-medium")}>
                  {row.invoiceNumber ?? t("draftNumber")}
                </TableCell>
                <TableCell className={cn(COL_HUG, "truncate")}>
                  {row.customerName}
                </TableCell>
                <TableCell
                  className={cn(COL_HUG, "text-muted-foreground")}
                >
                  {row.registrationNumber}
                </TableCell>
                <TableCell className={cn(COL_HUG, "tabular-nums")}>
                  #{row.jobCardNumber}
                </TableCell>
                <TableCell
                  className={cn(COL_HUG, "text-right font-medium tabular-nums")}
                >
                  {money(row.totalPaise)}
                </TableCell>
                <TableCell className={COL_HUG}>
                  {row.pendingPaise > 0 ? (
                    <span className="text-sm text-muted-foreground">
                      {t("pendingAmount", { amount: money(row.pendingPaise) })}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {t("paid")}
                    </span>
                  )}
                </TableCell>
                <TableCell className={COL_EYE}>
                  <ViewEye
                    href={`/orders/${row.serviceOrderId}?section=billing`}
                    label={t("viewRow")}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </SummaryTable>
      </Section>

      <Section
        title={t("sections.payments")}
        empty={t("sections.paymentsEmpty")}
        count={summary.payments.length}
        recordLabel={records(summary.payments.length)}
      >
        <SummaryTable>
          <SummaryTableHeader>
            <TableRow>
              <TableHead className={COL_HUG}>{t("columns.customer")}</TableHead>
              <TableHead className={COL_HUG}>{t("columns.invoice")}</TableHead>
              <TableHead className={COL_HUG}>{t("columns.method")}</TableHead>
              <TableHead className={COL_HUG}>{t("columns.time")}</TableHead>
              <TableHead className={cn(COL_HUG, "text-right")}>
                {t("columns.amount")}
              </TableHead>
              <TableHead className={COL_EYE} />
            </TableRow>
          </SummaryTableHeader>
          <TableBody>
            {summary.payments.map((row) => (
              <TableRow key={row.id}>
                <TableCell className={cn(COL_HUG, "truncate font-medium")}>
                  {row.customerName}
                </TableCell>
                <TableCell
                  className={cn(COL_HUG, "tabular-nums text-muted-foreground")}
                >
                  {row.invoiceNumber ?? "—"}
                </TableCell>
                <TableCell className={COL_HUG}>
                  {row.isRefund ? t("refund") : row.method}
                </TableCell>
                <TableCell
                  className={cn(COL_HUG, "tabular-nums text-muted-foreground")}
                >
                  {formatTime(row.receivedAt, locale)}
                </TableCell>
                <TableCell
                  className={cn(
                    COL_HUG,
                    "text-right font-medium tabular-nums",
                    row.isRefund ? "text-danger" : "text-foreground",
                  )}
                >
                  {row.isRefund ? "−" : ""}
                  {money(row.amountPaise)}
                </TableCell>
                <TableCell className={COL_EYE}>
                  <ViewEye
                    href={`/orders/${row.serviceOrderId}?section=billing`}
                    label={t("viewRow")}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </SummaryTable>
      </Section>

      <Section
        title={t("sections.expenses")}
        empty={t("sections.expensesEmpty")}
        count={summary.expenses.length}
        recordLabel={records(summary.expenses.length)}
      >
        <SummaryTable>
          <SummaryTableHeader>
            <TableRow>
              <TableHead className={COL_HUG}>{t("columns.category")}</TableHead>
              <TableHead className={COL_HUG}>{t("columns.status")}</TableHead>
              <TableHead className={COL_HUG}>{t("columns.method")}</TableHead>
              <TableHead className={COL_HUG}>{t("columns.note")}</TableHead>
              <TableHead className={cn(COL_HUG, "text-right")}>
                {t("columns.amount")}
              </TableHead>
              <TableHead className={COL_EYE} />
            </TableRow>
          </SummaryTableHeader>
          <TableBody>
            {summary.expenses.map((row) => (
              <TableRow key={row.id}>
                <TableCell className={cn(COL_HUG, "font-medium")}>
                  {row.category}
                </TableCell>
                <TableCell className={COL_HUG}>
                  <Badge
                    variant={row.status === "PAID" ? "success" : "warning"}
                  >
                    {row.status}
                  </Badge>
                </TableCell>
                <TableCell
                  className={cn(COL_HUG, "text-muted-foreground")}
                >
                  {row.method ?? "—"}
                </TableCell>
                <TableCell className={cn(COL_HUG, "truncate text-muted-foreground")}>
                  {row.note ?? "—"}
                </TableCell>
                <TableCell
                  className={cn(COL_HUG, "text-right font-medium tabular-nums")}
                >
                  {money(row.amountPaise)}
                </TableCell>
                <TableCell className={COL_EYE}>
                  <ViewEye href="/expenses" label={t("viewRow")} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </SummaryTable>
      </Section>

      <Section
        title={t("sections.openDues")}
        description={t("sections.openDuesDescription")}
        empty={t("sections.openDuesEmpty")}
        count={summary.openDues.length}
        recordLabel={records(summary.openDues.length)}
      >
        <SummaryTable>
          <SummaryTableHeader>
            <TableRow>
              <TableHead className={COL_HUG}>{t("columns.invoice")}</TableHead>
              <TableHead className={COL_HUG}>{t("columns.customer")}</TableHead>
              <TableHead className={cn(COL_HUG, "text-right")}>
                {t("columns.amount")}
              </TableHead>
              <TableHead className={cn(COL_HUG, "text-right")}>
                {t("columns.received")}
              </TableHead>
              <TableHead className={cn(COL_HUG, "text-right")}>
                {t("columns.amountDue")}
              </TableHead>
              <TableHead className={COL_EYE} />
            </TableRow>
          </SummaryTableHeader>
          <TableBody>
            {summary.openDues.map((row) => (
              <TableRow key={row.id}>
                <TableCell className={cn(COL_HUG, "font-medium tabular-nums")}>
                  {row.invoiceNumber ?? "—"}
                </TableCell>
                <TableCell className={cn(COL_HUG, "truncate")}>
                  {row.customerName}
                </TableCell>
                <TableCell
                  className={cn(
                    COL_HUG,
                    "text-right font-semibold tabular-nums text-foreground",
                  )}
                >
                  {money(row.totalPaise)}
                </TableCell>
                <TableCell
                  className={cn(
                    COL_HUG,
                    "text-right tabular-nums",
                    row.amountPaidPaise > 0
                      ? "font-bold text-emerald-700"
                      : "text-muted-foreground",
                  )}
                >
                  {money(row.amountPaidPaise)}
                </TableCell>
                <TableCell
                  className={cn(
                    COL_HUG,
                    "text-right font-semibold tabular-nums text-amber-700",
                  )}
                >
                  {money(row.pendingPaise)}
                </TableCell>
                <TableCell className={COL_EYE}>
                  <ViewEye
                    href={`/orders/${row.serviceOrderId}?section=billing`}
                    label={t("viewRow")}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </SummaryTable>
      </Section>
    </div>
  );
}
