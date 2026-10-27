import "server-only";

import { prisma } from "@/lib/db";
import { GLOBAL_SEARCH_PER_TYPE } from "@/modules/global-search/schema";

const take = GLOBAL_SEARCH_PER_TYPE;

function textContains(query: string) {
  return { contains: query, mode: "insensitive" as const };
}

function registrationNeedle(query: string) {
  return query.replace(/\s+/g, "").toUpperCase();
}

export async function searchCustomersForGlobal(
  garageId: string,
  query: string,
) {
  return prisma.customer.findMany({
    where: {
      garageId,
      OR: [
        { name: textContains(query) },
        { phone: { contains: query } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take,
    select: { id: true, name: true, phone: true },
  });
}

export async function searchVehiclesForGlobal(
  garageId: string,
  query: string,
) {
  const regQuery = registrationNeedle(query);
  return prisma.vehicle.findMany({
    where: {
      garageId,
      OR: [
        {
          registrationNumber: {
            contains: regQuery,
            mode: "insensitive",
          },
        },
        { make: textContains(query) },
        { model: textContains(query) },
        {
          customer: {
            OR: [
              { name: textContains(query) },
              { phone: { contains: query } },
            ],
          },
        },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take,
    select: {
      id: true,
      registrationNumber: true,
      make: true,
      model: true,
      customer: { select: { name: true, phone: true } },
    },
  });
}

export async function searchOrdersForGlobal(
  garageId: string,
  query: string,
  options: { technicianId?: string } = {},
) {
  const regQuery = registrationNeedle(query);
  return prisma.serviceOrder.findMany({
    where: {
      garageId,
      ...(options.technicianId
        ? { technicianId: options.technicianId }
        : {}),
      OR: [
        { complaint: textContains(query) },
        {
          customer: {
            OR: [
              { name: textContains(query) },
              { phone: { contains: query } },
            ],
          },
        },
        {
          vehicle: {
            OR: [
              {
                registrationNumber: {
                  contains: regQuery,
                  mode: "insensitive",
                },
              },
              { make: textContains(query) },
              { model: textContains(query) },
            ],
          },
        },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take,
    select: {
      id: true,
      complaint: true,
      status: true,
      customer: { select: { name: true, phone: true } },
      vehicle: {
        select: { registrationNumber: true, make: true, model: true },
      },
    },
  });
}

export async function searchPartsForGlobal(garageId: string, query: string) {
  return prisma.part.findMany({
    where: {
      garageId,
      OR: [
        { name: textContains(query) },
        { sku: textContains(query) },
        { hsn: textContains(query) },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take,
    select: { id: true, name: true, sku: true, hsn: true },
  });
}

export async function searchVendorsForGlobal(garageId: string, query: string) {
  return prisma.vendor.findMany({
    where: {
      garageId,
      OR: [
        { name: textContains(query) },
        { phone: { contains: query, mode: "insensitive" } },
        { gstin: textContains(query) },
        { email: textContains(query) },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take,
    select: {
      id: true,
      name: true,
      phone: true,
      gstin: true,
      email: true,
    },
  });
}

export async function searchInvoicesForGlobal(
  garageId: string,
  query: string,
) {
  const regQuery = registrationNeedle(query);
  return prisma.invoice.findMany({
    where: {
      garageId,
      OR: [
        { invoiceNumber: textContains(query) },
        { customer: { name: textContains(query) } },
        { customer: { phone: { contains: query } } },
        {
          serviceOrder: {
            vehicle: {
              registrationNumber: {
                contains: regQuery,
                mode: "insensitive",
              },
            },
          },
        },
      ],
    },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      invoiceNumber: true,
      serviceOrderId: true,
      customer: { select: { name: true, phone: true } },
      serviceOrder: {
        select: {
          vehicle: { select: { registrationNumber: true } },
        },
      },
    },
  });
}
