import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { NotFoundError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { CustomerDetailPanel } from "@/modules/customers/components/customer-detail-panel";
import { getCustomer } from "@/modules/customers/service";
import { listCustomerServiceHistory } from "@/modules/service-orders/service";

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

  let customer: Awaited<ReturnType<typeof getCustomer>>;
  try {
    customer = await getCustomer(session, id);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }

  const serviceHistory = await listCustomerServiceHistory(session, customer.id);

  const canWrite =
    session.role === "OWNER" ||
    session.role === "MANAGER" ||
    session.role === "TECHNICIAN";
  const canCreateOrder =
    session.role === "OWNER" || session.role === "MANAGER";

  return (
    <main className="w-full space-y-4">
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
          stateCode: vehicle.stateCode,
          year: vehicle.year,
          odometer: vehicle.odometer,
          insuranceExpiry: vehicle.insuranceExpiry,
          pucExpiry: vehicle.pucExpiry,
          fitnessExpiry: vehicle.fitnessExpiry,
        }))}
        serviceHistory={serviceHistory}
        canWrite={canWrite}
        canCreateOrder={canCreateOrder}
        locale={locale}
        initialVehicleId={vehicleId ?? null}
      />
    </main>
  );
}
