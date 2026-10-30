import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ShieldAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ForbiddenError } from "@/lib/errors";
import { homePathForRole } from "@/lib/rbac";
import { requireRole, requireSession } from "@/lib/session";
import { getCustomer, listCustomers } from "@/modules/customers/service";
import { InspectionPageForm } from "@/modules/inspections/components/inspection-page-form";

type Props = {
  searchParams: Promise<{
    vehicleId?: string;
    customerId?: string;
    section?: string;
  }>;
};

export const instant = false;

export default async function NewInspectionPage({ searchParams }: Props) {
  const session = await requireSession();
  if (session.role === "TECHNICIAN") {
    redirect(homePathForRole(session.role));
  }
  const params = await searchParams;
  const t = await getTranslations("inspections");

  try {
    requireRole(session, ["OWNER", "MANAGER"]);
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
                href="/inspections"
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

  const initialVehicleId = params.vehicleId?.trim() ?? "";
  const scopedCustomerId = params.customerId?.trim() ?? "";

  let vehicles: {
    id: string;
    registrationNumber: string;
    make: string;
    model: string;
    customerId: string;
    customerName: string;
  }[] = [];

  if (scopedCustomerId) {
    try {
      const customer = await getCustomer(session, scopedCustomerId);
      vehicles = customer.vehicles.map((vehicle) => ({
        id: vehicle.id,
        registrationNumber: vehicle.registrationNumber,
        make: vehicle.make,
        model: vehicle.model,
        customerId: customer.id,
        customerName: customer.name,
      }));
    } catch {
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
        customerId: customer.id,
        customerName: customer.name,
      })),
    );
  }

  return (
    <main className="w-full space-y-4">
      <Link
        href="/inspections"
        className="inline-flex h-5 max-h-5 items-center gap-0.5 px-0.5 text-[13px] leading-5 text-slate-700 hover:text-blue-700"
      >
        <ChevronLeft className="size-3.5 shrink-0" aria-hidden />
        {t("back")}
      </Link>

      {vehicles.length === 0 ? (
        <>
          <PageHeader title={t("newTitle")} description={t("newSubtitle")} />
          <EmptyState
            title={t("noVehiclesTitle")}
            description={t("noVehiclesDescription")}
            action={
              <Link
                href="/vehicles"
                className="text-sm font-medium text-teal-700 underline-offset-4 hover:underline"
              >
                {t("goToVehicles")}
              </Link>
            }
          />
        </>
      ) : (
        <InspectionPageForm
          mode="create"
          vehicles={vehicles}
          initialVehicleId={initialVehicleId}
          initialCustomerId={scopedCustomerId}
          initialSection={params.section}
        />
      )}
    </main>
  );
}
