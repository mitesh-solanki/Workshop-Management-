import "server-only";

import { requireRole, type RoleSession } from "@/lib/rbac";
import { listJobSlipOrders } from "@/modules/job-slips/repo";

const READ_ROLES = ["OWNER", "MANAGER", "ACCOUNTANT"] as const;

export async function listJobSlips(session: RoleSession) {
  requireRole(session, READ_ROLES);
  return listJobSlipOrders(session.garageId);
}
