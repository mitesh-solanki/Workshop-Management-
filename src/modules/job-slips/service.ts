import "server-only";

import { requireRole, type RoleSession } from "@/lib/rbac";
import {
  findJobSlipOrder,
  listJobSlipOrders,
} from "@/modules/job-slips/repo";
import { toJobSlipCardData } from "@/modules/job-slips/to-job-slip-card";
import { getGarageSettings } from "@/modules/settings/service";

const READ_ROLES = ["OWNER", "MANAGER", "ACCOUNTANT"] as const;
const ORDER_REPORT_ROLES = [
  "OWNER",
  "MANAGER",
  "ACCOUNTANT",
  "TECHNICIAN",
] as const;

export async function listJobSlips(session: RoleSession) {
  requireRole(session, READ_ROLES);
  return listJobSlipOrders(session.garageId);
}

export async function getJobReportForOrder(
  session: RoleSession,
  orderId: string,
) {
  requireRole(session, ORDER_REPORT_ROLES);

  const order = await findJobSlipOrder(session.garageId, orderId, {
    ...(session.role === "TECHNICIAN"
      ? { technicianId: session.userId }
      : {}),
  });
  if (!order) {
    return null;
  }

  const garage = await getGarageSettings(session);
  return toJobSlipCardData(order, {
    name: garage.name,
    address: garage.address,
  });
}
