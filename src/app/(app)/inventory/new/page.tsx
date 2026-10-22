import { redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { requireSession } from "@/lib/session";

/** Create moved to a modal on /inventory — keep this route as a soft redirect. */
export default async function NewPartPage() {
  const session = await requireSession();
  requireRole(session, ["OWNER", "MANAGER"]);
  redirect("/inventory");
}
