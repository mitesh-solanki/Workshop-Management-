import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";

export const instant = false;

/** Import opens from the Customers list modal. */
export default async function CustomersImportRedirectPage() {
  await requireSession();
  redirect("/customers");
}
