import type { ImportEntity } from "@/modules/data-import/schema";

export type ImportFieldDef = {
  key: string;
  /** Required for a valid mapped row. */
  required: boolean;
  /** Header aliases used for auto-mapping (English + common variants). */
  aliases: readonly string[];
};

export const CUSTOMER_IMPORT_FIELDS: readonly ImportFieldDef[] = [
  { key: "name", required: true, aliases: ["name", "customer", "customername", "fullname"] },
  { key: "phone", required: true, aliases: ["phone", "mobile", "phonenumber", "contact", "मोबाइल"] },
  { key: "address", required: false, aliases: ["address", "addr"] },
  { key: "notes", required: false, aliases: ["notes", "note", "remark", "remarks"] },
];

export const VEHICLE_IMPORT_FIELDS: readonly ImportFieldDef[] = [
  {
    key: "customerName",
    required: false,
    aliases: [
      "customername",
      "customer",
      "owner",
      "ownername",
      "name",
      "fullname",
    ],
  },
  {
    key: "customerPhone",
    required: true,
    aliases: [
      "customerphone",
      "phone",
      "mobile",
      "phonenumber",
      "ownerphone",
      "customer mobile",
      "contact",
    ],
  },
  {
    key: "customerAddress",
    required: false,
    aliases: ["customeraddress", "address", "addr", "owneraddress"],
  },
  {
    key: "registrationNumber",
    required: true,
    aliases: [
      "registration",
      "registrationnumber",
      "reg",
      "regno",
      "vehiclenumber",
      "numberplate",
    ],
  },
  { key: "make", required: true, aliases: ["make", "brand", "manufacturer"] },
  { key: "model", required: true, aliases: ["model"] },
  { key: "year", required: false, aliases: ["year", "modelyear"] },
  { key: "odometer", required: false, aliases: ["odometer", "odo", "km", "mileage"] },
  {
    key: "insuranceExpiry",
    required: false,
    aliases: ["insuranceexpiry", "insurance", "insurance date"],
  },
  { key: "pucExpiry", required: false, aliases: ["pucexpiry", "puc", "puc date"] },
  {
    key: "fitnessExpiry",
    required: false,
    aliases: ["fitnessexpiry", "fitness", "fitness date"],
  },
];

export const PART_IMPORT_FIELDS: readonly ImportFieldDef[] = [
  { key: "name", required: true, aliases: ["name", "part", "partname", "description"] },
  { key: "sku", required: true, aliases: ["sku", "code", "partnumber", "partno"] },
  { key: "unit", required: true, aliases: ["unit", "uom"] },
  {
    key: "purchasePrice",
    required: true,
    aliases: ["purchaseprice", "cost", "buyprice", "purchase"],
  },
  {
    key: "sellingPrice",
    required: true,
    aliases: ["sellingprice", "price", "sellprice", "mrp", "saleprice"],
  },
  { key: "gstRatePercent", required: true, aliases: ["gst", "gstrate", "gstratepercent", "tax"] },
  { key: "hsn", required: true, aliases: ["hsn", "hsncode", "sac"] },
  {
    key: "lowStockLevel",
    required: true,
    aliases: ["lowstock", "lowstocklevel", "reorder", "minstock"],
  },
  {
    key: "openingStock",
    required: false,
    aliases: ["openingstock", "stock", "qty", "quantity", "onhand"],
  },
];

export function fieldsForEntity(entity: ImportEntity): readonly ImportFieldDef[] {
  switch (entity) {
    case "customers":
      return CUSTOMER_IMPORT_FIELDS;
    case "vehicles":
      return VEHICLE_IMPORT_FIELDS;
    case "parts":
      return PART_IMPORT_FIELDS;
  }
}
