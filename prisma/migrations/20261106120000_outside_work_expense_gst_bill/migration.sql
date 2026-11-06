-- AlterTable
ALTER TABLE "ServiceOrderLine" ADD COLUMN     "vendorId" TEXT,
ADD COLUMN     "gstSplit" "GstSplitKind",
ADD COLUMN     "gstRatePercent" INTEGER,
ADD COLUMN     "billStorageKey" TEXT,
ADD COLUMN     "billContentType" TEXT,
ADD COLUMN     "billFileName" TEXT,
ADD COLUMN     "billByteSize" INTEGER;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "gstSplit" "GstSplitKind" NOT NULL DEFAULT 'CGST_SGST',
ADD COLUMN     "gstRatePercent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "billStorageKey" TEXT,
ADD COLUMN     "billContentType" TEXT,
ADD COLUMN     "billFileName" TEXT,
ADD COLUMN     "billByteSize" INTEGER,
ADD COLUMN     "vendorId" TEXT;

-- AddForeignKey
ALTER TABLE "ServiceOrderLine" ADD CONSTRAINT "ServiceOrderLine_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "ServiceOrderLine_vendorId_idx" ON "ServiceOrderLine"("vendorId");

-- CreateIndex
CREATE INDEX "Expense_vendorId_idx" ON "Expense"("vendorId");
