"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  Banknote,
  CalendarDays,
  FileText,
  NotebookPen,
  PackageMinus,
  Paperclip,
  ShoppingCart,
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
import { formatRupees } from "@/lib/money";
import { cn } from "@/lib/utils";
import { RecordPaymentModal } from "@/modules/purchases/components/record-payment-modal";
import {
  VendorBillAttachment,
  VendorBillAttachmentActions,
} from "@/modules/purchases/components/vendor-bill-attachment";
import {
  VENDOR_BILL_SECTION_ID_PREFIX,
  VENDOR_BILL_SECTIONS,
} from "@/modules/purchases/vendor-bill-sections";

type PaymentRow = {
  id: string;
  amountPaise: number;
  method: string;
  paidAt: Date | string;
  notes: string | null;
};

type ReturnRow = {
  id: string;
  quantity: number;
  creditPaise: number;
  createdAt: Date | string;
  part: { id: string; name: string; sku: string; unit: string };
};

type Props = {
  bill: {
    id: string;
    billNumber: string | null;
    billDate: Date | string;
    amountPaise: number;
    outstandingPaise: number;
    paymentsPaise: number;
    returnsCreditPaise: number;
    notes: string | null;
    attachmentStorageKey: string | null;
    attachmentContentType: string | null;
    attachmentFileName: string | null;
    attachmentUrl: string | null;
    vendor: { id: string; name: string; phone: string | null; gstin: string | null };
    purchaseOrder: { id: string; number: string } | null;
    payments: PaymentRow[];
    returns: ReturnRow[];
  };
  canWrite: boolean;
};

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

const PAYMENT_METHODS = ["CASH", "UPI", "BANK", "CARD", "OTHER"] as const;

function methodLabel(
  t: ReturnType<typeof useTranslations<"vendorBills">>,
  method: string,
) {
  if ((PAYMENT_METHODS as readonly string[]).includes(method)) {
    return t(
      `methods.${method as (typeof PAYMENT_METHODS)[number]}`,
    );
  }
  return method;
}

