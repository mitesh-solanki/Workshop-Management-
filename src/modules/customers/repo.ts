import "server-only";

import { prisma } from "@/lib/db";

const customerSelect = {
  id: true,
  garageId: true,
  name: true,
  phone: true,
  address: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const;

const vehicleSummarySelect = {
  id: true,
  registrationNumber: true,
  make: true,
  model: true,
  year: true,
  odometer: true,
} as const;

export async function createCustomer(
  garageId: string,
  data: {
    name: string;
    phone: string;
    address: string | null;
    notes: string | null;
  },
) {
  return prisma.customer.create({
    data: {
      garageId,
      name: data.name,
      phone: data.phone,
      address: data.address,
      notes: data.notes,
    },
    select: customerSelect,
  });
}

export async function updateCustomerById(
  garageId: string,
  customerId: string,
  data: {
    name: string;
    phone: string;
    address: string | null;
    notes: string | null;
  },
) {
  const result = await prisma.customer.updateMany({
    where: { id: customerId, garageId },
    data: {
      name: data.name,
      phone: data.phone,
      address: data.address,
      notes: data.notes,
    },
  });

  if (result.count === 0) {
    return null;
  }

  return findCustomerById(garageId, customerId);
}

export async function findCustomerById(garageId: string, customerId: string) {
  return prisma.customer.findFirst({
    where: { id: customerId, garageId },
    select: {
      ...customerSelect,
      vehicles: {
        select: {
          ...vehicleSummarySelect,
          insuranceExpiry: true,
          pucExpiry: true,
          fitnessExpiry: true,
        },
        orderBy: { registrationNumber: "asc" },
      },
    },
  });
}

export async function searchCustomers(
  garageId: string,
  q: string | undefined,
) {
  const query = q?.trim();

  return prisma.customer.findMany({
    where: {
      garageId,
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { phone: { contains: query } },
              {
                vehicles: {
                  some: {
                    registrationNumber: {
                      contains: query.replace(/\s+/g, "").toUpperCase(),
                      mode: "insensitive",
                    },
                  },
                },
              },
            ],
          }
        : {}),
    },
    select: {
      ...customerSelect,
      vehicles: {
        select: vehicleSummarySelect,
        orderBy: { registrationNumber: "asc" },
      },
    },
    orderBy: [{ name: "asc" }, { createdAt: "desc" }],
    take: 100,
  });
}
