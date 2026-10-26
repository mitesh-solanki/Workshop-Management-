import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";

export const instant = false;

/** Import opens from the Inventory list modal. */
export default async function InventoryImportRedirectPage() {
  await requireSession();
  redirect("/inventory");
}
