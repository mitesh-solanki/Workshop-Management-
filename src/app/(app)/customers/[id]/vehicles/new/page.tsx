import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";

type Props = {
  params: Promise<{ id: string }>;
};

/** Vehicle create is a modal on the customer detail page. */
export const instant = false;

export default async function NewVehiclePage({ params }: Props) {
  await requireSession();
  const { id } = await params;
  redirect(`/customers/${id}`);
}
