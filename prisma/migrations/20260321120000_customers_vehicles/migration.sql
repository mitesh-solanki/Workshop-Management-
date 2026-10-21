-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "garageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "garageId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER,
    "odometer" INTEGER,
    "insuranceExpiry" TIMESTAMP(3),
    "pucExpiry" TIMESTAMP(3),
    "fitnessExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_garageId_idx" ON "Customer"("garageId");

-- CreateIndex
CREATE INDEX "Customer_garageId_phone_idx" ON "Customer"("garageId", "phone");

-- CreateIndex
CREATE INDEX "Customer_garageId_name_idx" ON "Customer"("garageId", "name");

-- CreateIndex
CREATE INDEX "Vehicle_garageId_idx" ON "Vehicle"("garageId");

-- CreateIndex
CREATE INDEX "Vehicle_customerId_idx" ON "Vehicle"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_garageId_registrationNumber_key" ON "Vehicle"("garageId", "registrationNumber");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "Garage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "Garage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
