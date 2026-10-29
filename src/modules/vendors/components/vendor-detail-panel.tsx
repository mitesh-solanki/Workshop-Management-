"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  FileText,
  Mail,
  MapPin,
  NotebookPen,
  Pencil,
  Phone,
  PackageMinus,
  Plus,
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
import { Button } from "@/components/ui/button";
import { Card, CardDescription } from "@/components/ui/card";
import { ListCard, ListCardGroup } from "@/components/ui/list-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  sectionDomId,
  useSectionScrollSpy,
} from "@/hooks/use-section-scroll-spy";
import { formatRupees } from "@/lib/money";
import { cn } from "@/lib/utils";

import { CreatePartsRequestModal } from "@/modules/purchases/components/create-parts-request-modal";
import {
  CreatePurchaseOrderModal,
  type OpenPartsRequestOption,
} from "@/modules/purchases/components/create-purchase-order-modal";
import { CreatePurchaseReturnModal } from "@/modules/purchases/components/create-purchase-return-modal";
import { CreateVendorBillModal } from "@/modules/purchases/components/create-vendor-bill-modal";
import {
  EditVendorModal,
  type EditVendorValues,
} from "@/modules/vendors/components/edit-vendor-modal";
import {
  VENDOR_SECTION_ID_PREFIX,
  VENDOR_SECTIONS,
  type VendorSection,
} from "@/modules/vendors/vendor-sections";

type PurchaseOrderRow = {
  id: string;
  number: string;
  status: string;
  createdAt: Date | string;
};

type BillRow = {
  id: string;
  billNumber: string | null;
  billDate: Date | string;
  amountPaise: number;
  outstandingPaise: number;
};

type ReturnRow = {
  id: string;
  quantity: number;
  creditPaise: number;
  createdAt: Date | string;
  part: { id: string; name: string; sku: string; unit: string };
};

type PartOption = { id: string; name: string; sku: string; unit: string };

type Props = {
  vendor: EditVendorValues;
  outstandingPaise: number;
  purchaseOrders: PurchaseOrderRow[];
  bills: BillRow[];
  returns: ReturnRow[];
  openRequests: OpenPartsRequestOption[];
  parts: PartOption[];
  canWrite: boolean;
  canCreatePurchaseOrder: boolean;
  canCreateBill: boolean;
  initialSection?: VendorSection;
};

function poStatusVariant(
  status: string,
): "warning" | "secondary" | "success" | "outline" {
  if (status === "PENDING") return "warning";
  if (status === "PARTIALLY_RECEIVED") return "secondary";
  if (status === "RECEIVED") return "success";
  return "outline";
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
}: {
  icon: LucideIcon;
  title: string;
  body: string;
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
    </div>
  );
}

