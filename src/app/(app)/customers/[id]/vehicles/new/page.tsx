import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireRole, requireSession } from "@/lib/session";
import { getCustomer } from "@/modules/customers/service";
import { VehicleForm } from "@/modules/vehicles/components/vehicle-form";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function NewVehiclePage({ params }: Props) {
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
          <h1 className="text-2xl font-semibold tracking-tight">{t("newTitle")}</h1>
          <p className="text-sm text-muted-foreground">{tc("forbidden")}</p>
        </main>
      );
    }
    throw error;
  }

  let customer: Awaited<ReturnType<typeof getCustomer>>;
  try {
    customer = await getCustomer(session, id);
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
          href={`/customers/${customer.id}`}
          className="text-sm text-muted-foreground underline"
        >
          {tc("back")}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{t("newTitle")}</h1>
        <p className="text-base text-muted-foreground">
          {t("newSubtitle", { customer: customer.name })}
        </p>
      </div>
      <VehicleForm mode="create" customerId={customer.id} />
    </main>
  );
}
