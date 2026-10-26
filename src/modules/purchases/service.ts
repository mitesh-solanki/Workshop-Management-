import "server-only";

import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireRole, type RoleSession } from "@/lib/rbac";
import {
  buildVendorBillAttachmentKey,
  createPresignedDownloadUrl,
  createPresignedUploadUrl,
  deleteStoredObject,
  storageKeyBelongsToGarage,
} from "@/lib/storage";
import {
  cancelPartsRequest,
  clearVendorBillAttachment,
  createPartsRequest,
  createPurchaseOrderFromRequests,
  createPurchaseReturn,
  createVendorBill,
  findPartsRequestById,
  findPurchaseOrderById,
  findPurchaseReturnById,
  findVendorBillById,
  listOpenPartsRequests,
  listPartsRequestsForPart,
  PurchasesTxError,
  receiveAgainstPurchaseOrder,
  recordVendorBillPayment,
  searchPartsRequests,
  searchPurchaseOrders,
  searchPurchaseReturns,
  searchVendorBills,
  setVendorBillAttachment,
} from "@/modules/purchases/repo";
import {
  assertVendorBillAttachmentLimits,
  cancelPartsRequestSchema,
  confirmVendorBillAttachmentSchema,
  createPartsRequestSchema,
  createPurchaseOrderSchema,
  createPurchaseReturnSchema,
  createVendorBillAttachmentUploadUrlSchema,
  createVendorBillSchema,
  partsRequestSearchSchema,
  purchaseOrderSearchSchema,
  purchaseReturnSearchSchema,
  receiveGoodsSchema,
  recordVendorBillPaymentSchema,
  removeVendorBillAttachmentSchema,
  vendorBillSearchSchema,
  type ConfirmVendorBillAttachmentInput,
  type CreatePartsRequestInput,
  type CreatePurchaseOrderInput,
  type CreatePurchaseReturnInput,
  type CreateVendorBillAttachmentUploadUrlInput,
  type CreateVendorBillInput,
  type ReceiveGoodsInput,
  type RecordVendorBillPaymentInput,
} from "@/modules/purchases/schema";
import { getGarageVendorOutstandingTotal } from "@/modules/vendors/repo";

const OPS_ROLES = ["OWNER", "MANAGER"] as const;
const MONEY_ROLES = ["OWNER", "MANAGER", "ACCOUNTANT"] as const;

function mapPurchasesError(error: unknown): never {
  if (error instanceof PurchasesTxError) {
    throw new AppError(error.code, 400);
  }
  throw error;
}

export function assertCanAccessPurchaseOps(session: RoleSession) {
  if (!OPS_ROLES.includes(session.role as (typeof OPS_ROLES)[number])) {
    throw new ForbiddenError();
  }
}

export function assertCanAccessVendorMoney(session: RoleSession) {
  if (!MONEY_ROLES.includes(session.role as (typeof MONEY_ROLES)[number])) {
    throw new ForbiddenError();
  }
}

export function canWritePurchaseOps(session: RoleSession) {
  return OPS_ROLES.includes(session.role as (typeof OPS_ROLES)[number]);
}

export function canWriteVendorMoney(session: RoleSession) {
  return MONEY_ROLES.includes(session.role as (typeof MONEY_ROLES)[number]);
}

export async function listPartsRequests(
  session: RoleSession,
  raw: {
    q?: string;
    status?: string;
    sort?: string;
    page?: number | string;
    pageSize?: number | string;
  } = {},
) {
  requireRole(session, OPS_ROLES);
  const input = partsRequestSearchSchema.parse(raw);
  return searchPartsRequests(
    session.garageId,
    input.q,
    input.status,
    input.sort,
    input.page,
    input.pageSize,
  );
}

export async function getPartsRequest(session: RoleSession, id: string) {
  requireRole(session, OPS_ROLES);
  const request = await findPartsRequestById(session.garageId, id);
  if (!request) throw new NotFoundError();
  return request;
}

export async function getOpenPartsRequests(session: RoleSession) {
  requireRole(session, OPS_ROLES);
  return listOpenPartsRequests(session.garageId);
}

export async function getPartsRequestsForPart(
  session: RoleSession,
  partId: string,
) {
  requireRole(session, OPS_ROLES);
  return listPartsRequestsForPart(session.garageId, partId);
}

