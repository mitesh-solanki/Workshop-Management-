import "server-only";

import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireRole, type RoleSession } from "@/lib/rbac";
import { findCustomerById } from "@/modules/customers/repo";
import {
  countVehicleServiceOrders,
  createVehicle,
  deleteVehicleById,
  findVehicleById,
  findVehicleByRegistration,
  isUniqueConstraintError,
  updateVehicleById,
} from "@/modules/vehicles/repo";
import {
  createVehicleSchema,
  updateVehicleSchema,
  type CreateVehicleInput,
  type UpdateVehicleInput,
} from "@/modules/vehicles/schema";

const WRITE_ROLES = ["OWNER", "MANAGER", "TECHNICIAN"] as const;

async function assertCustomerInGarage(garageId: string, customerId: string) {
  const customer = await findCustomerById(garageId, customerId);
  if (!customer) {
    throw new NotFoundError();
  }
  return customer;
}

export async function getVehicle(session: RoleSession, vehicleId: string) {
  const vehicle = await findVehicleById(session.garageId, vehicleId);
  if (!vehicle) {
    throw new NotFoundError();
  }
  return vehicle;
}

export async function createVehicleRecord(
  session: RoleSession,
  raw: CreateVehicleInput,
) {
  requireRole(session, WRITE_ROLES);
  const input = createVehicleSchema.parse(raw);

  await assertCustomerInGarage(session.garageId, input.customerId);

  const existing = await findVehicleByRegistration(
    session.garageId,
    input.registrationNumber,
  );
  if (existing) {
    throw new AppError("vehicles.duplicate_registration");
  }

  try {
    return await createVehicle(session.garageId, {
      customerId: input.customerId,
      registrationNumber: input.registrationNumber,
      make: input.make,
      model: input.model,
      year: input.year,
      odometer: input.odometer,
      insuranceExpiry: input.insuranceExpiry,
      pucExpiry: input.pucExpiry,
      fitnessExpiry: input.fitnessExpiry,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AppError("vehicles.duplicate_registration");
    }
    throw error;
  }
}

export async function updateVehicleRecord(
  session: RoleSession,
  vehicleId: string,
  raw: UpdateVehicleInput,
) {
  requireRole(session, WRITE_ROLES);
  const input = updateVehicleSchema.parse(raw);

  const current = await findVehicleById(session.garageId, vehicleId);
  if (!current) {
    throw new NotFoundError();
  }

  if (input.registrationNumber !== current.registrationNumber) {
    const existing = await findVehicleByRegistration(
      session.garageId,
      input.registrationNumber,
    );
    if (existing && existing.id !== vehicleId) {
      throw new AppError("vehicles.duplicate_registration");
    }
  }

  try {
    const vehicle = await updateVehicleById(session.garageId, vehicleId, {
      registrationNumber: input.registrationNumber,
      make: input.make,
      model: input.model,
      year: input.year,
      odometer: input.odometer,
      insuranceExpiry: input.insuranceExpiry,
      pucExpiry: input.pucExpiry,
      fitnessExpiry: input.fitnessExpiry,
    });

    if (!vehicle) {
      throw new NotFoundError();
    }

    return vehicle;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AppError("vehicles.duplicate_registration");
    }
    throw error;
  }
}

export async function deleteVehicleRecord(
  session: RoleSession,
  vehicleId: string,
) {
  requireRole(session, WRITE_ROLES);

  const vehicle = await findVehicleById(session.garageId, vehicleId);
  if (!vehicle) {
    throw new NotFoundError();
  }

  const orderCount = await countVehicleServiceOrders(
    session.garageId,
    vehicleId,
  );
  if (orderCount > 0) {
    throw new AppError("VEHICLE_HAS_ORDERS");
  }

  const deleted = await deleteVehicleById(session.garageId, vehicleId, {
    actorId: session.userId,
    customerId: vehicle.customerId,
    registrationNumber: vehicle.registrationNumber,
  });

  if (!deleted) {
    throw new NotFoundError();
  }

  return deleted;
}

/** Test helper: attempt to read a vehicle while scoped to another garage id. */
export async function getVehicleForGarageId(
  session: RoleSession,
  requestedGarageId: string,
  vehicleId: string,
) {
  if (requestedGarageId !== session.garageId) {
    throw new ForbiddenError();
  }
  return getVehicle(session, vehicleId);
}

/** Test helper: attempt to create a vehicle while scoped to another garage id. */
export async function createVehicleForGarageId(
  session: RoleSession,
  requestedGarageId: string,
  raw: CreateVehicleInput,
) {
  if (requestedGarageId !== session.garageId) {
    throw new ForbiddenError();
  }
  return createVehicleRecord(session, raw);
}

/** Test helper: attempt to delete a vehicle while scoped to another garage id. */
export async function deleteVehicleForGarageId(
  session: RoleSession,
  requestedGarageId: string,
  vehicleId: string,
) {
  if (requestedGarageId !== session.garageId) {
    throw new ForbiddenError();
  }
  return deleteVehicleRecord(session, vehicleId);
}
