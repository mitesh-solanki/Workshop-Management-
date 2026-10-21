import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireRole, requireSession } from "@/lib/session";
import { VehicleForm } from "@/modules/vehicles/components/vehicle-form";
import { getVehicle } from "@/modules/vehicles/service";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditVehiclePage({ params }: Props) {
  const session = await requireSession();
  const { id } = await params;
  const t = await getTranslations("vehicles");
  const tc = await getTranslations("customers");

  try {
    requireRole(session, ["OWNER", "MANAGER", "TECHNICIAN"]);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return (
        <main className="space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight">{t("editTitle")}</h1>
          <p className="text-sm text-muted-foreground">{tc("forbidden")}</p>
        </main>
      );
    }
    throw error;
  }

  let vehicle: Awaited<ReturnType<typeof getVehicle>>;
  try {
    vehicle = await getVehicle(session, id);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }

  return (
    <main className="space-y-6">
      <div className="space-y-2">
        <Link
          href={`/customers/${vehicle.customerId}`}
          className="text-sm text-muted-foreground underline"
        >
          {tc("back")}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{t("editTitle")}</h1>
        <p className="text-base text-muted-foreground">
          {vehicle.registrationNumber} · {vehicle.customer.name}
        </p>
      </div>
      <VehicleForm
        mode="edit"
        vehicleId={vehicle.id}
        customerId={vehicle.customerId}
        vehicle={{
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
    </main>
  );
}
