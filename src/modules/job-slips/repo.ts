import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assignedTechnicianWhere } from "@/modules/service-orders/repo";

const jobSlipSelect = {
  id: true,
  status: true,
  complaint: true,
  bay: true,
  createdAt: true,
  expectedCompletion: true,
  technicianId: true,
  vehicle: {
    select: {
      registrationNumber: true,
      make: true,
      model: true,
    },
  },
  customer: {
    select: {
      name: true,
      phone: true,
    },
  },
  technician: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  technicianAssignments: {
    select: {
      technicianId: true,
      technician: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
  lines: {
    select: {
      id: true,
      type: true,
      description: true,
      quantity: true,
      unitPricePaise: true,
      partId: true,
      part: {
        select: {
          sellingPricePaise: true,
        },
      },
      sortOrder: true,
    },
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
    take: 20,
  },
} satisfies Prisma.ServiceOrderSelect;

export async function listJobSlipOrders(
  garageId: string,
  options: { technicianId?: string } = {},
) {
  return prisma.serviceOrder.findMany({
    where: {
      garageId,
      ...(options.technicianId
        ? { AND: [assignedTechnicianWhere(options.technicianId)] }
        : {}),
    },
    select: jobSlipSelect,
    orderBy: [{ createdAt: "desc" }],
    take: 200,
  });
}
