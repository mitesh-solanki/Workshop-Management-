"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ClipboardList,
  NotebookPen,
  Package,
  PackageCheck,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePageDetailLabel } from "@/components/page-chrome";
import {
  SectionDesktopNav,
  SectionMobileNavBar,
} from "@/components/shared/section-side-nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription } from "@/components/ui/card";
import {
  sectionDomId,
  useSectionScrollSpy,
} from "@/hooks/use-section-scroll-spy";
import { cn } from "@/lib/utils";
import { ReceiveGoodsModal } from "@/modules/purchases/components/receive-goods-modal";
import {
  PURCHASE_ORDER_SECTION_ID_PREFIX,
  PURCHASE_ORDER_SECTIONS,
} from "@/modules/purchases/purchase-order-sections";

type PoLine = {
  id: string;
  quantityOrdered: number;
  quantityReceived: number;
  part: { id: string; name: string; sku: string; unit: string };
};

type ReceiptRow = {
  id: string;
  notes: string | null;
  createdAt: Date | string;
  lines: Array<{ id: string; quantity: number }>;
};

type Props = {
  purchaseOrder: {
    id: string;
    number: string;
    status: string;
    notes: string | null;
    createdAt: Date | string;
    vendor: { id: string; name: string };
    lines: PoLine[];
    goodsReceipts: ReceiptRow[];
  };
};

function statusVariant(
  status: string,
): "warning" | "secondary" | "success" | "outline" {
  if (status === "PENDING") return "warning";
  if (status === "PARTIALLY_RECEIVED") return "secondary";
  if (status === "RECEIVED") return "success";
  return "outline";
}

function lineProgressPercent(received: number, ordered: number): number {
  if (ordered <= 0) return 0;
  return Math.min(100, Math.round((received / ordered) * 100));
}

function SectionBlock({
  id,
  title,
  subtitle,
  action,
  sectionRef,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  sectionRef: (node: HTMLElement | null) => void;
  children: ReactNode;
}) {
  return (
    <Card
      id={id}
      ref={sectionRef}
      className="min-w-0 scroll-mt-4 gap-0 overflow-visible py-0"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
        <div className="min-w-0 space-y-0.5">
          <h2 className="text-section-title text-slate-900">{title}</h2>
          {subtitle ? <CardDescription>{subtitle}</CardDescription> : null}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
  muted = false,
  multiline = false,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  muted?: boolean;
  multiline?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-3", className)}>
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 space-y-0.5">
        <dt className="text-caption font-medium text-slate-500">{label}</dt>
        <dd
          className={cn(
            "text-body text-slate-900",
            muted && "text-slate-500",
            multiline && "whitespace-pre-wrap",
          )}
        >
          {value}
        </dd>
      </div>
    </div>
  );
}

function SectionEmpty({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-5 py-12 text-center sm:px-6">
      <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="max-w-md space-y-0.5">
        <p className="text-section-title text-slate-900">{title}</p>
        <p className="text-body text-slate-600">{body}</p>
      </div>
      {action}
    </div>
  );
}

