"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Car, Pencil, Plus, Wrench } from "lucide-react";
import { usePageDetailLabel } from "@/components/page-chrome";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription } from "@/components/ui/card";
import {
  DescriptionDetails,
  DescriptionItem,
  DescriptionList,
  DescriptionTerm,
} from "@/components/ui/description-list";
import {
  SectionDesktopNav,
  SectionMobileNavBar,
} from "@/components/shared/section-side-nav";
import {
  sectionDomId,
  useSectionScrollSpy,
} from "@/hooks/use-section-scroll-spy";
import { getDateStatus, type DateStatus } from "@/lib/date-status";
import {
  ServiceHistoryList,
  type ServiceHistoryRow,
} from "@/modules/service-orders/components/service-history-list";
import { DeleteVehicleButton } from "@/modules/vehicles/components/delete-vehicle-button";
import { EditVehicleModal } from "@/modules/vehicles/components/edit-vehicle-modal";
import {
  VEHICLE_SECTION_ID_PREFIX,
  VEHICLE_SECTIONS,
} from "@/modules/vehicles/vehicle-sections";

type VehicleRow = {
  id: string;
  registrationNumber: string;
  make: string;
  model: string;
  stateCode: string;
  year: number | null;
  odometer: number | null;
  insuranceExpiry: Date | string | null;
  pucExpiry: Date | string | null;
  fitnessExpiry: Date | string | null;
};

type Props = {
  customerId: string;
  customerName: string;
  vehicle: VehicleRow;
  serviceHistory: ServiceHistoryRow[];
  canWrite: boolean;
  canCreateOrder: boolean;
  locale: string;
};

