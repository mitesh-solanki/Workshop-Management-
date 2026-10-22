import { notFound, redirect } from "next/navigation";
import { NotFoundError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { getVehicle } from "@/modules/vehicles/service";

type Props = {
  params: Promise<{ id: string }>;
};

/** Vehicle detail lives on the customer page to avoid extra navigation. */
export const instant = false;

export default async function VehicleDetailPage({ params }: Props) {
  const session = await requireSession();
  const { id } = await params;

  let vehicle: Awaited<ReturnType<typeof getVehicle>>;
  try {
    vehicle = await getVehicle(session, id);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }

  redirect(
    `/customers/${vehicle.customerId}?vehicle=${encodeURIComponent(vehicle.id)}`,
  );
}
