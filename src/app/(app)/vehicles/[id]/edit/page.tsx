import { notFound, redirect } from "next/navigation";
import { NotFoundError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { getVehicle } from "@/modules/vehicles/service";

type Props = {
  params: Promise<{ id: string }>;
};

/** Vehicle edit is a modal on the customer detail page. */
export const instant = false;

export default async function EditVehiclePage({ params }: Props) {
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
