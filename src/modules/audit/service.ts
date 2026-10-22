import "server-only";

import {
  createAuditLog,
  type WriteAuditLogInput,
} from "@/modules/audit/repo";

export type { WriteAuditLogInput };

export async function writeAuditLog(input: WriteAuditLogInput) {
  return createAuditLog(input);
}
