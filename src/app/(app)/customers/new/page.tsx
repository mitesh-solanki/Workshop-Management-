import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";

/**
 * Customer create lives in a modal on `/customers`.
 * Keep this route as a shortcut that opens the Add modal.
 */
export const instant = false;

export default async function NewCustomerPage() {
  await requireSession();
  redirect("/customers?create=1");
}
