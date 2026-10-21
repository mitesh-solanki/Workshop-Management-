-- CreateEnum
CREATE TYPE "ServiceOrderStatus" AS ENUM ('WAITING', 'INSPECTION', 'IN_PROGRESS', 'WAITING_FOR_PARTS', 'READY', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ServiceOrderLineType" AS ENUM ('LABOUR', 'PART');

-- CreateTable
CREATE TABLE "ServiceOrder" (
    "id" TEXT NOT NULL,
    "garageId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "ServiceOrderStatus" NOT NULL DEFAULT 'WAITING',
    "complaint" TEXT NOT NULL,
    "requestedServices" TEXT,
    "odometerIn" INTEGER,
    "expectedCompletion" TIMESTAMP(3),
    "technicianId" TEXT,
    "bay" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceOrderLine" (
    "id" TEXT NOT NULL,
    "garageId" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "type" "ServiceOrderLineType" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPricePaise" INTEGER NOT NULL DEFAULT 0,
    "partId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceOrder_garageId_idx" ON "ServiceOrder"("garageId");

-- CreateIndex
CREATE INDEX "ServiceOrder_garageId_status_idx" ON "ServiceOrder"("garageId", "status");

-- CreateIndex
CREATE INDEX "ServiceOrder_garageId_technicianId_idx" ON "ServiceOrder"("garageId", "technicianId");

-- CreateIndex
CREATE INDEX "ServiceOrder_vehicleId_idx" ON "ServiceOrder"("vehicleId");

-- CreateIndex
CREATE INDEX "ServiceOrder_customerId_idx" ON "ServiceOrder"("customerId");

-- CreateIndex
CREATE INDEX "ServiceOrderLine_garageId_idx" ON "ServiceOrderLine"("garageId");

-- CreateIndex
CREATE INDEX "ServiceOrderLine_serviceOrderId_idx" ON "ServiceOrderLine"("serviceOrderId");

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "Garage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrderLine" ADD CONSTRAINT "ServiceOrderLine_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "Garage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrderLine" ADD CONSTRAINT "ServiceOrderLine_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
