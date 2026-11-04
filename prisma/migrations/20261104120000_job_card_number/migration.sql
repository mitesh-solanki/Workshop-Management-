-- CreateTable
CREATE TABLE "JobCardNumberCounter" (
    "id" TEXT NOT NULL,
    "garageId" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "JobCardNumberCounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobCardNumberCounter_garageId_key" ON "JobCardNumberCounter"("garageId");

-- AddForeignKey
ALTER TABLE "JobCardNumberCounter" ADD CONSTRAINT "JobCardNumberCounter_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "Garage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: nullable first for backfill
ALTER TABLE "ServiceOrder" ADD COLUMN "jobCardNumber" INTEGER;

-- Backfill existing rows per garage by createdAt
WITH ranked AS (
  SELECT
    id,
    "garageId",
    ROW_NUMBER() OVER (PARTITION BY "garageId" ORDER BY "createdAt" ASC, id ASC) AS n
  FROM "ServiceOrder"
)
UPDATE "ServiceOrder" AS so
SET "jobCardNumber" = ranked.n
FROM ranked
WHERE so.id = ranked.id;

-- Seed counters from max assigned number
INSERT INTO "JobCardNumberCounter" ("id", "garageId", "lastNumber")
SELECT
  'jcn_' || g.id,
  g.id,
  COALESCE((SELECT MAX(so."jobCardNumber") FROM "ServiceOrder" so WHERE so."garageId" = g.id), 0)
FROM "Garage" g
ON CONFLICT ("garageId") DO NOTHING;

-- Enforce required + unique
ALTER TABLE "ServiceOrder" ALTER COLUMN "jobCardNumber" SET NOT NULL;

CREATE UNIQUE INDEX "ServiceOrder_garageId_jobCardNumber_key" ON "ServiceOrder"("garageId", "jobCardNumber");
