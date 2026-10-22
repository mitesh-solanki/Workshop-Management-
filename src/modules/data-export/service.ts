import "server-only";

import { rowsToCsvDownloadResponse } from "@/lib/csv";
import { NotFoundError } from "@/lib/errors";
import type { RoleSession } from "@/lib/rbac";
import { findCustomerById } from "@/modules/customers/repo";
import { listCustomers } from "@/modules/customers/service";
import {
  customerExportColumns,
  partExportColumns,
  vehicleExportColumns,
} from "@/modules/data-export/columns";
import { listParts } from "@/modules/inventory/service";
import { listVehiclesByCustomerId } from "@/modules/vehicles/repo";

/** CSV download of customers for the signed-in garage (respects optional search `q`). */
export async function exportCustomersCsv(
  session: RoleSession,
  options: { q?: string } = {},
) {
  const customers = await listCustomers(session, { q: options.q });
  return rowsToCsvDownloadResponse(
    customerExportColumns,
    customers.map((c) => ({
      name: c.name,
      phone: c.phone,
      address: c.address,
      notes: c.notes,
    })),
    { filename: "customers.csv" },
  );
}

/** CSV download of vehicles for one customer in the signed-in garage. */
export async function exportCustomerVehiclesCsv(
  session: RoleSession,
  customerId: string,
) {
  const customer = await findCustomerById(session.garageId, customerId);
  if (!customer) {
    throw new NotFoundError();
  }

  const vehicles = await listVehiclesByCustomerId(
    session.garageId,
    customerId,
  );

  return rowsToCsvDownloadResponse(
    vehicleExportColumns,
    vehicles.map((v) => ({
      customerPhone: customer.phone,
      customerName: customer.name,
      registrationNumber: v.registrationNumber,
      make: v.make,
      model: v.model,
      year: v.year,
      odometer: v.odometer,
      insuranceExpiry: v.insuranceExpiry,
      pucExpiry: v.pucExpiry,
      fitnessExpiry: v.fitnessExpiry,
    })),
    { filename: `vehicles-${customer.phone}.csv` },
  );
}

/** CSV download of parts for the signed-in garage (respects optional search `q`). */
export async function exportPartsCsv(
  session: RoleSession,
  options: { q?: string } = {},
) {
  const parts = await listParts(session, { q: options.q });
  return rowsToCsvDownloadResponse(
    partExportColumns,
    parts.map((p) => ({
      name: p.name,
      sku: p.sku,
      unit: p.unit,
      purchasePricePaise: p.purchasePricePaise,
      sellingPricePaise: p.sellingPricePaise,
      gstRatePercent: p.gstRatePercent,
      hsn: p.hsn,
      lowStockLevel: p.lowStockLevel,
      quantityOnHand: p.quantityOnHand,
    })),
    { filename: "parts.csv" },
  );
}
