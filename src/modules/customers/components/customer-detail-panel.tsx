"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Car,
  ChevronLeft,
  MapPin,
  MessageSquare,
  NotebookPen,
  Pencil,
  Phone,
  Plus,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription } from "@/components/ui/card";
import {
  DescriptionDetails,
  DescriptionItem,
  DescriptionList,
  DescriptionTerm,
} from "@/components/ui/description-list";
import { ListCard, ListCardGroup } from "@/components/ui/list-card";
import { SectionSideNav } from "@/components/shared/section-side-nav";
import {
  sectionDomId,
  useSectionScrollSpy,
} from "@/hooks/use-section-scroll-spy";
import { getDateStatus, type DateStatus } from "@/lib/date-status";
import type { ServiceOrderStatus } from "@/lib/service-order-status";
import { cn } from "@/lib/utils";
import {
  EditCustomerModal,
  type EditCustomerValues,
} from "@/modules/customers/components/edit-customer-modal";
import {
  CUSTOMER_SECTION_ID_PREFIX,
  CUSTOMER_SECTIONS,
  VEHICLE_SECTION_ID_PREFIX,
  VEHICLE_SECTIONS,
} from "@/modules/customers/customer-sections";
import { JobCardRowActions } from "@/modules/service-orders/components/job-card-row-actions";
import { CsvExportButton } from "@/modules/data-export/components/csv-export-button";
import { CreateVehicleModal } from "@/modules/vehicles/components/create-vehicle-modal";
import { DeleteVehicleButton } from "@/modules/vehicles/components/delete-vehicle-button";
import { EditVehicleModal } from "@/modules/vehicles/components/edit-vehicle-modal";

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

export type ServiceHistoryRow = {
  id: string;
  status: ServiceOrderStatus;
  complaint: string;
  createdAt: Date | string;
  expectedCompletion: Date | string | null;
  vehicle: {
    id: string;
    registrationNumber: string;
  };
};

