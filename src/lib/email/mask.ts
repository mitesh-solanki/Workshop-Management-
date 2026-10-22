import { createHash } from "node:crypto";

/** Hash for logs — never log raw emails when avoidable. */
export function hashRecipient(email: string) {
  return createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("hex")
    .slice(0, 16);
}

/** e.g. j***@example.com */
export function maskEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const at = normalized.indexOf("@");
  if (at <= 0) return "***";
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}
