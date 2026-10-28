import Link from "next/link";
import { ChevronLeft, ShieldAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireRole, requireSession } from "@/lib/session";
import { listBaysForSelect } from "@/modules/bays/service";
import { getCustomer, listCustomers } from "@/modules/customers/service";
import { NewJobCardForm } from "@/modules/service-orders/components/new-job-card-form";
import { jobCardSurfaceForRole } from "@/modules/service-orders/job-card-sections";
import { listAssignableTechnicians } from "@/modules/service-orders/service";

type Props = {
  searchParams: Promise<{ vehicleId?: string; customerId?: string }>;
};

export const instant = false;

export default async function NewJobCardPage({ searchParams }: Props) {
  const session = await requireSession();
  const { vehicleId: rawVehicleId, customerId: rawCustomerId } =
    await searchParams;
  const initialVehicleId = rawVehicleId?.trim() ?? "";
  const scopedCustomerId = rawCustomerId?.trim() ?? "";
  const t = await getTranslations("orders");

  try {
    requireRole(session, ["OWNER", "MANAGER", "TECHNICIAN"]);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return (
        <main className="w-full space-y-6">
          <PageHeader title={t("newTitle")} />
          <EmptyState
            icon={ShieldAlert}
            title={t("forbiddenCreate")}
            action={
              <Link
                href="/orders"
                className="text-sm text-teal-700 underline-offset-4 hover:underline"
              >
                {t("back")}
              </Link>
            }
          />
        </main>
      );
    }
    throw error;
  }

  const surface = jobCardSurfaceForRole(session.role);
  const isTechnician = session.role === "TECHNICIAN";
  const [technicians, bays] = await Promise.all([
    isTechnician
      ? Promise.resolve([
          {
            id: session.userId,
            name: session.name,
            email: session.email,
          },
        ])
      : listAssignableTechnicians(session),
    listBaysForSelect(session),
  ]);

  type VehicleOption = {
    id: string;
    registrationNumber: string;
    make: string;
    model: string;
    odometer: number | null;
    customerId: string;
    customerName: string;
  };

  let vehicles: VehicleOption[] = [];
  let backHref = "/orders";
  let pageDescription = t("newSubtitleGeneric");

  if (scopedCustomerId) {
    try {
      const customer = await getCustomer(session, scopedCustomerId);
      vehicles = customer.vehicles.map((vehicle) => ({
        id: vehicle.id,
        registrationNumber: vehicle.registrationNumber,
        make: vehicle.make,
        model: vehicle.model,
        odometer: vehicle.odometer,
        customerId: customer.id,
        customerName: customer.name,
      }));
      backHref = `/customers/${customer.id}`;
      pageDescription = t("newSubtitleCustomer", {
        customer: customer.name,
      });
    } catch (error) {
      if (!(error instanceof NotFoundError) && !(error instanceof ForbiddenError)) {
        throw error;
      }
      vehicles = [];
    }
  } else {
    const { items: customers } = await listCustomers(session, {
      pageSize: 50,
    });
    vehicles = customers.flatMap((customer) =>
      customer.vehicles.map((vehicle) => ({
        id: vehicle.id,
        registrationNumber: vehicle.registrationNumber,
        make: vehicle.make,
        model: vehicle.model,
        odometer: vehicle.odometer,
        customerId: customer.id,
        customerName: customer.name,
      })),
    );

    if (initialVehicleId) {
      const selected = vehicles.find((item) => item.id === initialVehicleId);
      if (selected) {
        vehicles = vehicles.filter(
          (item) => item.customerId === selected.customerId,
        );
        backHref = `/customers/${selected.customerId}`;
        pageDescription = t("newSubtitle", {
          registration: selected.registrationNumber,
          customer: selected.customerName,
        });
      }
    }
  }

  const preselectedVehicleId =
    initialVehicleId && vehicles.some((item) => item.id === initialVehicleId)
      ? initialVehicleId
      : vehicles.length === 1
        ? vehicles[0]!.id
        : "";

  return (
    <main className="w-full max-w-none space-y-4">
      <Link
        href={backHref}
        className="inline-flex h-5 max-h-5 items-center gap-0.5 px-0.5 text-[13px] leading-5 text-muted-foreground hover:text-teal-700"
      >
        <ChevronLeft className="size-3.5 shrink-0" aria-hidden />
        {t("back")}
      </Link>

      <PageHeader title={t("newTitle")} description={pageDescription} />

      {vehicles.length === 0 ? (
        <EmptyState
          title={t("noVehiclesTitle")}
          description={t("noVehiclesDescription")}
          action={
            <Link
              href={scopedCustomerId ? `/customers/${scopedCustomerId}` : "/customers"}
              className="text-sm text-teal-700 underline-offset-4 hover:underline"
            >
              {t("goToCustomers")}
            </Link>
          }
        />
      ) : (
        <NewJobCardForm
          vehicles={vehicles}
          technicians={technicians}
          bays={bays}
          initialVehicleId={preselectedVehicleId}
          lockTechnicianId={isTechnician ? session.userId : undefined}
          surface={surface}
        />
      )}
    </main>
  );
}
