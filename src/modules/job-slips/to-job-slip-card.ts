import type { JobSlipCardData } from "@/modules/job-slips/components/job-slip-card";
import type { ServiceOrderStatusValue } from "@/modules/service-orders/schema";

export type JobSlipOrderSource = {
  id: string;
  status: string;
  complaint: string;
  bay: string | null;
  odometerIn: number | null;
  createdAt: Date | string;
  expectedCompletion: Date | string | null;
  vehicle: {
    registrationNumber: string;
    make: string;
    model: string;
  };
  customer: {
    name: string;
    phone: string;
    address: string | null;
  };
  technician: { id: string; name: string | null; email: string } | null;
  technicianAssignments: Array<{
    technicianId: string;
    technician: { id: string; name: string | null; email: string };
  }>;
  lines: Array<{
    id: string;
    type: "LABOUR" | "PART" | string;
    description: string;
    quantity: number;
    unitPricePaise: number;
    partId?: string | null;
    part?: { sellingPricePaise: number } | null;
  }>;
};

function asIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  return value.toISOString();
}

export function orderNeedsPricing(order: JobSlipOrderSource): boolean {
  if (order.status === "COMPLETED") return false;
  return order.lines.some(
    (line) =>
      line.type === "PART" &&
      line.unitPricePaise === 0 &&
      Boolean(line.partId) &&
      (line.part?.sellingPricePaise ?? 0) <= 0,
  );
}

export function toJobSlipCardData(
  order: JobSlipOrderSource,
  garage: { name: string; address: string | null },
): JobSlipCardData {
  return {
    id: order.id,
    status: order.status as ServiceOrderStatusValue,
    needsPricing: orderNeedsPricing(order),
    complaint: order.complaint,
    bay: order.bay,
    odometerIn: order.odometerIn,
    createdAt: asIso(order.createdAt) ?? new Date(0).toISOString(),
    expectedCompletion: asIso(order.expectedCompletion),
    vehicle: {
      registrationNumber: order.vehicle.registrationNumber,
      make: order.vehicle.make,
      model: order.vehicle.model,
    },
    customer: {
      name: order.customer.name,
      phone: order.customer.phone,
      address: order.customer.address,
    },
    technician: order.technician,
    technicianAssignments: order.technicianAssignments,
    lines: order.lines
      .filter((line) => line.type === "LABOUR" || line.type === "PART")
      .map((line) => ({
        id: line.id,
        type: line.type === "PART" ? ("PART" as const) : ("LABOUR" as const),
        description: line.description,
        quantity: line.quantity,
        unitPricePaise: line.unitPricePaise,
      })),
    outsideLines: order.lines
      .filter((line) => line.type === "OUTSIDE")
      .map((line) => ({
        id: line.id,
        description: line.description,
        quantity: 1,
        unitPricePaise: line.unitPricePaise,
      })),
    garage: {
      name: garage.name,
      address: garage.address,
    },
  };
}
