-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('NONE', 'RAZORPAY');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "status" "PaymentStatus" NOT NULL DEFAULT 'PAID',
ADD COLUMN     "provider" "PaymentProvider" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "providerPaymentId" TEXT,
ADD COLUMN     "providerOrderId" TEXT,
ADD COLUMN     "providerPaymentLinkId" TEXT,
ADD COLUMN     "paymentLinkUrl" TEXT,
ADD COLUMN     "qrImageDataUrl" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_provider_providerPaymentId_key" ON "Payment"("provider", "providerPaymentId");

-- CreateIndex
CREATE INDEX "Payment_providerPaymentLinkId_idx" ON "Payment"("providerPaymentLinkId");

-- CreateTable
CREATE TABLE "LiveLink" (
    "id" TEXT NOT NULL,
    "garageId" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LiveLink_tokenHash_key" ON "LiveLink"("tokenHash");

-- CreateIndex
CREATE INDEX "LiveLink_garageId_idx" ON "LiveLink"("garageId");

-- CreateIndex
CREATE INDEX "LiveLink_serviceOrderId_revokedAt_idx" ON "LiveLink"("serviceOrderId", "revokedAt");

-- CreateIndex
CREATE INDEX "LiveLink_expiresAt_idx" ON "LiveLink"("expiresAt");

-- AddForeignKey
ALTER TABLE "LiveLink" ADD CONSTRAINT "LiveLink_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "Garage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveLink" ADD CONSTRAINT "LiveLink_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveLink" ADD CONSTRAINT "LiveLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
