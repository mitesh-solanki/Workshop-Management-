import { redirect } from "next/navigation";
import { homePathForRole } from "@/lib/rbac";
import { getOptionalSession } from "@/lib/session";

// Home always sends people to login (or the app if already signed in).
export const instant = false;

export default async function HomePage() {
  const session = await getOptionalSession();
  redirect(session ? homePathForRole(session.role) : "/login");
}
