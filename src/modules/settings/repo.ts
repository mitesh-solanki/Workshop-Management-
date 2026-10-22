import "server-only";

import { prisma } from "@/lib/db";

export async function findGarageById(garageId: string) {
  return prisma.garage.findFirst({
    where: { id: garageId },
    select: {
      id: true,
      name: true,
      address: true,
      gstin: true,
      allowNegativeStock: true,
      updatedAt: true,
    },
  });
}

export async function updateGarageById(
  garageId: string,
  data: {
    name: string;
    address: string | null;
    gstin: string | null;
    allowNegativeStock: boolean;
  },
) {
  const result = await prisma.garage.updateMany({
    where: { id: garageId },
    data: {
      name: data.name,
      address: data.address,
      gstin: data.gstin,
      allowNegativeStock: data.allowNegativeStock,
    },
  });

  if (result.count === 0) {
    return null;
  }

  return findGarageById(garageId);
}
