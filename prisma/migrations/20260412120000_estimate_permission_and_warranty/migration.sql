-- CreateEnum
CREATE TYPE "EstimatePermissionVia" AS ENUM ('MANUAL', 'LIVE_LINK');

-- AlterTable
ALTER TABLE "Estimate" ADD COLUMN "askPermission" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Estimate" ADD COLUMN "permissionVia" "EstimatePermissionVia";

-- CreateTable
CREATE TABLE "VehicleWarrantyDocument" (
    "id" TEXT NOT NULL,
    "garageId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "partName" TEXT NOT NULL,
    "invoiceId" TEXT,
    "invoiceLineId" TEXT,
    "warrantyExpiresAt" TIMESTAMP(3),
    "storageKey" TEXT,
    "contentType" TEXT,
    "byteSize" INTEGER,
    "fileName" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleWarrantyDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VehicleWarrantyDocument_invoiceLineId_key" ON "VehicleWarrantyDocument"("invoiceLineId");

-- CreateIndex
CREATE INDEX "VehicleWarrantyDocument_garageId_idx" ON "VehicleWarrantyDocument"("garageId");

-- CreateIndex
CREATE INDEX "VehicleWarrantyDocument_garageId_vehicleId_idx" ON "VehicleWarrantyDocument"("garageId", "vehicleId");

-- CreateIndex
CREATE INDEX "VehicleWarrantyDocument_garageId_customerId_idx" ON "VehicleWarrantyDocument"("garageId", "customerId");

-- CreateIndex
CREATE INDEX "VehicleWarrantyDocument_invoiceId_idx" ON "VehicleWarrantyDocument"("invoiceId");

-- AddForeignKey
ALTER TABLE "VehicleWarrantyDocument" ADD CONSTRAINT "VehicleWarrantyDocument_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "Garage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleWarrantyDocument" ADD CONSTRAINT "VehicleWarrantyDocument_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleWarrantyDocument" ADD CONSTRAINT "VehicleWarrantyDocument_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleWarrantyDocument" ADD CONSTRAINT "VehicleWarrantyDocument_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleWarrantyDocument" ADD CONSTRAINT "VehicleWarrantyDocument_invoiceLineId_fkey" FOREIGN KEY ("invoiceLineId") REFERENCES "InvoiceLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleWarrantyDocument" ADD CONSTRAINT "VehicleWarrantyDocument_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