export async function createPartsRequestRecord(
  session: RoleSession,
  raw: CreatePartsRequestInput,
) {
  requireRole(session, OPS_ROLES);
  const input = createPartsRequestSchema.parse(raw);
  try {
    return await createPartsRequest(session.garageId, {
      ...input,
      actorId: session.userId,
    });
  } catch (error) {
    mapPurchasesError(error);
  }
}

export async function cancelPartsRequestRecord(
  session: RoleSession,
  requestId: string,
) {
  requireRole(session, OPS_ROLES);
  const input = cancelPartsRequestSchema.parse({ requestId });
  try {
    return await cancelPartsRequest(
      session.garageId,
      input.requestId,
      session.userId,
    );
  } catch (error) {
    mapPurchasesError(error);
  }
}

export async function listPurchaseOrders(
  session: RoleSession,
  raw: {
    q?: string;
    status?: string;
    sort?: string;
    page?: number | string;
    pageSize?: number | string;
  } = {},
) {
  requireRole(session, OPS_ROLES);
  const input = purchaseOrderSearchSchema.parse(raw);
  return searchPurchaseOrders(
    session.garageId,
    input.q,
    input.status,
    input.sort,
    input.page,
    input.pageSize,
  );
}

export async function getPurchaseOrder(session: RoleSession, id: string) {
  requireRole(session, OPS_ROLES);
  const po = await findPurchaseOrderById(session.garageId, id);
  if (!po) throw new NotFoundError();
  return po;
}

export async function createPurchaseOrderRecord(
  session: RoleSession,
  raw: CreatePurchaseOrderInput,
) {
  requireRole(session, OPS_ROLES);
  const input = createPurchaseOrderSchema.parse(raw);
  try {
    return await createPurchaseOrderFromRequests(session.garageId, {
      vendorId: input.vendorId,
      notes: input.notes,
      partsRequestIds: input.partsRequestIds,
      actorId: session.userId,
    });
  } catch (error) {
    mapPurchasesError(error);
  }
}

export async function receiveGoodsRecord(
  session: RoleSession,
  raw: ReceiveGoodsInput,
) {
  requireRole(session, OPS_ROLES);
  const input = receiveGoodsSchema.parse(raw);
  try {
    return await receiveAgainstPurchaseOrder(session.garageId, {
      purchaseOrderId: input.purchaseOrderId,
      notes: input.notes,
      lines: input.lines,
      actorId: session.userId,
    });
  } catch (error) {
    mapPurchasesError(error);
  }
}

export async function listVendorBills(
  session: RoleSession,
  raw: {
    q?: string;
    sort?: string;
    page?: number | string;
    pageSize?: number | string;
  } = {},
) {
  requireRole(session, MONEY_ROLES);
  const input = vendorBillSearchSchema.parse(raw);
  const [result, totalOutstandingPaise] = await Promise.all([
    searchVendorBills(
      session.garageId,
      input.q,
      input.sort,
      input.page,
      input.pageSize,
    ),
    getGarageVendorOutstandingTotal(session.garageId),
  ]);
  return { ...result, totalOutstandingPaise };
}

export async function getVendorBill(session: RoleSession, id: string) {
  requireRole(session, MONEY_ROLES);
  const bill = await findVendorBillById(session.garageId, id);
  if (!bill) throw new NotFoundError();

  let attachmentUrl: string | null = null;
  if (bill.attachmentStorageKey) {
    try {
      attachmentUrl = await createPresignedDownloadUrl(
        bill.attachmentStorageKey,
      );
    } catch (error) {
      if (
        error instanceof AppError &&
        error.code === "STORAGE_NOT_CONFIGURED"
      ) {
        attachmentUrl = null;
      } else {
        throw error;
      }
    }
  }

  return { ...bill, attachmentUrl };
}

export async function createVendorBillAttachmentUploadUrl(
  session: RoleSession,
  raw: CreateVendorBillAttachmentUploadUrlInput,
) {
  requireRole(session, MONEY_ROLES);
  const input = createVendorBillAttachmentUploadUrlSchema.parse(raw);
  try {
    assertVendorBillAttachmentLimits(input.contentType, input.byteSize);
  } catch (error) {
    const code =
      error instanceof Error ? error.message : "purchases.bill_attachment_type";
    throw new AppError(code, 400);
  }

  const bill = await findVendorBillById(session.garageId, input.vendorBillId);
  if (!bill) throw new NotFoundError();

  const storageKey = buildVendorBillAttachmentKey({
    garageId: session.garageId,
    vendorBillId: bill.id,
    contentType: input.contentType,
  });

  try {
    const signed = await createPresignedUploadUrl({
      storageKey,
      contentType: input.contentType,
    });
    return {
      uploadUrl: signed.uploadUrl,
      storageKey: signed.storageKey,
      contentType: input.contentType,
      vendorBillId: bill.id,
    };
  } catch (error) {
    if (error instanceof AppError && error.code === "STORAGE_NOT_CONFIGURED") {
      throw new AppError("STORAGE_NOT_CONFIGURED", 500);
    }
    throw error;
  }
}

