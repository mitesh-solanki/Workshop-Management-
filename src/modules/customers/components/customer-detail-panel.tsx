"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  Car,
  ClipboardList,
  FileText,
  MapPin,
  MessageSquare,
  NotebookPen,
  Pencil,
  Phone,
  Plus,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { usePageDetailLabel } from "@/components/page-chrome";
import { Button } from "@/components/ui/button";
import { Card, CardDescription } from "@/components/ui/card";
import {
  SectionDesktopNav,
  SectionMobileNavBar,
} from "@/components/shared/section-side-nav";
import {
  sectionDomId,
  useSectionScrollSpy,
} from "@/hooks/use-section-scroll-spy";
import { cn } from "@/lib/utils";
import {
  CustomerVehiclesList,
  type CustomerVehicleRow,
} from "@/modules/customers/components/customer-vehicles-list";
import {
  EditCustomerModal,
  type EditCustomerValues,
} from "@/modules/customers/components/edit-customer-modal";
import {
  CUSTOMER_SECTION_ID_PREFIX,
  CUSTOMER_SECTIONS,
} from "@/modules/customers/customer-sections";
import { InspectionsList } from "@/modules/inspections/components/inspections-list";
import type { InspectionTableRow } from "@/modules/inspections/components/inspections-table";
import {
  ServiceHistoryList,
  type ServiceHistoryRow,
} from "@/modules/service-orders/components/service-history-list";
import { CreateVehicleModal } from "@/modules/vehicles/components/create-vehicle-modal";
import { AddWarrantyCardModal } from "@/modules/warranties/components/add-warranty-card-modal";
import {
  WarrantyDocsList,
  type WarrantyDocListItem,
} from "@/modules/warranties/components/warranty-docs-list";

export type { ServiceHistoryRow };

