import "server-only";

import type {
  InspectionItemResult,
  MediaKind,
  SuggestedRepairType,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
const mediaSelect = {
  id: true,
  garageId: true,
  inspectionId: true,
  inspectionItemId: true,
  kind: true,
  storageKey: true,
  contentType: true,
  byteSize: true,
  createdAt: true,
};

const itemSelect = {
  id: true,
  garageId: true,
  inspectionId: true,
  key: true,
  label: true,
  result: true,
  notes: true,
  quantity: true,
  unitPricePaise: true,
  externalCheck: true,
  sortOrder: true,
  isCustom: true,
  createdAt: true,
  updatedAt: true,
  media: {
    select: mediaSelect,
    orderBy: { createdAt: "asc" as const },
  },
};

const repairSelect = {
  id: true,
  garageId: true,
  inspectionId: true,
  type: true,
  description: true,
  quantity: true,
  unitPricePaise: true,
  partId: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
};

const customerSelect = {
  id: true,
  name: true,
  phone: true,
} as const;

const vehicleSelect = {
  id: true,
  registrationNumber: true,
  make: true,
  model: true,
} as const;

const serviceOrderSelect = {
  id: true,
  status: true,
  technicianId: true,
  technicianAssignments: {
    select: { technicianId: true },
  },
} as const;

const inspectionSelect = {
  id: true,
  garageId: true,
  customerId: true,
  vehicleId: true,
  serviceOrderId: true,
  notes: true,
  complaint: true,
  recommendedNotes: true,
  expectedCompletion: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: customerSelect },
  vehicle: { select: vehicleSelect },
  serviceOrder: { select: serviceOrderSelect },
  items: {
    select: itemSelect,
    orderBy: { sortOrder: "asc" as const },
  },
  suggestedRepairs: {
    select: repairSelect,
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
  },
};

const inspectionListSelect = {
  id: true,
  garageId: true,
  customerId: true,
  vehicleId: true,
  serviceOrderId: true,
  notes: true,
  complaint: true,
  recommendedNotes: true,
  expectedCompletion: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: customerSelect },
  vehicle: { select: vehicleSelect },
  serviceOrder: { select: serviceOrderSelect },
  estimates: {
    where: { supersededAt: null },
    take: 1,
    orderBy: { revisionNumber: "desc" as const },
    select: {
      askPermission: true,
      lines: {
        select: { approvalState: true },
      },
    },
  },
  _count: {
    select: {
      items: true,
    },
  },
};

export type InspectionListFilters = {
  q?: string;
  /** Customer approval summary on the current estimate. */
  approvalStatus?:
    | "NONE"
    | "NOT_REQUIRED"
    | "PENDING"
    | "PARTIAL"
    | "APPROVED"
    | "REJECTED";
  sort?:
    | "newest"
    | "oldest"
    | "registration_asc"
    | "registration_desc"
    | "customer_asc";
  customerId?: string;
  vehicleId?: string;
  page?: number;
  pageSize?: number;
};

function approvalStatusWhere(
  status: NonNullable<InspectionListFilters["approvalStatus"]>,
): Prisma.InspectionWhereInput {
  const current = { supersededAt: null };

  if (status === "NONE") {
    return {
      OR: [
        { estimates: { none: current } },
        {
          estimates: {
            some: {
              ...current,
              lines: { none: {} },
            },
          },
        },
      ],
    };
  }

  if (status === "NOT_REQUIRED") {
    return {
      estimates: {
        some: {
          ...current,
          askPermission: false,
          lines: { some: {} },
        },
      },
    };
  }

  if (status === "PENDING") {
    return {
      estimates: {
        some: {
          ...current,
          askPermission: true,
          lines: { some: { approvalState: "PENDING" } },
        },
      },
    };
  }

  if (status === "PARTIAL") {
    return {
      estimates: {
        some: {
          ...current,
          askPermission: true,
          AND: [
            { lines: { some: { approvalState: "APPROVED" } } },
            { lines: { some: { approvalState: "REJECTED" } } },
            { lines: { none: { approvalState: "PENDING" } } },
          ],
        },
      },
    };
  }

  if (status === "APPROVED") {
    return {
      estimates: {
        some: {
          ...current,
          askPermission: true,
          AND: [
            { lines: { some: { approvalState: "APPROVED" } } },
            { lines: { none: { approvalState: { not: "APPROVED" } } } },
          ],
        },
      },
    };
  }

  return {
    estimates: {
      some: {
        ...current,
        askPermission: true,
        AND: [
          { lines: { some: { approvalState: "REJECTED" } } },
          { lines: { none: { approvalState: { not: "REJECTED" } } } },
        ],
      },
    },
  };
}

