import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";

export const instant = false;

/** Import opens from the Vehicles list modal. */
export default async function VehiclesImportRedirectPage() {
  await requireSession();
  redirect("/vehicles");
}
