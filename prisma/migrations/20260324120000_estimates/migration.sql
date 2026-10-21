-- CreateEnum
CREATE TYPE "EstimateLineType" AS ENUM ('LABOUR', 'PART');

-- CreateEnum
CREATE TYPE "EstimateLineApprovalState" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EstimateApprovalMethod" AS ENUM ('MANUAL', 'PHONE', 'WHATSAPP', 'ONLINE');

-- CreateTable
CREATE TABLE "Estimate" (
    "id" TEXT NOT NULL,
    "garageId" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "notes" TEXT,
    "supersededAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Estimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstimateLine" (
    "id" TEXT NOT NULL,
    "garageId" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "type" "EstimateLineType" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPricePaise" INTEGER NOT NULL DEFAULT 0,
    "gstRatePercent" INTEGER NOT NULL DEFAULT 18,
    "hsnOrSac" TEXT NOT NULL,
    "approvalState" "EstimateLineApprovalState" NOT NULL DEFAULT 'PENDING',
    "sourceOrderLineId" TEXT,
    "sourceSuggestedRepairId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstimateLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstimateApproval" (
    "id" TEXT NOT NULL,
    "garageId" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "estimateLineId" TEXT NOT NULL,
    "fromState" "EstimateLineApprovalState",
    "toState" "EstimateLineApprovalState" NOT NULL,
    "method" "EstimateApprovalMethod" NOT NULL,
    "recordedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EstimateApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Estimate_garageId_idx" ON "Estimate"("garageId");

-- CreateIndex
CREATE INDEX "Estimate_serviceOrderId_idx" ON "Estimate"("serviceOrderId");

-- CreateIndex
CREATE INDEX "Estimate_garageId_serviceOrderId_supersededAt_idx" ON "Estimate"("garageId", "serviceOrderId", "supersededAt");

-- CreateIndex
CREATE UNIQUE INDEX "Estimate_serviceOrderId_revisionNumber_key" ON "Estimate"("serviceOrderId", "revisionNumber");

-- CreateIndex
CREATE INDEX "EstimateLine_garageId_idx" ON "EstimateLine"("garageId");

-- CreateIndex
CREATE INDEX "EstimateLine_estimateId_idx" ON "EstimateLine"("estimateId");

-- CreateIndex
CREATE INDEX "EstimateLine_garageId_approvalState_idx" ON "EstimateLine"("garageId", "approvalState");

-- CreateIndex
CREATE INDEX "EstimateApproval_garageId_idx" ON "EstimateApproval"("garageId");

-- CreateIndex
CREATE INDEX "EstimateApproval_estimateId_createdAt_idx" ON "EstimateApproval"("estimateId", "createdAt");

-- CreateIndex
CREATE INDEX "EstimateApproval_estimateLineId_createdAt_idx" ON "EstimateApproval"("estimateLineId", "createdAt");

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "Garage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateLine" ADD CONSTRAINT "EstimateLine_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "Garage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateLine" ADD CONSTRAINT "EstimateLine_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateApproval" ADD CONSTRAINT "EstimateApproval_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "Garage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateApproval" ADD CONSTRAINT "EstimateApproval_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateApproval" ADD CONSTRAINT "EstimateApproval_estimateLineId_fkey" FOREIGN KEY ("estimateLineId") REFERENCES "EstimateLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateApproval" ADD CONSTRAINT "EstimateApproval_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