function asDate(value: Date | string | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function statusVariant(
  status: DateStatus,
): "success" | "warning" | "danger" | "secondary" {
  switch (status) {
    case "ok":
      return "success";
    case "soon":
      return "warning";
    case "expired":
      return "danger";
    default:
      return "secondary";
  }
}

function formatDate(value: Date | null, locale: string, empty: string) {
  if (!value) return empty;
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value);
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

export function VehicleDetailPanel({
  customerId,
  customerName,
  vehicle,
  serviceHistory,
  canWrite,
  canCreateOrder,
  locale,
}: Props) {
  const t = useTranslations("customers");
  const tv = useTranslations("vehicles");
  const to = useTranslations("orders");
  const tGst = useTranslations("gst");
  usePageDetailLabel(vehicle.registrationNumber);
  const { activeSection, scrollToSection, setSectionRef } =
    useSectionScrollSpy({
      sections: VEHICLE_SECTIONS,
      idPrefix: VEHICLE_SECTION_ID_PREFIX,
      initialSection: "overview",
    });

  const createJobCard = (size: "sm" | "md" = "md", compact = false) =>
    canCreateOrder ? (
      <Button
        asChild
        size={size}
        className={compact ? "min-h-10 min-w-0 flex-1" : undefined}
      >
        <Link href={`/orders/new?vehicleId=${vehicle.id}`}>
          <Plus className="size-3.5 shrink-0 sm:size-4" aria-hidden />
          {compact ? (
            <span className="truncate">{to("createShort")}</span>
          ) : (
            <>
              <span className="lg:hidden">{t("addShort")}</span>
              <span className="hidden lg:inline">{to("createShort")}</span>
            </>
          )}
        </Link>
      </Button>
    ) : null;

  const expiryRows = [
    {
      key: "insurance",
      term: tv("insuranceExpiry"),
      value: asDate(vehicle.insuranceExpiry),
      status: getDateStatus(asDate(vehicle.insuranceExpiry)),
    },
    {
      key: "puc",
      term: tv("pucExpiry"),
      value: asDate(vehicle.pucExpiry),
      status: getDateStatus(asDate(vehicle.pucExpiry)),
    },
    {
      key: "fitness",
      term: tv("fitnessExpiry"),
      value: asDate(vehicle.fitnessExpiry),
      status: getDateStatus(asDate(vehicle.fitnessExpiry)),
    },
  ] as const;

  const vehicleLabel = `${vehicle.make} ${vehicle.model}`.trim();

  const editVehicleValues = {
    id: vehicle.id,
    customerId,
    registrationNumber: vehicle.registrationNumber,
    make: vehicle.make,
    model: vehicle.model,
    stateCode: vehicle.stateCode,
    year: vehicle.year,
    odometer: vehicle.odometer,
    insuranceExpiry: vehicle.insuranceExpiry,
    pucExpiry: vehicle.pucExpiry,
    fitnessExpiry: vehicle.fitnessExpiry,
  };

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      {createJobCard()}
      {canWrite ? <EditVehicleModal vehicle={editVehicleValues} /> : null}
      {canWrite ? (
        <DeleteVehicleButton
          vehicleId={vehicle.id}
          customerId={customerId}
          className="min-h-11"
        />
      ) : null}
    </div>
  );

  const vehicleNavItems = [
    { id: "overview" as const, label: tv("overview"), icon: Car },
    {
      id: "service" as const,
      label: tv("serviceHistory"),
      icon: Wrench,
    },
  ];

  const vehicleNavProps = {
    title: tv("sectionsTitle"),
    items: vehicleNavItems,
    active: activeSection,
    onChange: scrollToSection,
    backHref: `/customers/${customerId}`,
    backLabel: tv("backToCustomer"),
    heading: vehicle.registrationNumber,
    headingActions: canWrite ? (
      <EditVehicleModal
        vehicle={editVehicleValues}
        trigger={
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="size-9"
            aria-label={tv("edit")}
          >
            <Pencil className="size-4" aria-hidden />
          </Button>
        }
      />
    ) : undefined,
    ctaRow: createJobCard("sm", true),
  } as const;

  return (
    <div className="space-y-4">
      <header className="hidden flex-wrap items-center justify-between gap-3 lg:flex">
        <div className="min-w-0">
          <h1 className="truncate text-[clamp(24px,3.5vw,30px)] leading-tight font-semibold tracking-[0.02em] text-[#152238]">
            {vehicle.registrationNumber}
          </h1>
          <p className="mt-1 truncate text-[14px] text-[#5c6b7e]">
            <Link
              href={`/customers/${customerId}`}
              className="font-medium text-[#1f5eff] underline-offset-4 hover:underline"
            >
              {customerName}
            </Link>
            {vehicleLabel ? (
              <>
                <span className="text-slate-300"> · </span>
                {vehicleLabel}
              </>
            ) : null}
          </p>
        </div>
        {headerActions}
      </header>

      <SectionMobileNavBar {...vehicleNavProps} />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(220px,260px)_minmax(0,1fr)] lg:gap-6">
        <SectionDesktopNav
          title={vehicleNavProps.title}
          items={vehicleNavProps.items}
          active={vehicleNavProps.active}
          onChange={vehicleNavProps.onChange}
          backHref={vehicleNavProps.backHref}
          backLabel={vehicleNavProps.backLabel}
        />

        <div className="flex min-w-0 flex-col gap-4">
          <SectionBlock
            id={sectionDomId(VEHICLE_SECTION_ID_PREFIX, "overview")}
            title={tv("overview")}
            subtitle={vehicleLabel || undefined}
            sectionRef={setSectionRef("overview")}
          >
            <div className="px-5 py-5 sm:px-6">
              <DescriptionList>
                <DescriptionItem>
                  <DescriptionTerm>{tv("registrationNumber")}</DescriptionTerm>
                  <DescriptionDetails className="font-medium tracking-wide">
                    {vehicle.registrationNumber}
                  </DescriptionDetails>
                </DescriptionItem>
                <DescriptionItem>
                  <DescriptionTerm>{tv("make")}</DescriptionTerm>
                  <DescriptionDetails>{vehicle.make}</DescriptionDetails>
                </DescriptionItem>
                <DescriptionItem>
                  <DescriptionTerm>{tv("model")}</DescriptionTerm>
                  <DescriptionDetails>{vehicle.model}</DescriptionDetails>
                </DescriptionItem>
                <DescriptionItem>
                  <DescriptionTerm>{tv("state")}</DescriptionTerm>
                  <DescriptionDetails>
                    {tGst(`states.${vehicle.stateCode}`)}
                  </DescriptionDetails>
                </DescriptionItem>
                <DescriptionItem>
                  <DescriptionTerm>{tv("year")}</DescriptionTerm>
                  <DescriptionDetails>
                    {vehicle.year ?? tv("notSet")}
                  </DescriptionDetails>
                </DescriptionItem>
                <DescriptionItem>
                  <DescriptionTerm>{tv("odometer")}</DescriptionTerm>
                  <DescriptionDetails>
                    {vehicle.odometer != null
                      ? `${vehicle.odometer.toLocaleString(locale)} ${tv("km")}`
                      : tv("notSet")}
                  </DescriptionDetails>
                </DescriptionItem>
                {expiryRows.map((row) => (
                  <DescriptionItem key={row.key}>
                    <DescriptionTerm>{row.term}</DescriptionTerm>
                    <DescriptionDetails className="inline-flex flex-wrap items-center gap-2">
                      <span>
                        {formatDate(row.value, locale, tv("notSet"))}
                      </span>
                      <Badge variant={statusVariant(row.status)}>
                        {tv(`status.${row.status}`)}
                      </Badge>
                    </DescriptionDetails>
                  </DescriptionItem>
                ))}
              </DescriptionList>
            </div>
          </SectionBlock>

          <SectionBlock
            id={sectionDomId(VEHICLE_SECTION_ID_PREFIX, "service")}
            title={tv("serviceHistory")}
            subtitle={tv("serviceHistoryDescription")}
            sectionRef={setSectionRef("service")}
            action={createJobCard()}
          >
            <ServiceHistoryList
              orders={serviceHistory}
              locale={locale}
              customerId={customerId}
              canWrite={canCreateOrder}
              emptyTitle={tv("serviceHistoryEmpty")}
              emptyBody={tv("serviceHistoryPlaceholder")}
              showRegistration={false}
              statusLabel={(status) => to(`statuses.${status}`)}
            />
          </SectionBlock>
        </div>
      </div>
    </div>
  );
}