function asDate(value: Date | string | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function vehicleListSubtitle(
  vehicle: Pick<VehicleRow, "make" | "model" | "year" | "odometer">,
  locale: string,
  tv: (key: string, values?: Record<string, string | number>) => string,
) {
  const parts = [`${vehicle.make} ${vehicle.model}`.trim()];
  if (vehicle.year != null) {
    parts.push(tv("yearShort", { year: vehicle.year }));
  }
  if (vehicle.odometer != null) {
    parts.push(
      tv("odometerShort", {
        value: vehicle.odometer.toLocaleString(locale),
      }),
    );
  }
  return parts.join(" · ");
}

type Props = {
  customer: EditCustomerValues;
  vehicles: VehicleRow[];
  serviceHistory: ServiceHistoryRow[];
  canWrite: boolean;
  canCreateOrder: boolean;
  locale: string;
  initialVehicleId?: string | null;
};

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

export function CustomerDetailPanel({
  customer,
  vehicles,
  serviceHistory,
  canWrite,
  canCreateOrder,
  locale,
  initialVehicleId = null,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const initialVehicle =
    initialVehicleId && vehicles.some((v) => v.id === initialVehicleId)
      ? initialVehicleId
      : null;

  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(
    initialVehicle,
  );

  const selectedVehicle =
    vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null;

  function setVehicleQuery(vehicleId: string | null) {
    const next = vehicleId
      ? `${pathname}?vehicle=${encodeURIComponent(vehicleId)}`
      : pathname;
    router.replace(next, { scroll: false });
  }

  function openVehicle(vehicleId: string) {
    setSelectedVehicleId(vehicleId);
    setVehicleQuery(vehicleId);
  }

  function closeVehicle() {
    setSelectedVehicleId(null);
    setVehicleQuery(null);
  }

  if (selectedVehicle) {
    return (
      <VehicleDetailView
        key={selectedVehicle.id}
        customerId={customer.id}
        customerName={customer.name}
        vehicle={selectedVehicle}
        serviceHistory={serviceHistory.filter(
          (order) => order.vehicle.id === selectedVehicle.id,
        )}
        canWrite={canWrite}
        canCreateOrder={canCreateOrder}
        locale={locale}
        onBack={closeVehicle}
      />
    );
  }

  return (
    <CustomerSectionsView
      customer={customer}
      vehicles={vehicles}
      serviceHistory={serviceHistory}
      canWrite={canWrite}
      canCreateOrder={canCreateOrder}
      locale={locale}
      openVehicle={openVehicle}
    />
  );
}

function CustomerSectionsView({
  customer,
  vehicles,
  serviceHistory,
  canWrite,
  canCreateOrder,
  locale,
  openVehicle,
}: {
  customer: EditCustomerValues;
  vehicles: VehicleRow[];
  serviceHistory: ServiceHistoryRow[];
  canWrite: boolean;
  canCreateOrder: boolean;
  locale: string;
  openVehicle: (vehicleId: string) => void;
}) {
  const t = useTranslations("customers");
  const tv = useTranslations("vehicles");
  const to = useTranslations("orders");
  const { activeSection, scrollToSection, setSectionRef } =
    useSectionScrollSpy({
      sections: CUSTOMER_SECTIONS,
      idPrefix: CUSTOMER_SECTION_ID_PREFIX,
      initialSection: "details",
    });

  const navItems = [
    { id: "details" as const, label: t("details"), icon: NotebookPen },
    { id: "vehicles" as const, label: t("vehicles"), icon: Car },
    { id: "service" as const, label: t("serviceHistory"), icon: Wrench },
    {
      id: "communication" as const,
      label: t("communicationHistory"),
      icon: MessageSquare,
    },
  ];

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(220px,260px)_minmax(0,1fr)] lg:gap-6">
      <SectionSideNav
        title={t("sectionsTitle")}
        items={navItems}
        active={activeSection}
        onChange={scrollToSection}
      />

      <div className="flex min-w-0 flex-col gap-4">
        <SectionBlock
          id={sectionDomId(CUSTOMER_SECTION_ID_PREFIX, "details")}
          title={t("namedDetails", { name: customer.name })}
          subtitle={t("detailsDescription")}
          sectionRef={setSectionRef("details")}
          action={
            canWrite ? (
              <EditCustomerModal
                customer={customer}
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
            <div className="flex flex-wrap items-center gap-2">
              <CsvExportButton
                href={`/customers/${customer.id}/vehicles/export`}
                label={tv("export")}
                size="sm"
              />
              {canWrite ? (
                <CreateVehicleModal
                  customerId={customer.id}
                  customerName={customer.name}
                  onCreated={() => scrollToSection("vehicles")}
                />
              ) : null}
            </div>
          }
        >
          {vehicles.length === 0 ? (
            <EmptyState
              icon={Car}
              title={t("noVehicles")}
              body={t("noVehiclesDescription")}
              action={
                canWrite ? (
                  <CreateVehicleModal
                    customerId={customer.id}
                    customerName={customer.name}
                  />
                ) : null
              }
            />
          ) : (
            <ListCardGroup className="rounded-none border-0 shadow-none">
              {vehicles.map((vehicle) => (
                <li key={vehicle.id}>
                  <ListCard
                    onClick={() => openVehicle(vehicle.id)}
                    title={vehicle.registrationNumber}
                    subtitle={vehicleListSubtitle(vehicle, locale, tv)}
                    className="px-5 py-3.5 sm:px-6"
                  />
                </li>
              ))}
            </ListCardGroup>
          )}
        </SectionBlock>

        <SectionBlock
          id={sectionDomId(CUSTOMER_SECTION_ID_PREFIX, "service")}
          title={t("serviceHistory")}
          subtitle={t("serviceHistoryDescription")}
          sectionRef={setSectionRef("service")}
          action={
            canCreateOrder && vehicles.length > 0 ? (
              vehicles.length === 1 ? (
                <Button asChild size="md">
                  <Link href={`/orders/new?vehicleId=${vehicles[0]!.id}`}>
                    <Plus className="size-4" aria-hidden />
                    {to("createShort")}
                  </Link>
                </Button>
              ) : (
                <Button asChild size="md">
                  <Link href="/orders/new">
                    <Plus className="size-4" aria-hidden />
                    {to("createShort")}
                  </Link>
                </Button>
              )
            ) : undefined
          }
        >
          <ServiceHistoryList
            orders={serviceHistory}
            locale={locale}
            customerId={customer.id}
            canWrite={canCreateOrder}
            emptyTitle={t("serviceHistoryEmpty")}
            emptyBody={
              vehicles.length === 0
                ? t("noVehiclesDescription")
                : t("serviceHistoryPlaceholder")
            }
            showRegistration
            statusLabel={(status) => to(`statuses.${status}`)}
            emptyAction={
              canCreateOrder && vehicles.length === 1 ? (
                <Button asChild size="sm">
                  <Link href={`/orders/new?vehicleId=${vehicles[0]!.id}`}>
                    <Plus className="size-4" aria-hidden />
                    {to("createShort")}
                  </Link>
                </Button>
              ) : canCreateOrder && vehicles.length > 1 ? (
                <Button asChild size="sm">
                  <Link href="/orders/new">
                    <Plus className="size-4" aria-hidden />
                    {to("createPickVehicle")}
                  </Link>
                </Button>
              ) : undefined
            }
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
  );
}

function VehicleDetailView({
  customerId,
  customerName,
  vehicle,
  serviceHistory,
  canWrite,
  canCreateOrder,
  locale,
  onBack,
}: {
  customerId: string;
  customerName: string;
  vehicle: VehicleRow;
  serviceHistory: ServiceHistoryRow[];
  canWrite: boolean;
  canCreateOrder: boolean;
  locale: string;
  onBack: () => void;
}) {
  const t = useTranslations("customers");
  const tv = useTranslations("vehicles");
  const to = useTranslations("orders");
  const tGst = useTranslations("gst");
  const { activeSection, scrollToSection, setSectionRef } =
    useSectionScrollSpy({
      sections: VEHICLE_SECTIONS,
      idPrefix: VEHICLE_SECTION_ID_PREFIX,
      initialSection: "overview",
    });

  const createJobCard = (size: "sm" | "md" = "md") =>
    canCreateOrder ? (
      <Button asChild size={size}>
        <Link href={`/orders/new?vehicleId=${vehicle.id}`}>
          <Plus className="size-4" aria-hidden />
          {to("createShort")}
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

  const subtitle = `${vehicle.make} ${vehicle.model}`.trim();

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      {createJobCard()}
      {canWrite ? (
        <EditVehicleModal
          vehicle={{
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
          }}
        />
      ) : null}
      {canWrite ? (
        <DeleteVehicleButton
          vehicleId={vehicle.id}
          customerId={customerId}
          className="min-h-11"
        />
      ) : null}
    </div>
  );

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(220px,260px)_minmax(0,1fr)] lg:gap-6">
      <SectionSideNav
        title={tv("sectionsTitle")}
        active={activeSection}
        onChange={scrollToSection}
        leading={
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-body font-medium text-slate-700 transition-colors hover:bg-muted"
          >
            <ChevronLeft className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{t("backToVehicles")}</span>
          </button>
        }
        items={[
          { id: "overview" as const, label: tv("overview"), icon: Car },
          {
            id: "service" as const,
            label: tv("serviceHistory"),
            icon: Wrench,
          },
        ]}
      />

      <div className="flex min-w-0 flex-col gap-4">
        <SectionBlock
          id={sectionDomId(VEHICLE_SECTION_ID_PREFIX, "overview")}
          title={t("customerVehicleTitle", {
            customer: customerName,
            registration: vehicle.registrationNumber,
          })}
          subtitle={subtitle}
          sectionRef={setSectionRef("overview")}
          action={headerActions}
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
                  {tGst(`states.${vehicle.stateCode}`)} ({vehicle.stateCode})
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
                    <span>{formatDate(row.value, locale, tv("notSet"))}</span>
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
            emptyAction={createJobCard("sm")}
          />
        </SectionBlock>
      </div>
    </div>
  );
}