export function VendorBillDetailPanel({ bill, canWrite }: Props) {
  const t = useTranslations("vendorBills");
  const locale = useLocale();
  const billLabel = bill.billNumber?.trim() || t("billUntitled");
  usePageDetailLabel(billLabel);

  const { activeSection, scrollToSection, setSectionRef } =
    useSectionScrollSpy({
      sections: VENDOR_BILL_SECTIONS,
      idPrefix: VENDOR_BILL_SECTION_ID_PREFIX,
      initialSection: "summary",
    });

  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const paidOff = bill.outstandingPaise <= 0;
  const paymentAction =
    canWrite && !paidOff ? (
      <RecordPaymentModal
        vendorBillId={bill.id}
        billLabel={billLabel}
        outstandingPaise={bill.outstandingPaise}
      />
    ) : null;

  const navItems = [
    {
      id: "summary" as const,
      label: t("sections.summary"),
      icon: NotebookPen,
    },
    {
      id: "payments" as const,
      label: t("sections.payments"),
      icon: Banknote,
    },
    {
      id: "attachment" as const,
      label: t("sections.attachment"),
      icon: Paperclip,
    },
    {
      id: "returns" as const,
      label: t("sections.returns"),
      icon: PackageMinus,
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
      <header
        className={cn(
          "flex flex-wrap items-center justify-between gap-3",
          activeSection !== "summary" && "hidden lg:flex",
        )}
      >
        <div className="min-w-0">
          <h1 className="truncate text-[clamp(24px,3.5vw,30px)] leading-tight font-semibold tracking-[0.02em] text-[#152238]">
            {billLabel}
          </h1>
          <p className="mt-1 truncate text-[14px] text-[#5c6b7e]">
            <Link
              href={`/vendors/${bill.vendor.id}`}
              className="font-medium text-blue-700 hover:underline"
            >
              {bill.vendor.name}
            </Link>
            <span className="text-slate-300"> · </span>
            {dateFmt.format(new Date(bill.billDate))}
          </p>
        </div>
        <Badge
          variant={paidOff ? "success" : "warning"}
          className="min-h-9 px-3 tabular-nums"
        >
          {paidOff
            ? t("statusPaid")
            : `${t("outstanding")} ${formatRupees(bill.outstandingPaise)}`}
        </Badge>
      </header>

      <SectionMobileNavBar {...navProps} />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(220px,260px)_minmax(0,1fr)] lg:gap-6">
        <SectionDesktopNav {...navProps} />

        <div className="flex min-w-0 flex-col gap-4">
          <SectionBlock
            id={sectionDomId(VENDOR_BILL_SECTION_ID_PREFIX, "summary")}
            title={t("sections.summary")}
            subtitle={t("summaryDescription")}
            sectionRef={setSectionRef("summary")}
          >
            <div className="grid gap-4 border-b border-border bg-slate-50/80 px-5 py-4 sm:grid-cols-3 sm:px-6">
              <div>
                <p className="text-caption text-muted-foreground">
                  {t("columns.amount")}
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                  {formatRupees(bill.amountPaise)}
                </p>
              </div>
              <div>
                <p className="text-caption text-muted-foreground">
                  {t("paidSoFar")}
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-700">
                  {formatRupees(bill.paymentsPaise)}
                </p>
              </div>
              <div>
                <p className="text-caption text-muted-foreground">
                  {t("outstanding")}
                </p>
                <p
                  className={cn(
                    "mt-1 text-xl font-semibold tabular-nums",
                    paidOff ? "text-emerald-700" : "text-amber-700",
                  )}
                >
                  {formatRupees(bill.outstandingPaise)}
                </p>
              </div>
            </div>

            <dl className="grid gap-4 px-5 py-5 sm:grid-cols-2 sm:gap-x-8 sm:px-6">
              <Fact
                icon={Truck}
                label={t("vendor")}
                value={
                  <Link
                    href={`/vendors/${bill.vendor.id}`}
                    className="font-medium text-blue-700 hover:underline"
                  >
                    {bill.vendor.name}
                  </Link>
                }
              />
              <Fact
                icon={CalendarDays}
                label={t("billDate")}
                value={dateFmt.format(new Date(bill.billDate))}
              />
              <Fact
                icon={ShoppingCart}
                label={t("purchaseOrder")}
                value={
                  bill.purchaseOrder ? (
                    <Link
                      href={`/purchase-orders/${bill.purchaseOrder.id}`}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {bill.purchaseOrder.number}
                    </Link>
                  ) : (
                    t("purchaseOrderNone")
                  )
                }
                muted={!bill.purchaseOrder}
              />
              <Fact
                icon={FileText}
                label={t("billNumber")}
                value={bill.billNumber?.trim() || t("notSet")}
                muted={!bill.billNumber?.trim()}
              />
              <Fact
                icon={Banknote}
                label={t("returnsCredit")}
                value={formatRupees(bill.returnsCreditPaise)}
              />
              <Fact
                icon={NotebookPen}
                label={t("notes")}
                value={bill.notes?.trim() ? bill.notes : t("notSet")}
                muted={!bill.notes?.trim()}
                multiline
                className="sm:col-span-2"
              />
            </dl>
          </SectionBlock>

          <SectionBlock
            id={sectionDomId(VENDOR_BILL_SECTION_ID_PREFIX, "payments")}
            title={t("sections.payments")}
            subtitle={t("paymentsDescription")}
            sectionRef={setSectionRef("payments")}
            action={paymentAction}
          >
            {bill.payments.length === 0 ? (
              <SectionEmpty
                icon={Banknote}
                title={t("emptyPaymentsTitle")}
                body={t("emptyPayments")}
              />
            ) : (
              <ul className="divide-y divide-border">
                {bill.payments.map((payment) => (
                  <li
                    key={payment.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 sm:px-6"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold tabular-nums text-slate-900">
                        {formatRupees(payment.amountPaise)}
                      </p>
                      <p className="text-caption text-muted-foreground">
                        {methodLabel(t, payment.method)} ·{" "}
                        {dateFmt.format(new Date(payment.paidAt))}
                        {payment.notes ? ` · ${payment.notes}` : null}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionBlock>

          <SectionBlock
            id={sectionDomId(VENDOR_BILL_SECTION_ID_PREFIX, "attachment")}
            title={t("sections.attachment")}
            subtitle={t("attachmentHint")}
            sectionRef={setSectionRef("attachment")}
            action={
              <VendorBillAttachmentActions
                vendorBillId={bill.id}
                canEdit={canWrite}
                hasAttachment={Boolean(bill.attachmentStorageKey)}
              />
            }
          >
            <div className="px-5 py-5 sm:px-6">
              <VendorBillAttachment
                vendorBillId={bill.id}
                canEdit={canWrite}
                embedded
                hideActions
                attachment={
                  bill.attachmentStorageKey
                    ? {
                        url: bill.attachmentUrl,
                        contentType: bill.attachmentContentType,
                        fileName: bill.attachmentFileName,
                      }
                    : null
                }
              />
            </div>
          </SectionBlock>

          <SectionBlock
            id={sectionDomId(VENDOR_BILL_SECTION_ID_PREFIX, "returns")}
            title={t("sections.returns")}
            subtitle={t("returnsDescription")}
            sectionRef={setSectionRef("returns")}
          >
            {bill.returns.length === 0 ? (
              <SectionEmpty
                icon={PackageMinus}
                title={t("emptyReturnsTitle")}
                body={t("emptyReturns")}
              />
            ) : (
              <div className="overflow-x-auto">
                <div
                  role="table"
                  className="min-w-[36rem] text-sm"
                >
                  <div
                    role="row"
                    className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,0.9fr)] gap-x-4 border-b border-border bg-slate-100 px-5 py-3 sm:px-6"
                  >
                    <div role="columnheader" className="font-medium text-slate-700">
                      {t("returnColumns.part")}
                    </div>
                    <div role="columnheader" className="font-medium text-slate-700">
                      {t("returnColumns.sku")}
                    </div>
                    <div role="columnheader" className="font-medium text-slate-700">
                      {t("returnColumns.quantity")}
                    </div>
                    <div role="columnheader" className="font-medium text-slate-700">
                      {t("returnColumns.date")}
                    </div>
                    <div
                      role="columnheader"
                      className="text-right font-medium text-slate-700"
                    >
                      {t("returnColumns.credit")}
                    </div>
                  </div>
                  {bill.returns.map((row) => (
                    <div
                      key={row.id}
                      role="row"
                      className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,0.9fr)] gap-x-4 border-b border-border px-5 py-3.5 last:border-b-0 sm:px-6"
                    >
                      <div
                        role="cell"
                        className="min-w-0 truncate font-medium text-slate-900"
                      >
                        {row.part.name}
                      </div>
                      <div
                        role="cell"
                        className="min-w-0 truncate text-muted-foreground"
                      >
                        {row.part.sku}
                      </div>
                      <div role="cell" className="tabular-nums text-foreground">
                        {row.quantity}{" "}
                        <span className="text-muted-foreground">
                          {row.part.unit}
                        </span>
                      </div>
                      <div
                        role="cell"
                        className="whitespace-nowrap text-muted-foreground"
                      >
                        {dateFmt.format(new Date(row.createdAt))}
                      </div>
                      <div
                        role="cell"
                        className="text-right font-semibold tabular-nums text-red-600"
                      >
                        {formatRupees(row.creditPaise)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SectionBlock>
        </div>
      </div>
    </div>
  );
}
