import type { CsvColumn } from "@/lib/csv";
import { paiseToRupeesInput } from "@/lib/money";

function formatDate(value: Date | null | undefined): string {
  if (!value || Number.isNaN(value.getTime())) {
    return "";
  }
  return value.toISOString().slice(0, 10);
}

export type CustomerExportRow = {
  name: string;
  phone: string;
  address: string | null;
  notes: string | null;
};

export const customerExportColumns: CsvColumn<CustomerExportRow>[] = [
  { header: "name", value: (r) => r.name },
  { header: "phone", value: (r) => r.phone },
  { header: "address", value: (r) => r.address },
  { header: "notes", value: (r) => r.notes },
];

export type VehicleExportRow = {
  customerPhone: string;
  customerName: string;
  registrationNumber: string;
  make: string;
  model: string;
  year: number | null;
  odometer: number | null;
  insuranceExpiry: Date | null;
  pucExpiry: Date | null;
  fitnessExpiry: Date | null;
};

export const vehicleExportColumns: CsvColumn<VehicleExportRow>[] = [
  { header: "customerPhone", value: (r) => r.customerPhone },
  { header: "customerName", value: (r) => r.customerName },
  { header: "registrationNumber", value: (r) => r.registrationNumber },
  { header: "make", value: (r) => r.make },
  { header: "model", value: (r) => r.model },
  { header: "year", value: (r) => r.year },
  { header: "odometer", value: (r) => r.odometer },
  { header: "insuranceExpiry", value: (r) => formatDate(r.insuranceExpiry) },
  { header: "pucExpiry", value: (r) => formatDate(r.pucExpiry) },
  { header: "fitnessExpiry", value: (r) => formatDate(r.fitnessExpiry) },
];

export type PartExportRow = {
  name: string;
  sku: string;
  unit: string;
  purchasePricePaise: number;
  sellingPricePaise: number;
  gstRatePercent: number;
  hsn: string;
  lowStockLevel: number;
  quantityOnHand: number;
};

export const partExportColumns: CsvColumn<PartExportRow>[] = [
  { header: "name", value: (r) => r.name },
  { header: "sku", value: (r) => r.sku },
  { header: "unit", value: (r) => r.unit },
  {
    header: "purchasePrice",
    value: (r) => paiseToRupeesInput(r.purchasePricePaise),
  },
  {
    header: "sellingPrice",
    value: (r) => paiseToRupeesInput(r.sellingPricePaise),
  },
  { header: "gstRatePercent", value: (r) => r.gstRatePercent },
  { header: "hsn", value: (r) => r.hsn },
  { header: "lowStockLevel", value: (r) => r.lowStockLevel },
  { header: "openingStock", value: (r) => r.quantityOnHand },
];
