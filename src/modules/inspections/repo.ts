import "server-only";

import type {
  InspectionItemResult,
  MediaKind,
  SuggestedRepairType,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { DEFAULT_CHECKLIST_ITEMS } from "@/modules/inspections/schema";

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
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
};

const inspectionSelect = {
  id: true,
  garageId: true,
  serviceOrderId: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  items: {
    select: itemSelect,
    orderBy: { sortOrder: "asc" as const },
  },
  suggestedRepairs: {
    select: repairSelect,
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
  },
};

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

export async function findInspectionItemById(garageId: string, itemId: string) {
  return prisma.inspectionItem.findFirst({
    where: { id: itemId, garageId },
    select: {
      ...itemSelect,
      inspection: {
        select: {
          id: true,
          garageId: true,
          serviceOrderId: true,
        },
      },
    },
  });
}

export async function createInspectionWithDefaults(
  garageId: string,
  data: {
    serviceOrderId: string;
    actorId: string;
  },
) {
  const created = await prisma.inspection.create({
    data: {
      garageId,
      serviceOrderId: data.serviceOrderId,
      items: {
        create: DEFAULT_CHECKLIST_ITEMS.map((item, index) => ({
          garageId,
          key: item.key,
          label: item.label,
          sortOrder: index,
          isCustom: false,
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
    meta: { serviceOrderId: data.serviceOrderId },
  });

  return findInspectionById(garageId, created.id);
}

export async function updateInspectionItemById(
  garageId: string,
  itemId: string,
  data: {
    result: InspectionItemResult | null;
    notes: string | null;
    actorId: string;
    serviceOrderId: string;
  },
) {
  const result = await prisma.inspectionItem.updateMany({
    where: { id: itemId, garageId },
    data: {
      result: data.result,
      notes: data.notes,
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
      serviceOrderId: data.serviceOrderId,
      result: data.result,
    },
  });

  return findInspectionItemById(garageId, itemId);
}

export async function addCustomChecklistItem(
  garageId: string,
  data: {
    inspectionId: string;
    serviceOrderId: string;
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
    serviceOrderId: string;
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
        select: { id: true, serviceOrderId: true },
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
        select: { id: true, serviceOrderId: true },
      },
    },
  });
}

export async function deleteMediaById(
  garageId: string,
  mediaId: string,
  data: { actorId: string; serviceOrderId: string },
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
    serviceOrderId: string;
    type: SuggestedRepairType;
    description: string;
    quantity: number;
    unitPricePaise: number;
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
      serviceOrderId: data.serviceOrderId,
      type: data.type,
      description: data.description,
      unitPricePaise: data.unitPricePaise,
    },
  });

  return repair;
}

export async function deleteSuggestedRepairById(
  garageId: string,
  repairId: string,
  data: { actorId: string; serviceOrderId: string },
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
      serviceOrderId: data.serviceOrderId,
      description: existing.description,
    },
  });

  return existing;
}
