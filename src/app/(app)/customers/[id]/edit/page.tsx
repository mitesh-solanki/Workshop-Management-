import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";

type Props = {
  params: Promise<{ id: string }>;
};

/**
 * Customer edit is a modal on the detail page.
 * Keep this route as a shortcut back to the customer.
 */
export const instant = false;

export default async function EditCustomerPage({ params }: Props) {
  await requireSession();
  const { id } = await params;
  redirect(`/customers/${id}`);
}
