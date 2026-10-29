import { redirect } from "next/navigation";
import { homePathForRole } from "@/lib/rbac";
import { requireSession } from "@/lib/session";

export const instant = false;

/** Legacy Settings entry — import is on each module list. */
export default async function SettingsImportRedirectPage() {
  const session = await requireSession();
  if (session.role === "TECHNICIAN") {
    redirect(homePathForRole(session.role));
  }
  redirect("/customers");
}
