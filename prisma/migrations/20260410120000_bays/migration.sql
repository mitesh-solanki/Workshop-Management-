-- CreateTable
CREATE TABLE "Bay" (
    "id" TEXT NOT NULL,
    "garageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Bay_garageId_idx" ON "Bay"("garageId");

-- CreateIndex
CREATE INDEX "Bay_garageId_active_idx" ON "Bay"("garageId", "active");

-- CreateIndex
CREATE INDEX "Bay_garageId_sortOrder_idx" ON "Bay"("garageId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Bay_garageId_name_key" ON "Bay"("garageId", "name");

-- AddForeignKey
ALTER TABLE "Bay" ADD CONSTRAINT "Bay_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "Garage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