function inspectionOrderBy(
  sort: InspectionListFilters["sort"],
): Prisma.InspectionOrderByWithRelationInput[] {
  if (sort === "oldest") {
    return [{ createdAt: "asc" }];
  }
  if (sort === "registration_asc") {
    return [
      { vehicle: { registrationNumber: "asc" } },
      { createdAt: "desc" },
    ];
  }
  if (sort === "registration_desc") {
    return [
      { vehicle: { registrationNumber: "desc" } },
      { createdAt: "desc" },
    ];
  }
  if (sort === "customer_asc") {
    return [{ customer: { name: "asc" } }, { createdAt: "desc" }];
  }
  return [{ createdAt: "desc" }];
}

function listWhere(
  garageId: string,
  filters: InspectionListFilters,
): Prisma.InspectionWhereInput {
  const where: Prisma.InspectionWhereInput = { garageId };
  if (filters.customerId) {
    where.customerId = filters.customerId;
  }
  if (filters.vehicleId) {
    where.vehicleId = filters.vehicleId;
  }

  const and: Prisma.InspectionWhereInput[] = [];
  const q = filters.q?.trim();
  if (q) {
    and.push({
      OR: [
        { customer: { name: { contains: q, mode: "insensitive" } } },
        { customer: { phone: { contains: q, mode: "insensitive" } } },
        {
          vehicle: {
            registrationNumber: { contains: q, mode: "insensitive" },
          },
        },
        { vehicle: { make: { contains: q, mode: "insensitive" } } },
        { vehicle: { model: { contains: q, mode: "insensitive" } } },
      ],
    });
  }
  if (filters.approvalStatus) {
    and.push(approvalStatusWhere(filters.approvalStatus));
  }
  if (and.length > 0) {
    where.AND = and;
  }
  return where;
}

