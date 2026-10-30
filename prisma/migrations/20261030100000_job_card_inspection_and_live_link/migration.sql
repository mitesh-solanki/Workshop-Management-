-- All inspection / job-card / live-link schema changes (one migration).

-- Standalone inspections: customer + vehicle required; job card optional.
ALTER TABLE "Inspection" ADD COLUMN "customerId" TEXT;
ALTER TABLE "Inspection" ADD COLUMN "vehicleId" TEXT;

UPDATE "Inspection" AS i
SET
  "customerId" = so."customerId",
  "vehicleId" = so."vehicleId"
FROM "ServiceOrder" AS so
WHERE so."id" = i."serviceOrderId";

DELETE FROM "Inspection" WHERE "customerId" IS NULL OR "vehicleId" IS NULL;

ALTER TABLE "Inspection" ALTER COLUMN "customerId" SET NOT NULL;
ALTER TABLE "Inspection" ALTER COLUMN "vehicleId" SET NOT NULL;

ALTER TABLE "Inspection" ALTER COLUMN "serviceOrderId" DROP NOT NULL;

ALTER TABLE "Inspection" DROP CONSTRAINT IF EXISTS "Inspection_serviceOrderId_fkey";

ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_serviceOrderId_fkey"
  FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Inspection_garageId_customerId_idx" ON "Inspection"("garageId", "customerId");
CREATE INDEX "Inspection_garageId_vehicleId_idx" ON "Inspection"("garageId", "vehicleId");
CREATE INDEX "Inspection_garageId_createdAt_idx" ON "Inspection"("garageId", "createdAt");

-- Inspection info fields on findings.
ALTER TABLE "Inspection" ADD COLUMN IF NOT EXISTS "complaint" TEXT;
ALTER TABLE "Inspection" ADD COLUMN IF NOT EXISTS "recommendedNotes" TEXT;

ALTER TABLE "InspectionItem" ADD COLUMN IF NOT EXISTS "quantity" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "InspectionItem" ADD COLUMN IF NOT EXISTS "unitPricePaise" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "InspectionItem" ADD COLUMN IF NOT EXISTS "externalCheck" BOOLEAN NOT NULL DEFAULT false;

-- Multi-technician assignments on job cards.
CREATE TABLE "ServiceOrderTechnicianAssignment" (
    "id" TEXT NOT NULL,
    "garageId" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceOrderTechnicianAssignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ServiceOrderTechnicianAssignment_garageId_technicianId_idx" ON "ServiceOrderTechnicianAssignment"("garageId", "technicianId");
CREATE INDEX "ServiceOrderTechnicianAssignment_serviceOrderId_idx" ON "ServiceOrderTechnicianAssignment"("serviceOrderId");
CREATE UNIQUE INDEX "ServiceOrderTechnicianAssignment_serviceOrderId_technicianId_key" ON "ServiceOrderTechnicianAssignment"("serviceOrderId", "technicianId");

ALTER TABLE "ServiceOrderTechnicianAssignment" ADD CONSTRAINT "ServiceOrderTechnicianAssignment_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "Garage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceOrderTechnicianAssignment" ADD CONSTRAINT "ServiceOrderTechnicianAssignment_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceOrderTechnicianAssignment" ADD CONSTRAINT "ServiceOrderTechnicianAssignment_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ServiceOrderTechnicianAssignment" ("id", "garageId", "serviceOrderId", "technicianId", "createdAt")
SELECT concat('migrated_', "id"), "garageId", "id", "technicianId", CURRENT_TIMESTAMP
FROM "ServiceOrder"
WHERE "technicianId" IS NOT NULL;

-- Inspection estimates (Estimate may hang off a job card OR an inspection).
ALTER TABLE "Estimate" ALTER COLUMN "serviceOrderId" DROP NOT NULL;
ALTER TABLE "Estimate" ADD COLUMN "inspectionId" TEXT;

DROP INDEX IF EXISTS "Estimate_serviceOrderId_revisionNumber_key";

CREATE INDEX "Estimate_inspectionId_idx" ON "Estimate"("inspectionId");
CREATE INDEX "Estimate_garageId_inspectionId_supersededAt_idx" ON "Estimate"("garageId", "inspectionId", "supersededAt");

CREATE UNIQUE INDEX "Estimate_serviceOrderId_revisionNumber_key" ON "Estimate"("serviceOrderId", "revisionNumber") WHERE "serviceOrderId" IS NOT NULL;
CREATE UNIQUE INDEX "Estimate_inspectionId_revisionNumber_key" ON "Estimate"("inspectionId", "revisionNumber") WHERE "inspectionId" IS NOT NULL;

ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_parent_xor_check" CHECK (
  ("serviceOrderId" IS NOT NULL AND "inspectionId" IS NULL)
  OR ("serviceOrderId" IS NULL AND "inspectionId" IS NOT NULL)
);

ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Inspection" ADD COLUMN "expectedCompletion" TIMESTAMP(3);

-- Live Link can target a job card OR an inspection estimate.
ALTER TABLE "LiveLink" ALTER COLUMN "serviceOrderId" DROP NOT NULL;
ALTER TABLE "LiveLink" ADD COLUMN IF NOT EXISTS "inspectionId" TEXT;
DO $$ BEGIN
  ALTER TABLE "LiveLink" ADD CONSTRAINT "LiveLink_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "LiveLink_inspectionId_revokedAt_idx" ON "LiveLink"("inspectionId", "revokedAt");