type Props = {
  customer: EditCustomerValues;
  vehicles: CustomerVehicleRow[];
  serviceHistory: ServiceHistoryRow[];
  inspections: InspectionTableRow[];
  warrantyDocs: WarrantyDocListItem[];
  canWrite: boolean;
  canWriteWarranty: boolean;
  canCreateOrder: boolean;
  canCreateInspection: boolean;
  canDeleteOrder?: boolean;
  locale: string;
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

export function CustomerDetailPanel({
  customer,
  vehicles,
  serviceHistory,
  inspections,
  warrantyDocs,
  canWrite,
  canWriteWarranty,
  canCreateOrder,
  canCreateInspection,
  canDeleteOrder = false,
  locale,
}: Props) {
  const t = useTranslations("customers");
  const tv = useTranslations("vehicles");
  const tw = useTranslations("warranties");
  const ti = useTranslations("inspections");
  const to = useTranslations("orders");
  usePageDetailLabel(customer.name);
  const { activeSection, scrollToSection, setSectionRef } =
    useSectionScrollSpy({
      sections: CUSTOMER_SECTIONS,
      idPrefix: CUSTOMER_SECTION_ID_PREFIX,
      initialSection: "details",
    });

  const navItems = [
    { id: "details" as const, label: t("details"), icon: NotebookPen },
    { id: "vehicles" as const, label: t("vehicles"), icon: Car },
    {
      id: "inspections" as const,
      label: ti("customerSectionTitle"),
      icon: ClipboardList,
    },
    { id: "service" as const, label: t("serviceHistory"), icon: Wrench },
    {
      id: "warranty" as const,
      label: tw("customerSectionTitle"),
      icon: FileText,
    },
    {
      id: "communication" as const,
      label: t("communicationHistory"),
      icon: MessageSquare,
    },
  ];

  const mobileCtas = canWrite ? (
    <CreateVehicleModal
      customerId={customer.id}
      customerName={customer.name}
      onCreated={() => scrollToSection("vehicles")}
      trigger={
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-10 min-w-0 flex-1"
        >
          <Plus className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{tv("add")}</span>
        </Button>
      }
    />
  ) : null;

  const navProps = {
    title: t("sectionsTitle"),
    items: navItems,
    active: activeSection,
    onChange: scrollToSection,
    backHref: "/customers",
    backLabel: t("back"),
    heading: customer.name,
    headingActions: canWrite ? (
      <EditCustomerModal
        customer={customer}
        trigger={
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="size-9"
            aria-label={t("edit")}
          >
            <Pencil className="size-4" aria-hidden />
          </Button>
        }
      />
    ) : undefined,
    ctaRow: mobileCtas,
  } as const;

  const metaParts = [
    customer.phone?.trim() || null,
    t("vehicleCount", { count: vehicles.length }),
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      <header className="hidden flex-wrap items-center justify-between gap-3 lg:flex">
        <div className="min-w-0">
          <h1 className="truncate text-[clamp(24px,3.5vw,30px)] leading-tight font-semibold tracking-[0.02em] text-[#152238]">
            {customer.name}
          </h1>
          <p className="mt-1 truncate text-[14px] text-[#5c6b7e]">
            {metaParts.map((part, index) => (
              <span key={`${part}-${index}`}>
                {index > 0 ? (
                  <span className="text-slate-300"> · </span>
                ) : null}
                {index === 0 && customer.phone ? (
                  <a
                    href={`tel:${customer.phone}`}
                    className="font-medium text-[#1f5eff] underline-offset-4 hover:underline"
                  >
                    {part}
                  </a>
                ) : (
                  part
                )}
              </span>
            ))}
          </p>
        </div>
        {canWrite ? (
          <EditCustomerModal
            customer={customer}
            trigger={
              <Button type="button" variant="outline" size="md">
                <Pencil className="size-4" aria-hidden />
                {t("edit")}
              </Button>
            }
          />
        ) : null}
      </header>

      <SectionMobileNavBar {...navProps} />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(220px,260px)_minmax(0,1fr)] lg:gap-6">
        <SectionDesktopNav
          title={navProps.title}
          items={navProps.items}
          active={navProps.active}
          onChange={navProps.onChange}
        />

        <div className="flex min-w-0 flex-col gap-4">
          <SectionBlock
            id={sectionDomId(CUSTOMER_SECTION_ID_PREFIX, "details")}
            title={t("details")}
            subtitle={t("detailsDescription")}
            sectionRef={setSectionRef("details")}
          >
            <dl className="grid gap-4 px-5 py-5 sm:grid-cols-2 sm:gap-x-8 sm:px-6">
              <Fact
                icon={Phone}
                label={t("phone")}
                value={
                  <a
                    href={`tel:${customer.phone}`}
                    className="font-medium text-blue-700 hover:underline"
                  >
                    {customer.phone}
                  </a>
                }
              />
              <Fact
                icon={MapPin}
                label={t("address")}
                value={customer.address ?? t("notSet")}
                muted={!customer.address}
              />
              <Fact
                icon={NotebookPen}
                label={t("notes")}
                value={customer.notes ?? t("notSet")}
                muted={!customer.notes}
                multiline
                className="sm:col-span-2"
              />
            </dl>
          </SectionBlock>

          <SectionBlock
            id={sectionDomId(CUSTOMER_SECTION_ID_PREFIX, "vehicles")}
            title={t("vehicles")}
            subtitle={t("vehiclesDescription")}
            sectionRef={setSectionRef("vehicles")}
            action={
              canWrite ? (
                <CreateVehicleModal
                  customerId={customer.id}
                  customerName={customer.name}
                  onCreated={() => scrollToSection("vehicles")}
                  trigger={
                    <Button type="button" size="md" className="text-white">
                      <Plus className="size-4 text-white" aria-hidden />
                      <span className="lg:hidden">{t("addShort")}</span>
                      <span className="hidden lg:inline">{tv("add")}</span>
                    </Button>
                  }
                />
              ) : undefined
            }
          >
            <CustomerVehiclesList
              vehicles={vehicles}
              customerId={customer.id}
              locale={locale}
              canWrite={canWrite}
              canCreateOrder={canCreateOrder}
              canCreateInspection={canCreateInspection}
              empty={
                <EmptyState
                  icon={Car}
                  title={t("noVehicles")}
                  body={t("noVehiclesDescription")}
                  centered
                />
              }
            />
          </SectionBlock>

          <SectionBlock
            id={sectionDomId(CUSTOMER_SECTION_ID_PREFIX, "inspections")}
            title={ti("customerSectionTitle")}
            subtitle={ti("customerSectionDescription")}
            sectionRef={setSectionRef("inspections")}
          >
            <InspectionsList
              inspections={inspections}
              showCustomer={false}
              emptyTitle={ti("sectionEmpty")}
              emptyBody={
                vehicles.length === 0
                  ? t("noVehiclesDescription")
                  : ti("emptyDescription")
              }
            />
          </SectionBlock>

          <SectionBlock
            id={sectionDomId(CUSTOMER_SECTION_ID_PREFIX, "service")}
            title={t("serviceHistory")}
            subtitle={t("serviceHistoryDescription")}
            sectionRef={setSectionRef("service")}
          >
            <ServiceHistoryList
              orders={serviceHistory}
              locale={locale}
              customerId={customer.id}
              canWrite={canCreateOrder}
              canDelete={canDeleteOrder}
              emptyTitle={t("serviceHistoryEmpty")}
              emptyBody={
                vehicles.length === 0
                  ? t("noVehiclesDescription")
                  : t("serviceHistoryPlaceholder")
              }
              showRegistration
              statusLabel={(status) => to(`statuses.${status}`)}
            />
          </SectionBlock>

          <SectionBlock
            id={sectionDomId(CUSTOMER_SECTION_ID_PREFIX, "warranty")}
            title={tw("customerSectionTitle")}
            subtitle={tw("customerSectionDescription")}
            sectionRef={setSectionRef("warranty")}
            action={
              canWriteWarranty && vehicles.length > 0 ? (
                <AddWarrantyCardModal
                  customerId={customer.id}
                  vehicles={vehicles.map((vehicle) => ({
                    id: vehicle.id,
                    registrationNumber: vehicle.registrationNumber,
                    make: vehicle.make,
                    model: vehicle.model,
                  }))}
                />
              ) : undefined
            }
          >
            <WarrantyDocsList
              docs={warrantyDocs}
              canWrite={canWriteWarranty}
              locale={locale}
              showVehicle
              emptyTitle={tw("emptyTitle")}
              emptyDescription={tw("emptyCustomerDescription")}
            />
          </SectionBlock>

          <SectionBlock
            id={sectionDomId(CUSTOMER_SECTION_ID_PREFIX, "communication")}
            title={t("communicationHistory")}
            subtitle={t("communicationHistoryDescription")}
            sectionRef={setSectionRef("communication")}
          >
            <EmptyState
              icon={MessageSquare}
              title={t("communicationHistoryEmpty")}
              body={t("communicationHistoryPlaceholder")}
              centered
            />
          </SectionBlock>
        </div>
      </div>
    </div>
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

function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  centered = false,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
  centered?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 px-5 py-8 sm:px-6",
        centered
          ? "items-center justify-center py-12 text-center"
          : "items-start",
      )}
    >
      <span
        className={cn(
          "flex size-10 items-center justify-center rounded-lg",
          centered
            ? "bg-muted text-muted-foreground"
            : "bg-blue-50 text-blue-700 ring-1 ring-blue-100",
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="space-y-0.5">
        <p className="text-section-title text-slate-900">{title}</p>
        <p
          className={cn(
            "text-body text-slate-600",
            centered ? "max-w-md" : "max-w-lg",
          )}
        >
          {body}
        </p>
      </div>
      {action}
    </div>
  );
}
