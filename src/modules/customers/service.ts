import "server-only";

import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireRole, type RoleSession } from "@/lib/rbac";
import {
  countCustomerServiceOrders,
  createCustomer,
  deleteCustomerById,
  findCustomerById,
  searchCustomers,
  updateCustomerById,
} from "@/modules/customers/repo";
import {
  createCustomerSchema,
  customerSearchSchema,
  updateCustomerSchema,
  type CreateCustomerInput,
  type UpdateCustomerInput,
} from "@/modules/customers/schema";

const WRITE_ROLES = ["OWNER", "MANAGER", "TECHNICIAN"] as const;

export async function listCustomers(
  session: RoleSession,
  raw: { q?: string } = {},
) {
  const input = customerSearchSchema.parse(raw);
  // garageId always comes from the session — never from the request.
  return searchCustomers(session.garageId, input.q);
}

export async function getCustomer(session: RoleSession, customerId: string) {
  const customer = await findCustomerById(session.garageId, customerId);
  if (!customer) {
    throw new NotFoundError();
  }
  return customer;
}

export async function createCustomerRecord(
  session: RoleSession,
  raw: CreateCustomerInput,
) {
  requireRole(session, WRITE_ROLES);
  const input = createCustomerSchema.parse(raw);

  return createCustomer(session.garageId, {
    name: input.name,
    phone: input.phone,
    address: input.address,
    notes: input.notes,
  });
}

export async function updateCustomerRecord(
  session: RoleSession,
  customerId: string,
  raw: UpdateCustomerInput,
) {
  requireRole(session, WRITE_ROLES);
  const input = updateCustomerSchema.parse(raw);

  const customer = await updateCustomerById(session.garageId, customerId, {
    name: input.name,
    phone: input.phone,
    address: input.address,
    notes: input.notes,
  });

  if (!customer) {
    throw new NotFoundError();
  }

  return customer;
}

export async function deleteCustomerRecord(
  session: RoleSession,
  customerId: string,
) {
  requireRole(session, WRITE_ROLES);

  const customer = await findCustomerById(session.garageId, customerId);
  if (!customer) {
    throw new NotFoundError();
  }

  const orderCount = await countCustomerServiceOrders(
    session.garageId,
    customerId,
  );
  if (orderCount > 0) {
    throw new AppError("CUSTOMER_HAS_ORDERS", 409);
  }

  const deleted = await deleteCustomerById(session.garageId, customerId, {
    actorId: session.userId,
    name: customer.name,
    phone: customer.phone,
  });

  if (!deleted) {
    throw new NotFoundError();
  }

  return deleted;
}

/** Test helper: attempt to read a customer while scoped to another garage id. */
export async function getCustomerForGarageId(
  session: RoleSession,
  requestedGarageId: string,
  customerId: string,
) {
  if (requestedGarageId !== session.garageId) {
    throw new ForbiddenError();
  }
  return getCustomer(session, customerId);
}

/** Test helper: attempt to update a customer while scoped to another garage id. */
export async function updateCustomerForGarageId(
  session: RoleSession,
  requestedGarageId: string,
  customerId: string,
  raw: UpdateCustomerInput,
) {
  if (requestedGarageId !== session.garageId) {
    throw new ForbiddenError();
  }
  return updateCustomerRecord(session, customerId, raw);
}

/** Test helper: attempt to delete a customer while scoped to another garage id. */
export async function deleteCustomerForGarageId(
  session: RoleSession,
  requestedGarageId: string,
  customerId: string,
) {
  if (requestedGarageId !== session.garageId) {
    throw new ForbiddenError();
  }
  return deleteCustomerRecord(session, customerId);
}
