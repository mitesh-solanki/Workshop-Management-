import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";

export const instant = false;

/** Legacy Settings entry — import is on each module list. */
export default async function SettingsImportRedirectPage() {
  await requireSession();
  redirect("/customers");
}
