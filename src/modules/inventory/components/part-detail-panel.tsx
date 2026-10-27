"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BadgePercent,
  ClipboardList,
  History,
  NotebookPen,
  Package,
  PackagePlus,
  Pencil,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
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
  sectionDomId,
  useSectionScrollSpy,
} from "@/hooks/use-section-scroll-spy";
import { formatRupees } from "@/lib/money";
import { cn } from "@/lib/utils";
import { DeletePartButton } from "@/modules/inventory/components/delete-part-button";
import {
  EditPartModal,
  type EditPartValues,
} from "@/modules/inventory/components/edit-part-modal";
import {
  AddStockDialog,
  CorrectStockDialog,
  RemoveStockDialog,
} from "@/modules/inventory/components/stock-forms";
import {
  PART_SECTION_ID_PREFIX,
  PART_SECTIONS,
  type PartSection,
} from "@/modules/inventory/part-sections";
import { CreatePartsRequestModal } from "@/modules/purchases/components/create-parts-request-modal";

type MovementRow = {
  id: string;
  type: "IN" | "OUT" | "ADJUSTMENT";
  quantityChange: number;
  note: string | null;
  createdAt: Date | string;
};

type PartsRequestRow = {
  id: string;
  status: "OPEN" | "ORDERED" | "CANCELLED" | string;
  quantity: number;
  notes: string | null;
  createdAt: Date | string;
  purchaseOrder: {
    id: string;
    number: string;
    vendor: { id: string; name: string };
  } | null;
  serviceOrder: { id: string } | null;
};

type Props = {
  part: EditPartValues & {
    quantityOnHand: number;
  };
  unitLabel: string;
  movements: MovementRow[];
  partsRequests: PartsRequestRow[];
  canWrite: boolean;
  canManageRequests: boolean;
  locale: string;
};

