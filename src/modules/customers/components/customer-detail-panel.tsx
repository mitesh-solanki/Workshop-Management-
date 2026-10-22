"use client";

import type { ReactNode } from "react";
import { useState } from "react";
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
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DescriptionDetails,
  DescriptionItem,
  DescriptionList,
  DescriptionTerm,
} from "@/components/ui/description-list";
import { ListCard, ListCardGroup } from "@/components/ui/list-card";
import { getDateStatus, type DateStatus } from "@/lib/date-status";
import { cn } from "@/lib/utils";
import {
  EditCustomerModal,
  type EditCustomerValues,
} from "@/modules/customers/components/edit-customer-modal";
import { CreateVehicleModal } from "@/modules/vehicles/components/create-vehicle-modal";
import { EditVehicleModal } from "@/modules/vehicles/components/edit-vehicle-modal";

type VehicleRow = {
  id: string;
  registrationNumber: string;
  make: string;
  model: string;
  year: number | null;
  odometer: number | null;
  insuranceExpiry: Date | string | null;
  pucExpiry: Date | string | null;
  fitnessExpiry: Date | string | null;
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

type CustomerSection = "details" | "vehicles" | "service" | "communication";
type VehicleSection = "overview" | "service";

type Props = {
  customer: EditCustomerValues;
  vehicles: VehicleRow[];
  canWrite: boolean;
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

export function CustomerDetailPanel({
  customer,
  vehicles,
  canWrite,
  locale,
  initialVehicleId = null,
}: Props) {
  const t = useTranslations("customers");
  const tv = useTranslations("vehicles");
  const router = useRouter();
  const pathname = usePathname();

  const initialVehicle =
    initialVehicleId && vehicles.some((v) => v.id === initialVehicleId)
      ? initialVehicleId
      : null;

  const [section, setSection] = useState<CustomerSection>(
    initialVehicle ? "vehicles" : "details",
  );
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(
    initialVehicle,
  );
  const [vehicleSection, setVehicleSection] =
    useState<VehicleSection>("overview");

  const selectedVehicle =
    vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null;

  function setVehicleQuery(vehicleId: string | null) {
    const next = vehicleId
      ? `${pathname}?vehicle=${encodeURIComponent(vehicleId)}`
      : pathname;
    router.replace(next, { scroll: false });
  }

  function openVehicle(vehicleId: string) {
    setSection("vehicles");
    setSelectedVehicleId(vehicleId);
    setVehicleSection("overview");
    setVehicleQuery(vehicleId);
  }

  function closeVehicle() {
    setSelectedVehicleId(null);
    setVehicleSection("overview");
    setSection("vehicles");
    setVehicleQuery(null);
  }

  function goToCustomerSection(next: CustomerSection) {
    setSelectedVehicleId(null);
    setVehicleSection("overview");
    setVehicleQuery(null);
    setSection(next);
  }

  const customerNav: {
    id: CustomerSection;
    label: string;
    icon: LucideIcon;
  }[] = [
    { id: "details", label: t("details"), icon: NotebookPen },
    { id: "vehicles", label: t("vehicles"), icon: Car },
    { id: "service", label: t("serviceHistory"), icon: Wrench },
    {
      id: "communication",
      label: t("communicationHistory"),
      icon: MessageSquare,
    },
  ];

  const vehicleNav: {
    id: VehicleSection;
    label: string;
    icon: LucideIcon;
  }[] = [
    { id: "overview", label: tv("overview"), icon: Car },
    { id: "service", label: tv("serviceHistory"), icon: Wrench },
  ];

  const viewingVehicle = selectedVehicle != null;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(220px,260px)_minmax(0,1fr)] lg:gap-6">
      <Card className="gap-0 overflow-hidden py-0 lg:sticky lg:top-6">
        <CardHeader className="border-b border-border px-4 py-3">
          <CardTitle>
            {viewingVehicle ? tv("sectionsTitle") : t("sectionsTitle")}
          </CardTitle>
        </CardHeader>
        <CardBody className="p-2">
          {viewingVehicle ? (
            <nav
              aria-label={tv("sectionsTitle")}
              className="flex flex-col gap-0.5"
            >
              <button
                type="button"
                onClick={closeVehicle}
                className="inline-flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-body font-medium text-slate-700 transition-colors hover:bg-muted"
              >
                <ChevronLeft className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{t("backToVehicles")}</span>
              </button>
              {vehicleNav.map((item) => {
                const Icon = item.icon;
                const active = vehicleSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setVehicleSection(item.id)}
                    className={cn(
                      "inline-flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-left text-body font-medium transition-colors",
                      active
                        ? "bg-teal-600 text-white"
                        : "text-slate-700 hover:bg-muted",
                    )}
                  >
                    <Icon className="size-4 shrink-0 opacity-90" aria-hidden />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          ) : (
            <nav
              aria-label={t("sectionsTitle")}
              className="flex flex-col gap-0.5"
            >
              {customerNav.map((item) => {
                const Icon = item.icon;
                const active = section === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => goToCustomerSection(item.id)}
                    className={cn(
                      "inline-flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-left text-body font-medium transition-colors",
                      active
                        ? "bg-teal-600 text-white"
                        : "text-slate-700 hover:bg-muted",
                    )}
                  >
                    <Icon className="size-4 shrink-0 opacity-90" aria-hidden />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          )}
        </CardBody>
      </Card>

      <Card className="gap-0 overflow-hidden py-0">
        {viewingVehicle && selectedVehicle ? (
          <VehicleContent
            customerId={customer.id}
            customerName={customer.name}
            vehicle={selectedVehicle}
            section={vehicleSection}
            canWrite={canWrite}
            locale={locale}
          />
        ) : null}

        {!viewingVehicle && section === "details" ? (
          <div>
            <SectionHeader
              title={t("namedDetails", { name: customer.name })}
              subtitle={t("detailsDescription")}
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
            />
            <dl className="grid gap-4 px-5 py-5 sm:grid-cols-2 sm:gap-x-8 sm:px-6">
              <Fact
                icon={Phone}
                label={t("phone")}
                value={
                  <a
                    href={`tel:${customer.phone}`}
                    className="font-medium text-teal-700 hover:underline"
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
          </div>
        ) : null}

        {!viewingVehicle && section === "vehicles" ? (
          <div>
            <SectionHeader
              title={t("vehicles")}
              subtitle={t("vehiclesDescription")}
              action={
                canWrite ? (
                  <CreateVehicleModal
                    customerId={customer.id}
                    customerName={customer.name}
                    onCreated={() => setSection("vehicles")}
                  />
                ) : null
              }
            />

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
          </div>
        ) : null}

        {!viewingVehicle && section === "service" ? (
          <div>
            <SectionHeader
              title={t("serviceHistory")}
              subtitle={t("serviceHistoryDescription")}
            />
            <EmptyState
              icon={Wrench}
              title={t("serviceHistoryEmpty")}
              body={t("serviceHistoryPlaceholder")}
              centered
            />
          </div>
        ) : null}

        {!viewingVehicle && section === "communication" ? (
          <div>
            <SectionHeader
              title={t("communicationHistory")}
              subtitle={t("communicationHistoryDescription")}
            />
            <EmptyState
              icon={MessageSquare}
              title={t("communicationHistoryEmpty")}
              body={t("communicationHistoryPlaceholder")}
              centered
            />
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function VehicleContent({
  customerId,
  customerName,
  vehicle,
  section,
  canWrite,
  locale,
}: {
  customerId: string;
  customerName: string;
  vehicle: VehicleRow;
  section: VehicleSection;
  canWrite: boolean;
  locale: string;
}) {
  const t = useTranslations("customers");
  const tv = useTranslations("vehicles");

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

  const editAction = canWrite ? (
    <EditVehicleModal
      vehicle={{
        id: vehicle.id,
        customerId,
        registrationNumber: vehicle.registrationNumber,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        odometer: vehicle.odometer,
        insuranceExpiry: vehicle.insuranceExpiry,
        pucExpiry: vehicle.pucExpiry,
        fitnessExpiry: vehicle.fitnessExpiry,
      }}
    />
  ) : null;

  if (section === "overview") {
    return (
      <div>
        <SectionHeader
          title={t("customerVehicleTitle", {
            customer: customerName,
            registration: vehicle.registrationNumber,
          })}
          subtitle={subtitle}
          action={editAction}
        />
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
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        title={tv("serviceHistory")}
        subtitle={tv("serviceHistoryDescription")}
      />
      <EmptyState
        icon={Wrench}
        title={tv("serviceHistoryEmpty")}
        body={tv("serviceHistoryPlaceholder")}
        centered
      />
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
      <div className="min-w-0 space-y-0.5">
        <h2 className="text-section-title text-slate-900">{title}</h2>
        <CardDescription>{subtitle}</CardDescription>
      </div>
      {action}
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
            : "bg-teal-50 text-teal-700 ring-1 ring-teal-100",
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
