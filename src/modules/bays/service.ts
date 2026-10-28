import "server-only";

import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireRole, type RoleSession } from "@/lib/rbac";
import {
  countOpenOrdersByBayName,
  createBay,
  deleteBayById,
  findBayById,
  findBayNameInGarage,
  getNextBaySortOrder,
  listActiveBaysForSelect,
  searchBays,
  updateBayById,
} from "@/modules/bays/repo";
import {
  baySearchSchema,
  createBaySchema,
  deleteBaySchema,
  updateBaySchema,
  type CreateBayInput,
  type UpdateBayInput,
} from "@/modules/bays/schema";

const WRITE_ROLES = ["OWNER", "MANAGER"] as const;
const READ_ROLES = ["OWNER", "MANAGER"] as const;

function assertBayRead(session: RoleSession) {
  requireRole(session, READ_ROLES);
}

function assertBayWrite(session: RoleSession) {
  requireRole(session, WRITE_ROLES);
}

export function assertCanAccessBays(session: RoleSession) {
  if (!READ_ROLES.includes(session.role as (typeof READ_ROLES)[number])) {
    throw new ForbiddenError();
  }
}

export function canWriteBays(session: RoleSession) {
  return WRITE_ROLES.includes(session.role as (typeof WRITE_ROLES)[number]);
}

export async function listBays(
  session: RoleSession,
  raw: {
    q?: string;
    sort?: string;
    page?: number | string;
    pageSize?: number | string;
  } = {},
) {
  assertBayRead(session);
  const input = baySearchSchema.parse(raw);
  const result = await searchBays(
    session.garageId,
    input.q,
    input.page,
    input.pageSize,
    input.sort,
  );
  const openByBay = await countOpenOrdersByBayName(
    session.garageId,
    result.items.map((bay) => bay.name),
  );
  return {
    ...result,
    items: result.items.map((bay) => ({
      ...bay,
      openJobCount: openByBay.get(bay.name.toLowerCase()) ?? 0,
    })),
  };
}

/** Bay names for job-card forms — technicians may pick a bay, not manage the list. */
export async function listBaysForSelect(session: RoleSession) {
  requireRole(session, ["OWNER", "MANAGER", "TECHNICIAN"]);
  return listActiveBaysForSelect(session.garageId);
}

export async function createBayRecord(
  session: RoleSession,
  raw: CreateBayInput,
) {
  assertBayWrite(session);
  const { name } = createBaySchema.parse(raw);

  const existing = await findBayNameInGarage(session.garageId, name);
  if (existing) {
    throw new AppError("bays.name_exists", 409, { name: existing });
  }

  const sortOrder = await getNextBaySortOrder(session.garageId);
  return createBay(session.garageId, {
    name,
    actorId: session.userId,
    sortOrder,
  });
}

export async function updateBayRecord(
  session: RoleSession,
  bayId: string,
  raw: UpdateBayInput,
) {
  assertBayWrite(session);
  const { name } = updateBaySchema.parse(raw);

  const bay = await findBayById(session.garageId, bayId);
  if (!bay) {
    throw new NotFoundError();
  }

  const existing = await findBayNameInGarage(session.garageId, name, bayId);
  if (existing) {
    throw new AppError("bays.name_exists", 409, { name: existing });
  }

  const updated = await updateBayById(session.garageId, bayId, {
    name,
    actorId: session.userId,
  });
  if (!updated) {
    throw new NotFoundError();
  }
  return updated;
}

export async function deleteBayRecord(session: RoleSession, bayId: string) {
  assertBayWrite(session);
  const { bayId: id } = deleteBaySchema.parse({ bayId });

  const bay = await findBayById(session.garageId, id);
  if (!bay) {
    throw new NotFoundError();
  }

  const deleted = await deleteBayById(session.garageId, id, {
    actorId: session.userId,
    name: bay.name,
  });
  if (!deleted) {
    throw new NotFoundError();
  }
  return bay;
}
