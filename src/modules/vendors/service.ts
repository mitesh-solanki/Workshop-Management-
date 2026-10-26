import "server-only";

import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireRole, type RoleSession } from "@/lib/rbac";
import {
  countVendorLinkedRecords,
  createVendor,
  deleteVendorById,
  findVendorById,
  getGarageVendorOutstandingTotal,
  getVendorOutstandingPaise,
  listVendorsForSelect,
  searchVendors,
  updateVendorById,
} from "@/modules/vendors/repo";
import {
  createVendorSchema,
  deleteVendorSchema,
  updateVendorSchema,
  vendorSearchSchema,
  type CreateVendorInput,
  type UpdateVendorInput,
} from "@/modules/vendors/schema";
import { billOutstandingPaise } from "@/modules/purchases/outstanding";

const WRITE_ROLES = ["OWNER", "MANAGER"] as const;
const READ_ROLES = ["OWNER", "MANAGER", "ACCOUNTANT"] as const;

function assertVendorRead(session: RoleSession) {
  requireRole(session, READ_ROLES);
}

function assertVendorWrite(session: RoleSession) {
  requireRole(session, WRITE_ROLES);
}

export async function listVendors(
  session: RoleSession,
  raw: {
    q?: string;
    sort?: string;
    page?: number | string;
    pageSize?: number | string;
  } = {},
) {
  assertVendorRead(session);
  const input = vendorSearchSchema.parse(raw);
  return searchVendors(
    session.garageId,
    input.q,
    input.page,
    input.pageSize,
    input.sort,
  );
}

export async function getVendor(session: RoleSession, vendorId: string) {
  assertVendorRead(session);
  const vendor = await findVendorById(session.garageId, vendorId);
  if (!vendor) {
    throw new NotFoundError();
  }
  const outstandingPaise = await getVendorOutstandingPaise(
    session.garageId,
    vendorId,
  );
  const bills = vendor.vendorBills.map((bill) => ({
    id: bill.id,
    billNumber: bill.billNumber,
    billDate: bill.billDate,
    amountPaise: bill.amountPaise,
    outstandingPaise: billOutstandingPaise({
      amountPaise: bill.amountPaise,
      paymentsPaise: bill.payments.reduce((s, p) => s + p.amountPaise, 0),
      returnsCreditPaise: bill.returns.reduce((s, r) => s + r.creditPaise, 0),
    }),
  }));
  return { ...vendor, vendorBills: bills, outstandingPaise };
}

export async function createVendorRecord(
  session: RoleSession,
  raw: CreateVendorInput,
) {
  assertVendorWrite(session);
  const input = createVendorSchema.parse(raw);
  return createVendor(session.garageId, {
    ...input,
    actorId: session.userId,
  });
}

export async function updateVendorRecord(
  session: RoleSession,
  vendorId: string,
  raw: UpdateVendorInput,
) {
  assertVendorWrite(session);
  const input = updateVendorSchema.parse(raw);
  const vendor = await updateVendorById(session.garageId, vendorId, {
    ...input,
    actorId: session.userId,
  });
  if (!vendor) {
    throw new NotFoundError();
  }
  return vendor;
}

export async function deleteVendorRecord(
  session: RoleSession,
  vendorId: string,
) {
  assertVendorWrite(session);
  const { vendorId: id } = deleteVendorSchema.parse({ vendorId });

  const vendor = await findVendorById(session.garageId, id);
  if (!vendor) {
    throw new NotFoundError();
  }

  const linked = await countVendorLinkedRecords(session.garageId, id);
  if (linked > 0) {
    throw new AppError("VENDOR_HAS_PURCHASES");
  }

  const deleted = await deleteVendorById(session.garageId, id, {
    actorId: session.userId,
    name: vendor.name,
  });

  if (!deleted) {
    throw new NotFoundError();
  }

  return deleted;
}

export async function getVendorOptions(session: RoleSession) {
  assertVendorRead(session);
  return listVendorsForSelect(session.garageId);
}

export async function getTotalVendorOutstanding(session: RoleSession) {
  assertVendorRead(session);
  return getGarageVendorOutstandingTotal(session.garageId);
}

export function assertCanAccessVendors(session: RoleSession) {
  if (!READ_ROLES.includes(session.role as (typeof READ_ROLES)[number])) {
    throw new ForbiddenError();
  }
}

export function canWriteVendors(session: RoleSession) {
  return WRITE_ROLES.includes(session.role as (typeof WRITE_ROLES)[number]);
}
