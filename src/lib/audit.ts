import "server-only";

import {
  writeAuditLog as writeAuditLogService,
  type WriteAuditLogInput,
} from "@/modules/audit/service";

export type { WriteAuditLogInput };

/** Thin wrapper so existing call sites keep importing `@/lib/audit`. */
export async function writeAuditLog(input: WriteAuditLogInput) {
  return writeAuditLogService(input);
}
