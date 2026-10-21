import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const vehicleSelect = {
  id: true,
  garageId: true,
  customerId: true,
  registrationNumber: true,
  make: true,
  model: true,
  year: true,
  odometer: true,
  insuranceExpiry: true,
  pucExpiry: true,
  fitnessExpiry: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function findVehicleById(garageId: string, vehicleId: string) {
  return prisma.vehicle.findFirst({
    where: { id: vehicleId, garageId },
    select: {
      ...vehicleSelect,
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
        },
      },
    },
  });
}

export async function findVehicleByRegistration(
  garageId: string,
  registrationNumber: string,
) {
  return prisma.vehicle.findFirst({
    where: { garageId, registrationNumber },
    select: vehicleSelect,
  });
}

export async function createVehicle(
  garageId: string,
  data: {
    customerId: string;
    registrationNumber: string;
    make: string;
    model: string;
    year: number | null;
    odometer: number | null;
    insuranceExpiry: Date | null;
    pucExpiry: Date | null;
    fitnessExpiry: Date | null;
  },
) {
  return prisma.vehicle.create({
    data: {
      garageId,
      customerId: data.customerId,
      registrationNumber: data.registrationNumber,
      make: data.make,
      model: data.model,
      year: data.year,
      odometer: data.odometer,
      insuranceExpiry: data.insuranceExpiry,
      pucExpiry: data.pucExpiry,
      fitnessExpiry: data.fitnessExpiry,
    },
    select: vehicleSelect,
  });
}

export async function updateVehicleById(
  garageId: string,
  vehicleId: string,
  data: {
    registrationNumber: string;
    make: string;
    model: string;
    year: number | null;
    odometer: number | null;
    insuranceExpiry: Date | null;
    pucExpiry: Date | null;
    fitnessExpiry: Date | null;
  },
) {
  try {
    const result = await prisma.vehicle.updateMany({
      where: { id: vehicleId, garageId },
      data: {
        registrationNumber: data.registrationNumber,
        make: data.make,
        model: data.model,
        year: data.year,
        odometer: data.odometer,
        insuranceExpiry: data.insuranceExpiry,
        pucExpiry: data.pucExpiry,
        fitnessExpiry: data.fitnessExpiry,
      },
    });

    if (result.count === 0) {
      return null;
    }

    return findVehicleById(garageId, vehicleId);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw error;
    }
    throw error;
  }
}

export function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