export async function listInspections(
  garageId: string,
  filters: InspectionListFilters = {},
) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
  const where = listWhere(garageId, filters);

  const [total, items] = await Promise.all([
    prisma.inspection.count({ where }),
    prisma.inspection.findMany({
      where,
      select: inspectionListSelect,
      orderBy: inspectionOrderBy(filters.sort),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { items, total, page, pageSize };
}

export async function findInspectionByServiceOrderId(
  garageId: string,
  serviceOrderId: string,
) {
  return prisma.inspection.findFirst({
    where: { garageId, serviceOrderId },
    select: inspectionSelect,
  });
}

export async function findInspectionById(garageId: string, inspectionId: string) {
  return prisma.inspection.findFirst({
    where: { id: inspectionId, garageId },
    select: inspectionSelect,
  });
}

/** Deletes an inspection (linked or not). Job card stays; only the inspection row is removed. */
export async function deleteInspectionById(
  garageId: string,
  inspectionId: string,
  actorId: string,
): Promise<"ok" | "not_found"> {
  const existing = await prisma.inspection.findFirst({
    where: { id: inspectionId, garageId },
    select: { id: true, serviceOrderId: true, customerId: true, vehicleId: true },
  });
  if (!existing) {
    return "not_found";
  }

  await prisma.inspection.deleteMany({
    where: { id: inspectionId, garageId },
  });

  await writeAuditLog({
    garageId,
    actorId,
    action: "inspection.deleted",
    entity: "Inspection",
    entityId: inspectionId,
    meta: {
      customerId: existing.customerId,
      vehicleId: existing.vehicleId,
      serviceOrderId: existing.serviceOrderId,
    },
  });

  return "ok";
}

export async function findInspectionItemById(garageId: string, itemId: string) {
  return prisma.inspectionItem.findFirst({
    where: { id: itemId, garageId },
    select: {
      ...itemSelect,
      inspection: {
        select: {
          id: true,
          garageId: true,
          customerId: true,
          vehicleId: true,
          serviceOrderId: true,
          serviceOrder: { select: serviceOrderSelect },
        },
      },
    },
  });
}

type SaveInspectionItemData = {
  id: string | null;
  label: string;
  result: InspectionItemResult | null;
  notes: string | null;
  quantity: number;
  unitPricePaise: number;
  externalCheck: boolean;
};

/** Creates an inspection with no checklist items (owner adds spares as needed). */
export async function createInspectionWithDefaults(
  garageId: string,
  data: {
    customerId: string;
    vehicleId: string;
    serviceOrderId?: string | null;
    actorId: string;
  },
) {
  const created = await prisma.inspection.create({
    data: {
      garageId,
      customerId: data.customerId,
      vehicleId: data.vehicleId,
      serviceOrderId: data.serviceOrderId ?? null,
    },
    select: { id: true },
  });

  await writeAuditLog({
    garageId,
    actorId: data.actorId,
    action: "inspection.created",
    entity: "Inspection",
    entityId: created.id,
    meta: {
      customerId: data.customerId,
      vehicleId: data.vehicleId,
      serviceOrderId: data.serviceOrderId ?? null,
    },
  });

  return findInspectionById(garageId, created.id);
}

export async function createInspectionWithDetails(
  garageId: string,
  data: {
    customerId: string;
    vehicleId: string;
    complaint: string | null;
    recommendedNotes: string | null;
    expectedCompletion: Date | null;
    items: SaveInspectionItemData[];
    actorId: string;
  },
) {
  const created = await prisma.inspection.create({
    data: {
      garageId,
      customerId: data.customerId,
      vehicleId: data.vehicleId,
      complaint: data.complaint,
      recommendedNotes: data.recommendedNotes,
      expectedCompletion: data.expectedCompletion,
      items: {
        create: data.items.map((item, index) => ({
          garageId,
          key: `item_${Date.now().toString(36)}_${index}`,
          label: item.label,
          result: item.result,
          notes: item.notes,
          quantity: item.quantity,
          unitPricePaise: item.unitPricePaise,
          externalCheck: item.externalCheck,
          sortOrder: index,
          isCustom: true,
        })),
      },
    },
    select: { id: true },
  });

  await writeAuditLog({
    garageId,
    actorId: data.actorId,
    action: "inspection.created",
    entity: "Inspection",
    entityId: created.id,
    meta: {
      customerId: data.customerId,
      vehicleId: data.vehicleId,
      itemCount: data.items.length,
    },
  });

  return findInspectionById(garageId, created.id);
}

export async function saveInspectionDetails(
  garageId: string,
  inspectionId: string,
  data: {
    complaint: string | null;
    recommendedNotes: string | null;
    expectedCompletion: Date | null;
    items: SaveInspectionItemData[];
    actorId: string;
  },
) {
  const existing = await prisma.inspectionItem.findMany({
    where: { garageId, inspectionId },
    select: { id: true },
  });
  const keepIds = new Set(
    data.items.map((item) => item.id).filter((id): id is string => Boolean(id)),
  );
  const removeIds = existing
    .map((row) => row.id)
    .filter((id) => !keepIds.has(id));

  await prisma.$transaction(async (tx) => {
    await tx.inspection.updateMany({
      where: { id: inspectionId, garageId },
      data: {
        complaint: data.complaint,
        recommendedNotes: data.recommendedNotes,
        expectedCompletion: data.expectedCompletion,
      },
    });

    if (removeIds.length > 0) {
      await tx.inspectionItem.deleteMany({
        where: { garageId, inspectionId, id: { in: removeIds } },
      });
    }

    for (const [index, item] of data.items.entries()) {
      if (item.id) {
        await tx.inspectionItem.updateMany({
          where: { id: item.id, garageId, inspectionId },
          data: {
            label: item.label,
            result: item.result,
            notes: item.notes,
            quantity: item.quantity,
            unitPricePaise: item.unitPricePaise,
            externalCheck: item.externalCheck,
            sortOrder: index,
          },
        });
        continue;
      }
      await tx.inspectionItem.create({
        data: {
          garageId,
          inspectionId,
          key: `item_${Date.now().toString(36)}_${index}`,
          label: item.label,
          result: item.result,
          notes: item.notes,
          quantity: item.quantity,
          unitPricePaise: item.unitPricePaise,
          externalCheck: item.externalCheck,
          sortOrder: index,
          isCustom: true,
        },
      });
    }
  });

  await writeAuditLog({
    garageId,
    actorId: data.actorId,
    action: "inspection.saved",
    entity: "Inspection",
    entityId: inspectionId,
    meta: { itemCount: data.items.length },
  });

  return findInspectionById(garageId, inspectionId);
}

export async function updateInspectionNotesById(
  garageId: string,
  inspectionId: string,
  data: {
    complaint: string | null;
    recommendedNotes: string | null;
    actorId: string;
  },
) {
  const result = await prisma.inspection.updateMany({
    where: { id: inspectionId, garageId },
    data: {
      complaint: data.complaint,
      recommendedNotes: data.recommendedNotes,
    },
  });

  if (result.count === 0) {
    return null;
  }

  await writeAuditLog({
    garageId,
    actorId: data.actorId,
    action: "inspection.notes_updated",
    entity: "Inspection",
    entityId: inspectionId,
  });

  return findInspectionById(garageId, inspectionId);
}

export async function linkInspectionToServiceOrder(
  garageId: string,
  inspectionId: string,
  data: {
    serviceOrderId: string;
    actorId: string;
  },
) {
  const result = await prisma.inspection.updateMany({
    where: {
      id: inspectionId,
      garageId,
      serviceOrderId: null,
    },
    data: { serviceOrderId: data.serviceOrderId },
  });

  if (result.count === 0) {
    return null;
  }

  await writeAuditLog({
    garageId,
    actorId: data.actorId,
    action: "inspection.linked_order",
    entity: "Inspection",
    entityId: inspectionId,
    meta: { serviceOrderId: data.serviceOrderId },
  });

  return findInspectionById(garageId, inspectionId);
}

export async function updateInspectionItemById(
  garageId: string,
  itemId: string,
  data: {
    result: InspectionItemResult | null;
    notes: string | null;
    quantity?: number;
    unitPricePaise?: number;
    externalCheck?: boolean;
    label?: string;
    actorId: string;
    inspectionId: string;
    serviceOrderId: string | null;
  },
) {
  const result = await prisma.inspectionItem.updateMany({
    where: { id: itemId, garageId },
    data: {
      result: data.result,
      notes: data.notes,
      ...(data.quantity != null ? { quantity: data.quantity } : {}),
      ...(data.unitPricePaise != null
        ? { unitPricePaise: data.unitPricePaise }
        : {}),
      ...(data.externalCheck != null
        ? { externalCheck: data.externalCheck }
        : {}),
      ...(data.label != null ? { label: data.label } : {}),
    },
  });

  if (result.count === 0) {
    return null;
  }

  await writeAuditLog({
    garageId,
    actorId: data.actorId,
    action: "inspection.item_updated",
    entity: "InspectionItem",
    entityId: itemId,
    meta: {
      inspectionId: data.inspectionId,
      serviceOrderId: data.serviceOrderId,
      result: data.result,
      externalCheck: data.externalCheck ?? null,
    },
  });

  return findInspectionItemById(garageId, itemId);
}

export async function addCustomChecklistItem(
  garageId: string,
  data: {
    inspectionId: string;
    serviceOrderId: string | null;
    label: string;
    actorId: string;
  },
) {
  const maxSort = await prisma.inspectionItem.aggregate({
    where: { garageId, inspectionId: data.inspectionId },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;
  const key = `custom_${Date.now().toString(36)}_${sortOrder}`;

  const item = await prisma.inspectionItem.create({
    data: {
      garageId,
      inspectionId: data.inspectionId,
      key,
      label: data.label,
      sortOrder,
      isCustom: true,
    },
    select: itemSelect,
  });

  await writeAuditLog({
    garageId,
    actorId: data.actorId,
    action: "inspection.item_added",
    entity: "InspectionItem",
    entityId: item.id,
    meta: {
      inspectionId: data.inspectionId,
      serviceOrderId: data.serviceOrderId,
      label: data.label,
    },
  });

  return item;
}

export async function createMediaRecord(
  garageId: string,
  data: {
    inspectionId: string;
    inspectionItemId: string;
    serviceOrderId: string | null;
    kind: MediaKind;
    storageKey: string;
    contentType: string;
    byteSize: number;
    actorId: string;
  },
) {
  const media = await prisma.media.create({
    data: {
      garageId,
      inspectionId: data.inspectionId,
      inspectionItemId: data.inspectionItemId,
      kind: data.kind,
      storageKey: data.storageKey,
      contentType: data.contentType,
      byteSize: data.byteSize,
    },
    select: mediaSelect,
  });

  await writeAuditLog({
    garageId,
    actorId: data.actorId,
    action: "inspection.media_added",
    entity: "Media",
    entityId: media.id,
    meta: {
      inspectionId: data.inspectionId,
      serviceOrderId: data.serviceOrderId,
      kind: data.kind,
      inspectionItemId: data.inspectionItemId,
    },
  });

  return media;
}

export async function findMediaById(garageId: string, mediaId: string) {
  return prisma.media.findFirst({
    where: { id: mediaId, garageId },
    select: {
      ...mediaSelect,
      inspection: {
        select: {
          id: true,
          serviceOrderId: true,
          serviceOrder: { select: serviceOrderSelect },
        },
      },
    },
  });
}

export async function findSuggestedRepairById(
  garageId: string,
  repairId: string,
) {
  return prisma.suggestedRepair.findFirst({
    where: { id: repairId, garageId },
    select: {
      ...repairSelect,
      inspection: {
        select: {
          id: true,
          serviceOrderId: true,
          serviceOrder: { select: serviceOrderSelect },
        },
      },
    },
  });
}

export async function deleteMediaById(
  garageId: string,
  mediaId: string,
  data: {
    actorId: string;
    inspectionId: string;
    serviceOrderId: string | null;
  },
) {
  const existing = await findMediaById(garageId, mediaId);
  if (!existing) {
    return null;
  }

  await prisma.media.deleteMany({
    where: { id: mediaId, garageId },
  });

  await writeAuditLog({
    garageId,
    actorId: data.actorId,
    action: "inspection.media_removed",
    entity: "Media",
    entityId: mediaId,
    meta: {
      inspectionId: data.inspectionId,
      serviceOrderId: data.serviceOrderId,
      storageKey: existing.storageKey,
    },
  });

  return existing;
}

export async function createSuggestedRepair(
  garageId: string,
  data: {
    inspectionId: string;
    serviceOrderId: string | null;
    type: SuggestedRepairType;
    description: string;
    quantity: number;
    unitPricePaise: number;
    partId: string | null;
    actorId: string;
  },
) {
  const maxSort = await prisma.suggestedRepair.aggregate({
    where: { garageId, inspectionId: data.inspectionId },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;

  const repair = await prisma.suggestedRepair.create({
    data: {
      garageId,
      inspectionId: data.inspectionId,
      type: data.type,
      description: data.description,
      quantity: data.quantity,
      unitPricePaise: data.unitPricePaise,
      partId: data.type === "PART" ? data.partId : null,
      sortOrder,
    },
    select: repairSelect,
  });

  await writeAuditLog({
    garageId,
    actorId: data.actorId,
    action: "inspection.suggested_repair_added",
    entity: "SuggestedRepair",
    entityId: repair.id,
    meta: {
      inspectionId: data.inspectionId,
      serviceOrderId: data.serviceOrderId,
      type: data.type,
      description: data.description,
      partId: data.partId,
      unitPricePaise: data.unitPricePaise,
    },
  });

  return repair;
}

export async function deleteSuggestedRepairById(
  garageId: string,
  repairId: string,
  data: {
    actorId: string;
    inspectionId: string;
    serviceOrderId: string | null;
  },
) {
  const existing = await prisma.suggestedRepair.findFirst({
    where: { id: repairId, garageId },
    select: repairSelect,
  });
  if (!existing) {
    return null;
  }

  await prisma.suggestedRepair.deleteMany({
    where: { id: repairId, garageId },
  });

  await writeAuditLog({
    garageId,
    actorId: data.actorId,
    action: "inspection.suggested_repair_removed",
    entity: "SuggestedRepair",
    entityId: repairId,
    meta: {
      inspectionId: data.inspectionId,
      serviceOrderId: data.serviceOrderId,
      description: existing.description,
    },
  });

  return existing;
}
