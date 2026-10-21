import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireRole, requireSession } from "@/lib/session";
import { ServiceOrderForm } from "@/modules/service-orders/components/service-order-form";
import { listAssignableTechnicians } from "@/modules/service-orders/service";
import { getVehicle } from "@/modules/vehicles/service";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function NewServiceOrderPage({ params }: Props) {
  const session = await requireSession();
  const { id } = await params;
  const t = await getTranslations("orders");
  const tc = await getTranslations("customers");

  try {
    requireRole(session, ["OWNER", "MANAGER"]);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return (
        <main className="space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("newTitle")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("forbiddenCreate")}</p>
        </main>
      );
    }
    throw error;
  }

  let vehicle: Awaited<ReturnType<typeof getVehicle>>;
  let technicians: Awaited<ReturnType<typeof listAssignableTechnicians>>;
  try {
    vehicle = await getVehicle(session, id);
    technicians = await listAssignableTechnicians(session);
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
        <h1 className="text-2xl font-semibold tracking-tight">{t("newTitle")}</h1>
        <p className="text-base text-muted-foreground">
          {t("newSubtitle", {
            registration: vehicle.registrationNumber,
            customer: vehicle.customer.name,
          })}
        </p>
      </div>
      <ServiceOrderForm
        vehicleId={vehicle.id}
        defaultOdometer={vehicle.odometer}
        technicians={technicians}
      />
    </main>
  );
}
