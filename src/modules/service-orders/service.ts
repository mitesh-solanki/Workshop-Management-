import "server-only";

import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireRole, type RoleSession } from "@/lib/rbac";
import { findVehicleById } from "@/modules/vehicles/repo";
import {
  addServiceOrderLineSchema,
  canTransitionStatus,
  createServiceOrderSchema,
  updateServiceOrderStatusSchema,
  type AddServiceOrderLineInput,
  type CreateServiceOrderInput,
  type ServiceOrderStatusValue,
  type UpdateServiceOrderStatusInput,
} from "@/modules/service-orders/schema";
import {
  createServiceOrder,
  createServiceOrderLine,
  findServiceOrderById,
  findTechnicianInGarage,
  listServiceOrderAuditLogs,
  listServiceOrders,
  listServiceOrdersByCustomer,
  listTechniciansInGarage,
  updateServiceOrderStatus,
} from "@/modules/service-orders/repo";

const CREATE_ROLES = ["OWNER", "MANAGER"] as const;
const MANAGE_ROLES = ["OWNER", "MANAGER"] as const;
const LINE_ROLES = ["OWNER", "MANAGER", "TECHNICIAN"] as const;
const READ_ROLES = ["OWNER", "MANAGER", "TECHNICIAN", "ACCOUNTANT"] as const;

function assertCanViewOrder(
  session: RoleSession,
  order: { technicianId: string | null },
) {
  if (session.role === "TECHNICIAN" && order.technicianId !== session.userId) {
    throw new ForbiddenError("Technicians can only view their assigned orders");
  }
}

function assertCanMutateOrder(
  session: RoleSession,
  order: { technicianId: string | null; status: ServiceOrderStatusValue },
) {
  if (session.role === "ACCOUNTANT") {
    throw new ForbiddenError("Accountants cannot change service orders");
  }
  if (session.role === "TECHNICIAN") {
    if (order.technicianId !== session.userId) {
      throw new ForbiddenError(
        "Technicians can only change their assigned orders",
      );
    }
  }
  if (order.status === "COMPLETED") {
    throw new AppError(
      "ORDER_COMPLETED",
      "Completed orders cannot be changed",
    );
  }
}

export async function listAssignableTechnicians(session: RoleSession) {
  requireRole(session, CREATE_ROLES);
  return listTechniciansInGarage(session.garageId);
}

export async function listOrders(session: RoleSession) {
  requireRole(session, READ_ROLES);

  if (session.role === "TECHNICIAN") {
    return listServiceOrders(session.garageId, {
      technicianId: session.userId,
    });
  }

  return listServiceOrders(session.garageId);
}

/** Customer service history, scoped for technicians to their assignments. */
export async function listCustomerServiceHistory(
  session: RoleSession,
  customerId: string,
) {
  requireRole(session, READ_ROLES);

  if (session.role === "TECHNICIAN") {
    const assigned = await listServiceOrders(session.garageId, {
      technicianId: session.userId,
    });
    return assigned
      .filter((order) => order.customerId === customerId)
      .map((order) => ({
        id: order.id,
        status: order.status,
        complaint: order.complaint,
        createdAt: order.createdAt,
        expectedCompletion: order.expectedCompletion,
        vehicle: {
          id: order.vehicle.id,
          registrationNumber: order.vehicle.registrationNumber,
        },
      }));
  }

  return listServiceOrdersByCustomer(session.garageId, customerId);
}

export async function getOrder(session: RoleSession, orderId: string) {
  requireRole(session, READ_ROLES);
  const order = await findServiceOrderById(session.garageId, orderId);
  if (!order) {
    throw new NotFoundError("Service order not found");
  }
  assertCanViewOrder(session, order);
  return order;
}

export async function getOrderTimeline(session: RoleSession, orderId: string) {
  const order = await getOrder(session, orderId);
  const events = await listServiceOrderAuditLogs(session.garageId, order.id);
  return events;
}

export async function createOrder(
  session: RoleSession,
  raw: CreateServiceOrderInput,
) {
  requireRole(session, CREATE_ROLES);
  const input = createServiceOrderSchema.parse(raw);

  const vehicle = await findVehicleById(session.garageId, input.vehicleId);
  if (!vehicle) {
    throw new NotFoundError("Vehicle not found");
  }

  if (input.technicianId) {
    const technician = await findTechnicianInGarage(
      session.garageId,
      input.technicianId,
    );
    if (!technician) {
      throw new AppError(
        "INVALID_TECHNICIAN",
        "Assigned technician must be a technician in this garage",
      );
    }
  }

  return createServiceOrder(session.garageId, {
    vehicleId: vehicle.id,
    customerId: vehicle.customerId,
    complaint: input.complaint,
    requestedServices: input.requestedServices,
    odometerIn: input.odometerIn,
    expectedCompletion: input.expectedCompletion,
    technicianId: input.technicianId,
    bay: input.bay,
    actorId: session.userId,
  });
}

export async function changeOrderStatus(
  session: RoleSession,
  orderId: string,
  raw: UpdateServiceOrderStatusInput,
) {
  requireRole(session, [...MANAGE_ROLES, "TECHNICIAN"]);
  const input = updateServiceOrderStatusSchema.parse(raw);

  const order = await findServiceOrderById(session.garageId, orderId);
  if (!order) {
    throw new NotFoundError("Service order not found");
  }

  assertCanMutateOrder(session, order);

  if (!canTransitionStatus(order.status, input.status)) {
    throw new AppError(
      "INVALID_STATUS_TRANSITION",
      `Cannot change status from ${order.status} to ${input.status}`,
    );
  }

  const updated = await updateServiceOrderStatus(session.garageId, orderId, {
    from: order.status,
    to: input.status,
    actorId: session.userId,
  });

  if (!updated) {
    throw new AppError(
      "STATUS_CONFLICT",
      "Order status changed by someone else. Refresh and try again.",
    );
  }

  return updated;
}

export async function addOrderLine(
  session: RoleSession,
  orderId: string,
  raw: AddServiceOrderLineInput,
) {
  requireRole(session, LINE_ROLES);
  const input = addServiceOrderLineSchema.parse(raw);

  const order = await findServiceOrderById(session.garageId, orderId);
  if (!order) {
    throw new NotFoundError("Service order not found");
  }

  assertCanMutateOrder(session, order);

  return createServiceOrderLine(session.garageId, {
    serviceOrderId: order.id,
    type: input.type,
    description: input.description,
    quantity: input.quantity,
    unitPricePaise: input.unitPricePaise,
    partId: input.partId,
    actorId: session.userId,
  });
}

/** Test helper: attempt to read while scoped to another garage id. */
export async function getOrderForGarageId(
  session: RoleSession,
  requestedGarageId: string,
  orderId: string,
) {
  if (requestedGarageId !== session.garageId) {
    throw new ForbiddenError("Cross-garage access denied");
  }
  return getOrder(session, orderId);
}

/** Test helper: attempt to change status while scoped to another garage id. */
export async function changeOrderStatusForGarageId(
  session: RoleSession,
  requestedGarageId: string,
  orderId: string,
  raw: UpdateServiceOrderStatusInput,
) {
  if (requestedGarageId !== session.garageId) {
    throw new ForbiddenError("Cross-garage access denied");
  }
  return changeOrderStatus(session, orderId, raw);
}
