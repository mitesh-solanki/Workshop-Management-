import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { NotFoundError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { listVehicleServiceHistory } from "@/modules/service-orders/service";
import { VehicleDetailPanel } from "@/modules/vehicles/components/vehicle-detail-panel";
import { getVehicle } from "@/modules/vehicles/service";

type Props = {
  params: Promise<{ id: string }>;
};

export const instant = false;

export default async function VehicleDetailPage({ params }: Props) {
  const session = await requireSession();
  const { id } = await params;
  const locale = await getLocale();
  const tv = await getTranslations("vehicles");

  let vehicle: Awaited<ReturnType<typeof getVehicle>>;
  try {
    vehicle = await getVehicle(session, id);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }

  const serviceHistory = await listVehicleServiceHistory(session, vehicle.id);

  const canWrite =
    session.role === "OWNER" ||
    session.role === "MANAGER" ||
    session.role === "TECHNICIAN";
  const canCreateOrder =
    session.role === "OWNER" ||
    session.role === "MANAGER" ||
    session.role === "TECHNICIAN";

  return (
    <main className="w-full space-y-4">
      <Link
        href={`/customers/${vehicle.customerId}`}
        className="hidden h-5 max-h-5 items-center gap-0.5 px-0.5 text-[13px] leading-5 text-slate-700 hover:text-blue-700 lg:inline-flex"
      >
        <ChevronLeft className="size-3.5 shrink-0" aria-hidden />
        {tv("backToCustomer")}
      </Link>

      <VehicleDetailPanel
        customerId={vehicle.customerId}
        customerName={vehicle.customer.name}
        vehicle={{
          id: vehicle.id,
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
        serviceHistory={serviceHistory}
        canWrite={canWrite}
        canCreateOrder={canCreateOrder}
        locale={locale}
      />
    </main>
  );
}
