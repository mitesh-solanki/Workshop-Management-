import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { NotFoundError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { CustomerDetailPanel } from "@/modules/customers/components/customer-detail-panel";
import { getCustomer } from "@/modules/customers/service";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ vehicle?: string }>;
};

export const instant = false;

export default async function CustomerDetailPage({
  params,
  searchParams,
}: Props) {
  const session = await requireSession();
  const { id } = await params;
  const { vehicle: vehicleId } = await searchParams;
  const locale = await getLocale();
  const t = await getTranslations("customers");

  let customer: Awaited<ReturnType<typeof getCustomer>>;
  try {
    customer = await getCustomer(session, id);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }

  const canWrite =
    session.role === "OWNER" ||
    session.role === "MANAGER" ||
    session.role === "TECHNICIAN";

  return (
    <main className="w-full space-y-4">
      <Link
        href="/customers"
        className="inline-flex h-5 max-h-5 items-center gap-0.5 px-0.5 text-[13px] leading-5 text-muted-foreground hover:text-teal-700"
      >
        <ChevronLeft className="size-3.5 shrink-0" aria-hidden />
        {t("back")}
      </Link>

      <CustomerDetailPanel
        customer={{
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          address: customer.address,
          notes: customer.notes,
        }}
        vehicles={customer.vehicles.map((vehicle) => ({
          id: vehicle.id,
          registrationNumber: vehicle.registrationNumber,
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          odometer: vehicle.odometer,
          insuranceExpiry: vehicle.insuranceExpiry,
          pucExpiry: vehicle.pucExpiry,
          fitnessExpiry: vehicle.fitnessExpiry,
        }))}
        canWrite={canWrite}
        locale={locale}
        initialVehicleId={vehicleId ?? null}
      />
    </main>
  );
}
