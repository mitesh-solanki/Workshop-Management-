-- Purchase orders: optional vendor, OPEN / CANCELLED statuses.

CREATE TYPE "PurchaseOrderStatus_new" AS ENUM (
  'OPEN',
  'PENDING',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CANCELLED'
);

ALTER TABLE "PurchaseOrder" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "PurchaseOrder"
  ALTER COLUMN "status" TYPE "PurchaseOrderStatus_new"
  USING ("status"::text::"PurchaseOrderStatus_new");

ALTER TABLE "PurchaseOrder"
  ALTER COLUMN "status" SET DEFAULT 'OPEN'::"PurchaseOrderStatus_new";

DROP TYPE "PurchaseOrderStatus";

ALTER TYPE "PurchaseOrderStatus_new" RENAME TO "PurchaseOrderStatus";

ALTER TABLE "PurchaseOrder" ALTER COLUMN "vendorId" DROP NOT NULL;
