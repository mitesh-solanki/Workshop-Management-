-- AlterTable
ALTER TABLE "SuggestedRepair" ADD COLUMN "partId" TEXT;

-- CreateIndex
CREATE INDEX "SuggestedRepair_partId_idx" ON "SuggestedRepair"("partId");

-- AddForeignKey
ALTER TABLE "SuggestedRepair" ADD CONSTRAINT "SuggestedRepair_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE SET NULL ON UPDATE CASCADE;
