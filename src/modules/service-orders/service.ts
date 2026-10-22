import "server-only";

import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireRole, type RoleSession } from "@/lib/rbac";
import { findVehicleById } from "@/modules/vehicles/repo";
import {
  addServiceOrderLineSchema,
  canTransitionStatus,
  computeBayOccupancy,
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
    throw new ForbiddenError();
  }
}

function assertCanMutateOrder(
  session: RoleSession,
  order: { technicianId: string | null; status: ServiceOrderStatusValue },
) {
  if (session.role === "ACCOUNTANT") {
    throw new ForbiddenError();
  }
  if (session.role === "TECHNICIAN") {
    if (order.technicianId !== session.userId) {
      throw new ForbiddenError();
    }
  }
  if (order.status === "COMPLETED") {
    throw new AppError("ORDER_COMPLETED", 409);
  }
}

export async function listAssignableTechnicians(session: RoleSession) {
  requireRole(session, CREATE_ROLES);
  return listTechniciansInGarage(session.garageId);
}

/** Technicians for the workshop board filter (not for assignment). */
export async function listBoardTechnicians(session: RoleSession) {
  requireRole(session, READ_ROLES);
  if (session.role === "TECHNICIAN") {
    return [];
  }
  return listTechniciansInGarage(session.garageId);
}

export async function listOrders(
  session: RoleSession,
  options: { technicianId?: string } = {},
) {
  requireRole(session, READ_ROLES);

  if (session.role === "TECHNICIAN") {
    return listServiceOrders(session.garageId, {
      technicianId: session.userId,
    });
  }

  const technicianId = options.technicianId?.trim();
  if (technicianId) {
    return listServiceOrders(session.garageId, { technicianId });
  }
  return listServiceOrders(session.garageId);
}

export async function getBayOccupancy(
  session: RoleSession,
  options: { technicianId?: string } = {},
) {
  const orders = await listOrders(session, options);
  return computeBayOccupancy(orders);
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
    throw new NotFoundError();
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
    throw new NotFoundError();
  }

  if (input.technicianId) {
    const technician = await findTechnicianInGarage(
      session.garageId,
      input.technicianId,
    );
    if (!technician) {
      throw new AppError("INVALID_TECHNICIAN", 400);
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
    priority: input.priority,
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
    throw new NotFoundError();
  }

  assertCanMutateOrder(session, order);

  if (!canTransitionStatus(order.status, input.status)) {
    throw new AppError("INVALID_STATUS_TRANSITION", 400);
  }

  const updated = await updateServiceOrderStatus(session.garageId, orderId, {
    from: order.status,
    to: input.status,
    actorId: session.userId,
  });

  if (!updated) {
    throw new AppError("STATUS_CONFLICT", 409);
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
    throw new NotFoundError();
  }

  assertCanMutateOrder(session, order);

  if (input.type === "PART" && !input.partId) {
    throw new AppError("inventory.part_required", 400);
  }

  const result = await createServiceOrderLine(session.garageId, {
    serviceOrderId: order.id,
    type: input.type,
    description: input.description,
    quantity: input.quantity,
    unitPricePaise: input.unitPricePaise,
    partId: input.partId,
    actorId: session.userId,
  });

  if (!result.ok) {
    if (result.reason === "PART_NOT_FOUND") {
      throw new NotFoundError();
    }
    throw new AppError("inventory.insufficient_stock", 409);
  }

  return result.line;
}

/** Test helper: attempt to read while scoped to another garage id. */
export async function getOrderForGarageId(
  session: RoleSession,
  requestedGarageId: string,
  orderId: string,
) {
  if (requestedGarageId !== session.garageId) {
    throw new ForbiddenError();
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
    throw new ForbiddenError();
  }
  return changeOrderStatus(session, orderId, raw);
}