function ServiceHistoryList({
  orders,
  locale,
  customerId,
  canWrite,
  emptyTitle,
  emptyBody,
  showRegistration,
  statusLabel,
  emptyAction,
}: {
  orders: ServiceHistoryRow[];
  locale: string;
  customerId: string;
  canWrite: boolean;
  emptyTitle: string;
  emptyBody: string;
  showRegistration: boolean;
  statusLabel: (status: ServiceOrderStatus) => string;
  emptyAction?: ReactNode;
}) {
  if (orders.length === 0) {
    return (
      <EmptyState
        icon={Wrench}
        title={emptyTitle}
        body={emptyBody}
        action={emptyAction}
        centered
      />
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {orders.map((order) => {
        const created = asDate(order.createdAt);
        const title = showRegistration
          ? order.vehicle.registrationNumber
          : order.complaint;
        const subtitle = showRegistration
          ? order.complaint
          : created
            ? formatDate(created, locale, "")
            : undefined;
        return (
          <li
            key={order.id}
            className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-6"
          >
            <Link
              href={`/orders/${order.id}`}
              className="min-w-0 flex-1 space-y-0.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-body font-medium text-slate-900">
                  {title}
                </p>
                <span className="shrink-0 text-caption text-slate-500">
                  {statusLabel(order.status)}
                </span>
              </div>
              {subtitle ? (
                <p className="truncate text-caption text-slate-600">
                  {subtitle}
                </p>
              ) : null}
            </Link>
            <JobCardRowActions
              orderId={order.id}
              customerId={customerId}
              label={title}
              canWrite={canWrite}
            />
          </li>
        );
      })}
    </ul>
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