export function PurchaseOrderDetailPanel({ purchaseOrder: po }: Props) {
  const t = useTranslations("purchaseOrders");
  const locale = useLocale();
  usePageDetailLabel(po.number);

  const { activeSection, scrollToSection, setSectionRef } =
    useSectionScrollSpy({
      sections: PURCHASE_ORDER_SECTIONS,
      idPrefix: PURCHASE_ORDER_SECTION_ID_PREFIX,
      initialSection: "summary",
    });

  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const orderedTotal = po.lines.reduce(
    (sum, line) => sum + line.quantityOrdered,
    0,
  );
  const receivedTotal = po.lines.reduce(
    (sum, line) => sum + line.quantityReceived,
    0,
  );
  const remainingTotal = Math.max(0, orderedTotal - receivedTotal);
  const overallPercent = lineProgressPercent(receivedTotal, orderedTotal);
  const linesComplete = po.lines.filter(
    (line) => line.quantityReceived >= line.quantityOrdered,
  ).length;

  const receiveAction =
    po.status !== "RECEIVED" ? (
      <ReceiveGoodsModal
        purchaseOrderId={po.id}
        poNumber={po.number}
        lines={po.lines}
      />
    ) : null;

  const navItems = [
    {
      id: "summary" as const,
      label: t("sections.summary"),
      icon: NotebookPen,
    },
    {
      id: "lines" as const,
      label: t("sections.lines"),
      icon: ClipboardList,
    },
    {
      id: "receipts" as const,
      label: t("sections.receipts"),
      icon: PackageCheck,
    },
  ];

  const navProps = {
    title: t("sectionsTitle"),
    items: navItems,
    active: activeSection,
    onChange: scrollToSection,
  } as const;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div
          className={cn(
            "min-w-0",
            activeSection !== "summary" && "hidden lg:block",
          )}
        >
          <h1 className="truncate text-[clamp(24px,3.5vw,30px)] leading-tight font-semibold tracking-[0.02em] text-[#152238]">
            {po.number}
          </h1>
          <p className="mt-1 truncate text-[14px] text-[#5c6b7e]">
            <Link
              href={`/vendors/${po.vendor.id}`}
              className="font-medium text-blue-700 hover:underline"
            >
              {po.vendor.name}
            </Link>
            <span className="text-slate-300"> · </span>
            {dateFmt.format(new Date(po.createdAt))}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Badge variant={statusVariant(po.status)} className="min-h-9 px-3">
            {t(`statuses.${po.status}`)}
          </Badge>
          {receiveAction}
        </div>
      </header>

      <SectionMobileNavBar {...navProps} />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(220px,260px)_minmax(0,1fr)] lg:gap-6">
        <SectionDesktopNav {...navProps} />

        <div className="flex min-w-0 flex-col gap-4">
          <SectionBlock
            id={sectionDomId(PURCHASE_ORDER_SECTION_ID_PREFIX, "summary")}
            title={t("sections.summary")}
            subtitle={t("summaryDescription")}
            sectionRef={setSectionRef("summary")}
          >
            <div className="border-b border-border bg-slate-50/80 px-5 py-4 sm:px-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-caption text-muted-foreground">
                    {t("progressOrdered")}
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                    {orderedTotal}
                  </p>
                </div>
                <div>
                  <p className="text-caption text-muted-foreground">
                    {t("progressReceived")}
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-700">
                    {receivedTotal}
                  </p>
                </div>
                <div>
                  <p className="text-caption text-muted-foreground">
                    {t("progressRemaining")}
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-xl font-semibold tabular-nums",
                      remainingTotal > 0
                        ? "text-amber-700"
                        : "text-emerald-700",
                    )}
                  >
                    {remainingTotal}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {t("progressSummary", {
                      received: receivedTotal,
                      ordered: orderedTotal,
                      linesDone: linesComplete,
                      linesTotal: po.lines.length,
                    })}
                  </p>
                  <p className="text-sm tabular-nums text-muted-foreground">
                    {overallPercent}%
                  </p>
                </div>
                <div
                  className="h-2.5 overflow-hidden rounded-full bg-slate-100"
                  role="progressbar"
                  aria-valuenow={overallPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={t("progressLabel")}
                >
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width]",
                      po.status === "RECEIVED"
                        ? "bg-emerald-500"
                        : po.status === "PARTIALLY_RECEIVED"
                          ? "bg-blue-500"
                          : "bg-slate-300",
                    )}
                    style={{ width: `${overallPercent}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  {po.status === "RECEIVED"
                    ? t("fullyReceivedHint")
                    : t("partialReceiveHint")}
                </p>
              </div>
            </div>

            <dl className="grid gap-4 px-5 py-5 sm:grid-cols-2 sm:gap-x-8 sm:px-6">
              <Fact
                icon={Truck}
                label={t("vendor")}
                value={
                  <Link
                    href={`/vendors/${po.vendor.id}`}
                    className="font-medium text-blue-700 hover:underline"
                  >
                    {po.vendor.name}
                  </Link>
                }
              />
              <Fact
                icon={CalendarDays}
                label={t("columns.date")}
                value={dateFmt.format(new Date(po.createdAt))}
              />
              <Fact
                icon={Package}
                label={t("columns.lines")}
                value={t("lineCount", { count: po.lines.length })}
              />
              <Fact
                icon={NotebookPen}
                label={t("notes")}
                value={po.notes?.trim() ? po.notes : t("notSet")}
                muted={!po.notes?.trim()}
                multiline
                className="sm:col-span-2"
              />
            </dl>
          </SectionBlock>

          <SectionBlock
            id={sectionDomId(PURCHASE_ORDER_SECTION_ID_PREFIX, "lines")}
            title={t("sections.lines")}
            subtitle={t("linesDescription")}
            sectionRef={setSectionRef("lines")}
            action={
              <span className="text-sm text-muted-foreground">
                {t("lineCount", { count: po.lines.length })}
              </span>
            }
          >
            {po.lines.length === 0 ? (
              <SectionEmpty
                icon={ClipboardList}
                title={t("linesEmptyTitle")}
                body={t("linesEmptyHint")}
              />
            ) : (
              <ul className="divide-y divide-border">
                {po.lines.map((line) => {
                  const remaining = Math.max(
                    0,
                    line.quantityOrdered - line.quantityReceived,
                  );
                  const percent = lineProgressPercent(
                    line.quantityReceived,
                    line.quantityOrdered,
                  );
                  const complete = remaining === 0;

                  return (
                    <li key={line.id} className="px-5 py-4 sm:px-6">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900">
                            {line.part.name}
                          </p>
                          <p className="text-caption text-muted-foreground">
                            {line.part.sku}
                          </p>
                        </div>
                        <Badge variant={complete ? "success" : "secondary"}>
                          {complete
                            ? t("lineComplete")
                            : t("lineWaiting", { count: remaining })}
                        </Badge>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-3">
                        <div>
                          <p className="text-caption text-muted-foreground">
                            {t("qtyOrdered")}
                          </p>
                          <p className="mt-0.5 text-base font-semibold tabular-nums">
                            {line.quantityOrdered}{" "}
                            <span className="text-sm font-normal text-muted-foreground">
                              {line.part.unit}
                            </span>
                          </p>
                        </div>
                        <div>
                          <p className="text-caption text-muted-foreground">
                            {t("qtyReceived")}
                          </p>
                          <p className="mt-0.5 text-base font-semibold tabular-nums text-emerald-700">
                            {line.quantityReceived}
                          </p>
                        </div>
                        <div>
                          <p className="text-caption text-muted-foreground">
                            {t("qtyRemaining")}
                          </p>
                          <p
                            className={cn(
                              "mt-0.5 text-base font-semibold tabular-nums",
                              remaining > 0
                                ? "text-amber-700"
                                : "text-emerald-700",
                            )}
                          >
                            {remaining}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            complete ? "bg-emerald-500" : "bg-blue-500",
                          )}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionBlock>

          <SectionBlock
            id={sectionDomId(PURCHASE_ORDER_SECTION_ID_PREFIX, "receipts")}
            title={t("sections.receipts")}
            subtitle={t("receiptsDescription")}
            sectionRef={setSectionRef("receipts")}
          >
            {po.goodsReceipts.length === 0 ? (
              <SectionEmpty
                icon={Package}
                title={t("receiptsEmptyTitle")}
                body={t("receiptsEmptyHint")}
              />
            ) : (
              <ul className="divide-y divide-border">
                {po.goodsReceipts.map((receipt, index) => {
                  const qty = receipt.lines.reduce(
                    (sum, line) => sum + line.quantity,
                    0,
                  );
                  return (
                    <li
                      key={receipt.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 sm:px-6"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">
                          {t("receiptNumber", { number: index + 1 })}
                        </p>
                        <p className="text-caption text-muted-foreground">
                          {dateFmt.format(new Date(receipt.createdAt))}
                          {receipt.notes ? ` · ${receipt.notes}` : null}
                        </p>
                      </div>
                      <p className="text-sm tabular-nums text-foreground">
                        {t("receiptQty", {
                          count: qty,
                          lines: receipt.lines.length,
                        })}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionBlock>
        </div>
      </div>
    </div>
  );
}
