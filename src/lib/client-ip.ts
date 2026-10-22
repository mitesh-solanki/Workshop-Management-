import "server-only";

import { headers } from "next/headers";

/** Best-effort client IP for rate limiting. Never trust alone for auth decisions. */
export async function getClientIp() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return h.get("x-real-ip")?.trim() || "unknown";
}
