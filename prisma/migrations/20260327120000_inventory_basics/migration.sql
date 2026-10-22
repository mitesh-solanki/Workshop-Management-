-- AlterTable
ALTER TABLE "Garage" ADD COLUMN "allowNegativeStock" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('IN', 'OUT', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "Part" (
    "id" TEXT NOT NULL,
    "garageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "purchasePricePaise" INTEGER NOT NULL DEFAULT 0,
    "sellingPricePaise" INTEGER NOT NULL DEFAULT 0,
    "gstRatePercent" INTEGER NOT NULL DEFAULT 18,
    "hsn" TEXT NOT NULL,
    "lowStockLevel" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "garageId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantityChange" INTEGER NOT NULL,
    "note" TEXT,
    "serviceOrderId" TEXT,
    "serviceOrderLineId" TEXT,
    "directSaleId" TEXT,
    "directSaleLineId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectSale" (
    "id" TEXT NOT NULL,
    "garageId" TEXT NOT NULL,
    "customerId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectSaleLine" (
    "id" TEXT NOT NULL,
    "garageId" TEXT NOT NULL,
    "directSaleId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPricePaise" INTEGER NOT NULL,
    "gstRatePercent" INTEGER NOT NULL DEFAULT 18,
    "hsn" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DirectSaleLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Part_garageId_idx" ON "Part"("garageId");

-- CreateIndex
CREATE INDEX "Part_garageId_name_idx" ON "Part"("garageId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Part_garageId_sku_key" ON "Part"("garageId", "sku");

-- CreateIndex
CREATE INDEX "StockMovement_garageId_partId_createdAt_idx" ON "StockMovement"("garageId", "partId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_garageId_createdAt_idx" ON "StockMovement"("garageId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_serviceOrderId_idx" ON "StockMovement"("serviceOrderId");

-- CreateIndex
CREATE INDEX "StockMovement_directSaleId_idx" ON "StockMovement"("directSaleId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_serviceOrderLineId_key" ON "StockMovement"("serviceOrderLineId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_directSaleLineId_key" ON "StockMovement"("directSaleLineId");

-- CreateIndex
CREATE INDEX "DirectSale_garageId_createdAt_idx" ON "DirectSale"("garageId", "createdAt");

-- CreateIndex
CREATE INDEX "DirectSale_customerId_idx" ON "DirectSale"("customerId");

-- CreateIndex
CREATE INDEX "DirectSaleLine_garageId_idx" ON "DirectSaleLine"("garageId");

-- CreateIndex
CREATE INDEX "DirectSaleLine_directSaleId_idx" ON "DirectSaleLine"("directSaleId");

-- CreateIndex
CREATE INDEX "DirectSaleLine_partId_idx" ON "DirectSaleLine"("partId");

-- CreateIndex
CREATE INDEX "ServiceOrderLine_partId_idx" ON "ServiceOrderLine"("partId");

-- AddForeignKey
ALTER TABLE "ServiceOrderLine" ADD CONSTRAINT "ServiceOrderLine_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Part" ADD CONSTRAINT "Part_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "Garage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "Garage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_serviceOrderLineId_fkey" FOREIGN KEY ("serviceOrderLineId") REFERENCES "ServiceOrderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_directSaleId_fkey" FOREIGN KEY ("directSaleId") REFERENCES "DirectSale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_directSaleLineId_fkey" FOREIGN KEY ("directSaleLineId") REFERENCES "DirectSaleLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectSale" ADD CONSTRAINT "DirectSale_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "Garage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectSale" ADD CONSTRAINT "DirectSale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectSale" ADD CONSTRAINT "DirectSale_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectSaleLine" ADD CONSTRAINT "DirectSaleLine_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "Garage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectSaleLine" ADD CONSTRAINT "DirectSaleLine_directSaleId_fkey" FOREIGN KEY ("directSaleId") REFERENCES "DirectSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectSaleLine" ADD CONSTRAINT "DirectSaleLine_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
