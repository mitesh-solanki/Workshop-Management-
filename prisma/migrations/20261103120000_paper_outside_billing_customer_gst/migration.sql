-- CreateTable
CREATE TABLE "ServiceOrderPaperCopy" (
    "id" TEXT NOT NULL,
    "garageId" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "fileName" TEXT,
    "byteSize" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceOrderPaperCopy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceOrderPaperCopy_garageId_idx" ON "ServiceOrderPaperCopy"("garageId");

-- CreateIndex
CREATE INDEX "ServiceOrderPaperCopy_garageId_serviceOrderId_idx" ON "ServiceOrderPaperCopy"("garageId", "serviceOrderId");

-- CreateIndex
CREATE INDEX "ServiceOrderPaperCopy_serviceOrderId_idx" ON "ServiceOrderPaperCopy"("serviceOrderId");

-- AddForeignKey
ALTER TABLE "ServiceOrderPaperCopy" ADD CONSTRAINT "ServiceOrderPaperCopy_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "Garage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrderPaperCopy" ADD CONSTRAINT "ServiceOrderPaperCopy_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrderPaperCopy" ADD CONSTRAINT "ServiceOrderPaperCopy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterEnum
ALTER TYPE "ServiceOrderLineType" ADD VALUE 'OUTSIDE';

-- AlterEnum
ALTER TYPE "EstimateLineType" ADD VALUE 'OUTSIDE';
ALTER TYPE "InvoiceLineType" ADD VALUE 'OUTSIDE';

-- Billing is driven by job-card labour/parts; estimate is optional display context only.
ALTER TABLE "Invoice" ALTER COLUMN "estimateId" DROP NOT NULL;

ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_estimateId_fkey";

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "gstin" TEXT,
ADD COLUMN "stateCode" TEXT NOT NULL DEFAULT '24';