function requestStatusVariant(
  status: string,
): "warning" | "secondary" | "danger" | "outline" {
  if (status === "OPEN") return "warning";
  if (status === "ORDERED") return "secondary";
  if (status === "CANCELLED") return "danger";
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
  hint,
  iconClassName,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: string;
  iconClassName: string;
}) {
  return (
    <div className="flex gap-3">
      <span
        className={cn(
          "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl",
          iconClassName,
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 space-y-1">
        <dt className="text-body font-medium text-slate-600">{label}</dt>
        <dd className="text-lg font-semibold tabular-nums text-slate-900">
          {value}
        </dd>
        {hint ? (
          <p className="text-caption leading-snug text-slate-500">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}

export function PartDetailPanel({
  part,
  unitLabel,
  movements,
  partsRequests,
  canWrite,
  canManageRequests,
  locale,
}: Props) {
  const t = useTranslations("inventory");
  const tp = useTranslations("partsRequests");
  usePageDetailLabel(part.name);

  const sections = useMemo(
    () =>
      (canManageRequests
        ? PART_SECTIONS
        : PART_SECTIONS.filter((id) => id !== "requests")) as readonly PartSection[],
    [canManageRequests],
  );

  const { activeSection, scrollToSection, setSectionRef } =
    useSectionScrollSpy({
      sections,
      idPrefix: PART_SECTION_ID_PREFIX,
      initialSection: "details",
    });

  const low = part.quantityOnHand <= part.lowStockLevel;
  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const shortDateFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const editValues: EditPartValues = {
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

  const requestModal = canManageRequests ? (
    <CreatePartsRequestModal
      parts={[
        {
          id: part.id,
          name: part.name,
          sku: part.sku,
          unit: part.unit,
        },
      ]}
      defaultPartId={part.id}
      stayAndRefresh
      trigger={
        <Button type="button" size="md">
          <PackagePlus className="size-4" aria-hidden />
          {t("requestPart")}
        </Button>
      }
    />
  ) : null;

  const navItems = [
    { id: "details" as const, label: t("details"), icon: NotebookPen },
    { id: "stock" as const, label: t("stockSection"), icon: Package },
    ...(canManageRequests
      ? [
          {
            id: "requests" as const,
            label: t("requestsSection"),
            icon: ClipboardList,
          },
        ]
      : []),
    { id: "history" as const, label: t("movements"), icon: History },
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
          activeSection !== "details" && "hidden lg:flex",
        )}
      >
        <div className="min-w-0">
          <h1 className="truncate text-[clamp(24px,3.5vw,30px)] leading-tight font-semibold tracking-[0.02em] text-[#152238]">
            {part.name}
          </h1>
          <p className="mt-1 truncate text-[14px]">
            <span className="font-mono font-medium text-[#1f5eff]">
              {part.sku}
            </span>
            <span className="text-slate-300"> · </span>
            <span className="font-medium text-slate-600">
              {t("hsn")}{" "}
              <span className="font-mono text-violet-700">{part.hsn}</span>
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-extrabold tabular-nums",
              low
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-[#c9d8ff] bg-[#e8efff] text-[#1f5eff]",
            )}
          >
            {t("stockCount", {
              count: part.quantityOnHand,
              unit: unitLabel,
            })}
            {low ? <Badge variant="warning">{t("lowBadge")}</Badge> : null}
          </span>
          {canManageRequests && low ? requestModal : null}
        </div>
      </header>

      <SectionMobileNavBar {...navProps} />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(220px,260px)_minmax(0,1fr)] lg:gap-6">
        <SectionDesktopNav {...navProps} />

        <div className="flex min-w-0 flex-col gap-4">
          <SectionBlock
            id={sectionDomId(PART_SECTION_ID_PREFIX, "details")}
            title={t("details")}
            subtitle={t("detailsDescription")}
            sectionRef={setSectionRef("details")}
            action={
              canWrite ? (
                <div className="flex flex-wrap items-center gap-2">
                  <EditPartModal
                    part={editValues}
                    trigger={
                      <Button type="button" variant="outline" size="md">
                        <Pencil className="size-4" aria-hidden />
                        {t("edit")}
                      </Button>
                    }
                  />
                  <DeletePartButton
                    partId={part.id}
                    partName={part.name}
                    redirectToList
                    size="md"
                    showLabel
                  />
                </div>
              ) : null
            }
          >
            <dl className="grid gap-5 px-5 py-5 sm:grid-cols-2 lg:grid-cols-4 sm:gap-x-8 sm:px-6">
              <Fact
                icon={ArrowDownToLine}
                label={t("purchasePrice")}
                value={formatRupees(part.purchasePricePaise)}
                iconClassName="bg-sky-100 text-sky-700"
              />
              <Fact
                icon={ArrowUpFromLine}
                label={t("sellingPrice")}
                value={formatRupees(part.sellingPricePaise)}
                iconClassName="bg-emerald-100 text-emerald-700"
              />
              <Fact
                icon={BadgePercent}
                label={t("gstRate")}
                value={`${part.gstRatePercent}%`}
                iconClassName="bg-violet-100 text-violet-700"
              />
              <Fact
                icon={TriangleAlert}
                label={t("lowStockLevel")}
                value={t("stockCount", {
                  count: part.lowStockLevel,
                  unit: unitLabel,
                })}
                hint={t("lowStockLevelHint")}
                iconClassName="bg-amber-100 text-amber-800"
              />
            </dl>
          </SectionBlock>

          <SectionBlock
            id={sectionDomId(PART_SECTION_ID_PREFIX, "stock")}
            title={t("stockSection")}
            subtitle={t("stockSectionHint")}
            sectionRef={setSectionRef("stock")}
            action={
              canWrite ? (
                <div className="flex flex-wrap items-center gap-2">
                  <AddStockDialog
                    partId={part.id}
                    unitLabel={unitLabel}
                    onHand={part.quantityOnHand}
                  />
                  <RemoveStockDialog
                    partId={part.id}
                    unitLabel={unitLabel}
                    onHand={part.quantityOnHand}
                  />
                  <CorrectStockDialog
                    partId={part.id}
                    unitLabel={unitLabel}
                    onHand={part.quantityOnHand}
                  />
                </div>
              ) : null
            }
          >
            <div className="px-5 py-5 sm:px-6">
              <p className="text-caption font-medium text-slate-500">
                {t("onHandLabel")}
              </p>
              <p
                className={cn(
                  "mt-1 text-3xl font-semibold tabular-nums tracking-tight",
                  low ? "text-amber-900" : "text-slate-900",
                )}
              >
                {t("stockCount", {
                  count: part.quantityOnHand,
                  unit: unitLabel,
                })}
              </p>
              {low ? (
                <p className="mt-2 text-body text-amber-800">
                  {t("lowStockWarning")}
                </p>
              ) : (
                <p className="mt-2 text-body text-slate-600">
                  {t("lowStockThreshold", {
                    count: part.lowStockLevel,
                    unit: unitLabel,
                  })}
                </p>
              )}
            </div>
          </SectionBlock>

          {canManageRequests ? (
            <SectionBlock
              id={sectionDomId(PART_SECTION_ID_PREFIX, "requests")}
              title={t("requestsSection")}
              subtitle={t("requestsSectionHint")}
              sectionRef={setSectionRef("requests")}
              action={requestModal}
            >
              {partsRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 px-5 py-12 text-center sm:px-6">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <ClipboardList className="size-5" aria-hidden />
                  </span>
                  <div className="space-y-1">
                    <p className="text-body font-medium text-slate-900">
                      {t("requestsEmptyTitle")}
                    </p>
                    <p className="text-body text-slate-500">
                      {t("requestsEmptyDescription")}
                    </p>
                  </div>
                </div>
              ) : (
                <ListCardGroup className="rounded-none border-0 shadow-none">
                  {partsRequests.map((request) => {
                    const statusLine =
                      request.status === "CANCELLED"
                        ? t("requestCancelledLine")
                        : request.purchaseOrder?.vendor
                          ? t("requestOrderedLine", {
                              vendor: request.purchaseOrder.vendor.name,
                              number: request.purchaseOrder.number,
                            })
                          : t("requestWaitingVendor");
                    const subtitleParts = [
                      statusLine,
                      request.serviceOrder ? t("requestLinkedJob") : null,
                      request.notes?.trim() || null,
                    ].filter(Boolean);
                    const createdAt =
                      request.createdAt instanceof Date
                        ? request.createdAt
                        : new Date(request.createdAt);

                    return (
                      <li key={request.id}>
                        <ListCard
                          href="/parts-requests"
                          title={t("requestQty", {
                            count: request.quantity,
                            unit: unitLabel,
                          })}
                          subtitle={subtitleParts.join(" · ")}
                          trailing={
                            <div className="flex shrink-0 items-center gap-2">
                              <time
                                dateTime={createdAt.toISOString()}
                                className="text-caption whitespace-nowrap text-slate-500"
                              >
                                {shortDateFmt.format(createdAt)}
                              </time>
                              <Badge
                                variant={requestStatusVariant(request.status)}
                              >
                                {tp(`statuses.${request.status}`)}
                              </Badge>
                            </div>
                          }
                          className="px-5 py-3.5 sm:px-6"
                        />
                      </li>
                    );
                  })}
                </ListCardGroup>
              )}
            </SectionBlock>
          ) : null}

          <SectionBlock
            id={sectionDomId(PART_SECTION_ID_PREFIX, "history")}
            title={t("movements")}
            subtitle={t("movementsHint")}
            sectionRef={setSectionRef("history")}
          >
            {movements.length === 0 ? (
              <p className="px-5 py-8 text-body text-slate-500 sm:px-6">
                {t("movementsEmpty")}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {movements.map((m) => (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3.5 text-body sm:px-6"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">
                        {t(`movementTypes.${m.type}`)}{" "}
                        <span
                          className={
                            m.quantityChange < 0
                              ? "tabular-nums text-destructive"
                              : "tabular-nums text-emerald-700"
                          }
                        >
                          {m.quantityChange > 0 ? "+" : ""}
                          {m.quantityChange}
                        </span>
                      </p>
                      {m.note ? (
                        <p className="text-slate-500">{m.note}</p>
                      ) : null}
                    </div>
                    <p className="shrink-0 text-caption text-slate-500">
                      {dateFmt.format(
                        m.createdAt instanceof Date
                          ? m.createdAt
                          : new Date(m.createdAt),
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SectionBlock>
        </div>
      </div>
    </div>
  );
}