export async function confirmVendorBillAttachment(
  session: RoleSession,
  raw: ConfirmVendorBillAttachmentInput,
) {
  requireRole(session, MONEY_ROLES);
  const input = confirmVendorBillAttachmentSchema.parse(raw);
  try {
    assertVendorBillAttachmentLimits(input.contentType, input.byteSize);
  } catch (error) {
    const code =
      error instanceof Error ? error.message : "purchases.bill_attachment_type";
    throw new AppError(code, 400);
  }

  if (!storageKeyBelongsToGarage(input.storageKey, session.garageId)) {
    throw new ForbiddenError();
  }
  if (!input.storageKey.includes(`/vendor-bills/${input.vendorBillId}/`)) {
    throw new ForbiddenError();
  }

  try {
    const { bill, previousStorageKey } = await setVendorBillAttachment(
      session.garageId,
      {
        vendorBillId: input.vendorBillId,
        storageKey: input.storageKey,
        contentType: input.contentType,
        fileName: input.fileName,
        byteSize: input.byteSize,
        actorId: session.userId,
      },
    );

    if (
      previousStorageKey &&
      previousStorageKey !== input.storageKey
    ) {
      try {
        await deleteStoredObject(previousStorageKey);
      } catch {}
    }

    return {
      ...bill,
      attachmentUrl: await createPresignedDownloadUrl(bill.attachmentStorageKey!),
    };
  } catch (error) {
    mapPurchasesError(error);
  }
}

export async function removeVendorBillAttachment(
  session: RoleSession,
  vendorBillId: string,
) {
  requireRole(session, MONEY_ROLES);
  const input = removeVendorBillAttachmentSchema.parse({ vendorBillId });
  try {
    const { previousStorageKey } = await clearVendorBillAttachment(
      session.garageId,
      { vendorBillId: input.vendorBillId, actorId: session.userId },
    );
    if (previousStorageKey) {
      try {
        await deleteStoredObject(previousStorageKey);
      } catch {}
    }
  } catch (error) {
    mapPurchasesError(error);
  }
}

export async function createVendorBillRecord(
  session: RoleSession,
  raw: CreateVendorBillInput,
) {
  requireRole(session, MONEY_ROLES);
  const input = createVendorBillSchema.parse(raw);
  try {
    return await createVendorBill(session.garageId, {
      ...input,
      actorId: session.userId,
    });
  } catch (error) {
    mapPurchasesError(error);
  }
}

export async function recordVendorBillPaymentRecord(
  session: RoleSession,
  raw: RecordVendorBillPaymentInput,
) {
  requireRole(session, MONEY_ROLES);
  const input = recordVendorBillPaymentSchema.parse(raw);
  try {
    return await recordVendorBillPayment(session.garageId, {
      ...input,
      actorId: session.userId,
    });
  } catch (error) {
    mapPurchasesError(error);
  }
}

export async function listPurchaseReturns(
  session: RoleSession,
  raw: {
    q?: string;
    sort?: string;
    page?: number | string;
    pageSize?: number | string;
  } = {},
) {
  requireRole(session, MONEY_ROLES);
  const input = purchaseReturnSearchSchema.parse(raw);
  return searchPurchaseReturns(
    session.garageId,
    input.q,
    input.sort,
    input.page,
    input.pageSize,
  );
}

export async function getPurchaseReturn(session: RoleSession, id: string) {
  requireRole(session, MONEY_ROLES);
  const row = await findPurchaseReturnById(session.garageId, id);
  if (!row) throw new NotFoundError();
  return row;
}

export async function createPurchaseReturnRecord(
  session: RoleSession,
  raw: CreatePurchaseReturnInput,
) {
  requireRole(session, MONEY_ROLES);
  const input = createPurchaseReturnSchema.parse(raw);
  try {
    return await createPurchaseReturn(session.garageId, {
      ...input,
      actorId: session.userId,
    });
  } catch (error) {
    mapPurchasesError(error);
  }
}