export function VendorDetailPanel({
  vendor,
  outstandingPaise,
  purchaseOrders,
  bills,
  returns,
  openRequests,
  parts,
  canWrite,
  canCreatePurchaseOrder,
  canCreateBill,
  initialSection = "details",
}: Props) {
  const t = useTranslations("vendors");
  const tPo = useTranslations("purchaseOrders");
  const tBill = useTranslations("vendorBills");
  const tReturn = useTranslations("purchaseReturns");
  const locale = useLocale();
  usePageDetailLabel(vendor.name);

  const { activeSection, scrollToSection, setSectionRef } =
    useSectionScrollSpy({
      sections: VENDOR_SECTIONS,
      idPrefix: VENDOR_SECTION_ID_PREFIX,
      initialSection,
    });

  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const vendorOption = [{ id: vendor.id, name: vendor.name }];
  const vendorPos = purchaseOrders.map((po) => ({
    id: po.id,
    number: po.number,
    vendorId: vendor.id,
  }));
  const vendorBillOptions = bills.map((bill) => ({
    id: bill.id,
    label: bill.billNumber ?? t("billUntitled"),
    vendorId: vendor.id,
  }));

  const createRequestModal = canCreatePurchaseOrder ? (
    <CreatePartsRequestModal
      parts={parts}
      stayAndRefresh
      allowAddPart
      size="sm"
      trigger={
        <Button type="button" variant="outline" size="md">
          <Plus className="size-4" aria-hidden />
          {t("requestPart")}
        </Button>
      }
    />
  ) : null;

  const createPoModal = canCreatePurchaseOrder ? (
    <CreatePurchaseOrderModal
      vendors={vendorOption}
      openRequests={openRequests}
      defaultVendorId={vendor.id}
      stayAndRefresh
      size="sm"
      trigger={
        <Button type="button" size="md">
          <Plus className="size-4" aria-hidden />
          {t("createPurchaseOrder")}
        </Button>
      }
    />
  ) : null;

  const purchaseOrderActions =
    createRequestModal || createPoModal ? (
      <div className="flex flex-wrap items-center gap-2">
        {createRequestModal}
        {createPoModal}
      </div>
    ) : null;

  const createBillModal = canCreateBill ? (
    <CreateVendorBillModal
      vendors={vendorOption}
      purchaseOrders={vendorPos}
      defaultVendorId={vendor.id}
      stayAndRefresh
      size="sm"
      trigger={
        <Button type="button" size="md">
          <Plus className="size-4" aria-hidden />
          {t("recordBill")}
        </Button>
      }
    />
  ) : null;

  const createReturnModal = canCreateBill ? (
    <CreatePurchaseReturnModal
      vendors={vendorOption}
      parts={parts}
      bills={vendorBillOptions}
      defaultVendorId={vendor.id}
      stayAndRefresh
      size="sm"
      trigger={
        <Button type="button" size="md">
          <Plus className="size-4" aria-hidden />
          {t("createReturn")}
        </Button>
      }
    />
  ) : null;

  const navItems = [
    { id: "details" as const, label: t("sections.summary"), icon: NotebookPen },
    {
      id: "purchaseOrders" as const,
      label: t("sections.purchaseOrders"),
      icon: ShoppingCart,
    },
    { id: "bills" as const, label: t("sections.bills"), icon: FileText },
    { id: "returns" as const, label: t("sections.returns"), icon: PackageMinus },
  ];

  const navProps = {
    title: t("sectionsTitle"),
    items: navItems,
    active: activeSection,
    onChange: scrollToSection,
  } as const;

  const metaParts = [
    vendor.phone?.trim() || null,
    vendor.email?.trim() || null,
    vendor.gstin?.trim() || null,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      <header
        className={cn(
          "flex flex-wrap items-center justify-between gap-3",
          activeSection !== "details" && "hidden lg:flex",
        )}
      >
        <div className="min-w-0">
          <h1 className="truncate text-[clamp(24px,3.5vw,30px)] leading-tight font-semibold tracking-[0.02em] text-[#152238]">
            {vendor.name}
          </h1>
          {metaParts.length > 0 ? (
            <p className="mt-1 truncate text-[14px] text-[#5c6b7e]">
              {metaParts.map((part, index) => (
                <span key={`${part}-${index}`}>
                  {index > 0 ? (
                    <span className="text-slate-300"> · </span>
                  ) : null}
                  {part}
                </span>
              ))}
            </p>
          ) : null}
        </div>
        <span className="inline-flex min-h-9 items-center rounded-full border border-[#c9d8ff] bg-[#e8efff] px-3 py-1.5 text-[13px] font-extrabold tabular-nums text-[#1f5eff]">
          {formatRupees(outstandingPaise)}
        </span>
      </header>

      <SectionMobileNavBar {...navProps} />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(220px,260px)_minmax(0,1fr)] lg:gap-6">
        <SectionDesktopNav {...navProps} />

        <div className="flex min-w-0 flex-col gap-4">
          <SectionBlock
            id={sectionDomId(VENDOR_SECTION_ID_PREFIX, "details")}
            title={t("sections.summary")}
            subtitle={t("detailsDescription")}
            sectionRef={setSectionRef("details")}
            action={
              canWrite ? (
                <EditVendorModal
                  vendor={vendor}
                  trigger={
                    <Button type="button" variant="outline" size="md">
                      <Pencil className="size-4" aria-hidden />
                      {t("edit")}
                    </Button>
                  }
                />
              ) : null
            }
          >
            <dl className="grid gap-4 px-5 py-5 sm:grid-cols-2 sm:gap-x-8 sm:px-6">
              <Fact
                icon={Phone}
                label={t("phone")}
                value={
                  vendor.phone ? (
                    <a
                      href={`tel:${vendor.phone}`}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {vendor.phone}
                    </a>
                  ) : (
                    t("notSet")
                  )
                }
                muted={!vendor.phone}
              />
              <Fact
                icon={Mail}
                label={t("email")}
                value={
                  vendor.email ? (
                    <a
                      href={`mailto:${vendor.email}`}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {vendor.email}
                    </a>
                  ) : (
                    t("notSet")
                  )
                }
                muted={!vendor.email}
              />
              <Fact
                icon={Truck}
                label={t("gstin")}
                value={vendor.gstin ?? t("notSet")}
                muted={!vendor.gstin}
              />
              <Fact
                icon={MapPin}
                label={t("address")}
                value={vendor.address ?? t("notSet")}
                muted={!vendor.address}
              />
              <Fact
                icon={NotebookPen}
                label={t("notes")}
                value={vendor.notes ?? t("notSet")}
                muted={!vendor.notes}
                multiline
                className="sm:col-span-2"
              />
            </dl>
          </SectionBlock>

          <SectionBlock
            id={sectionDomId(VENDOR_SECTION_ID_PREFIX, "purchaseOrders")}
            title={t("sections.purchaseOrders")}
            subtitle={t("purchaseOrdersDescription")}
            sectionRef={setSectionRef("purchaseOrders")}
            action={purchaseOrderActions}
          >
            {purchaseOrders.length === 0 ? (
              <SectionEmpty
                icon={ShoppingCart}
                title={t("emptyPurchaseOrders")}
                body={t("emptyPurchaseOrdersDescription")}
              />
            ) : (
              <ListCardGroup className="rounded-none border-0 shadow-none">
                {purchaseOrders.map((po) => (
                  <li key={po.id}>
                    <ListCard
                      href={`/purchase-orders/${po.id}`}
                      title={po.number}
                      subtitle={dateFmt.format(new Date(po.createdAt))}
                      className="px-5 py-3.5 sm:px-6"
                      trailing={
                        <Badge variant={poStatusVariant(po.status)}>
                          {tPo(`statuses.${po.status}`)}
                        </Badge>
                      }
                    />
                  </li>
                ))}
              </ListCardGroup>
            )}
          </SectionBlock>

          <SectionBlock
            id={sectionDomId(VENDOR_SECTION_ID_PREFIX, "bills")}
            title={t("sections.bills")}
            subtitle={t("billsDescription")}
            sectionRef={setSectionRef("bills")}
            action={createBillModal}
          >
            {bills.length === 0 ? (
              <SectionEmpty
                icon={FileText}
                title={t("emptyBills")}
                body={t("emptyBillsDescription")}
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-100 [&_tr]:border-border">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-slate-700">
                        {tBill("columns.bill")}
                      </TableHead>
                      <TableHead className="text-slate-700">
                        {tBill("columns.date")}
                      </TableHead>
                      <TableHead className="text-right text-slate-700">
                        {tBill("columns.amount")}
                      </TableHead>
                      <TableHead className="text-right text-slate-700">
                        {tBill("columns.outstanding")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bills.map((bill) => (
                      <TableRow key={bill.id} className="hover:bg-muted/50">
                        <TableCell>
                          <Link
                            href={`/vendor-bills/${bill.id}`}
                            className="font-medium text-foreground hover:underline"
                          >
                            {bill.billNumber ?? t("billUntitled")}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {dateFmt.format(new Date(bill.billDate))}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums text-foreground">
                          {formatRupees(bill.amountPaise)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-semibold tabular-nums",
                            bill.outstandingPaise <= 0
                              ? "text-emerald-700"
                              : "text-amber-700",
                          )}
                        >
                          {formatRupees(bill.outstandingPaise)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </SectionBlock>

          <SectionBlock
            id={sectionDomId(VENDOR_SECTION_ID_PREFIX, "returns")}
            title={t("sections.returns")}
            subtitle={t("returnsDescription")}
            sectionRef={setSectionRef("returns")}
            action={createReturnModal}
          >
            {returns.length === 0 ? (
              <SectionEmpty
                icon={PackageMinus}
                title={t("emptyReturns")}
                body={t("emptyReturnsDescription")}
              />
            ) : (
              <div className="overflow-x-auto">
                <Table className="table-fixed">
                  <TableHeader className="bg-slate-100 [&_tr]:border-border">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[40%] text-slate-700">
                        {tReturn("columns.part")}
                      </TableHead>
                      <TableHead className="w-[18%] text-right text-slate-700">
                        {tReturn("columns.quantity")}
                      </TableHead>
                      <TableHead className="w-[22%] text-slate-700">
                        {tReturn("columns.date")}
                      </TableHead>
                      <TableHead className="w-[20%] text-right text-slate-700">
                        {tReturn("columns.credit")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {returns.map((row) => (
                      <TableRow key={row.id} className="hover:bg-muted/50">
                        <TableCell className="max-w-0">
                          <p className="truncate font-medium text-slate-900">
                            {row.part.name}
                          </p>
                          <p className="truncate text-caption text-muted-foreground">
                            {row.part.sku}
                          </p>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-foreground">
                          {row.quantity}{" "}
                          <span className="text-muted-foreground">
                            {row.part.unit}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {dateFmt.format(new Date(row.createdAt))}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums text-red-600">
                          {formatRupees(row.creditPaise)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </SectionBlock>
        </div>
      </div>
    </div>
  );
}
