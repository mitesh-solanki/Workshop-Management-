-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'FINALIZED');

-- CreateEnum
CREATE TYPE "InvoiceLineType" AS ENUM ('LABOUR', 'PART');

-- CreateEnum
CREATE TYPE "GstSplitKind" AS ENUM ('CGST_SGST', 'IGST');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'UPI', 'CARD', 'MIXED');

-- CreateEnum
CREATE TYPE "CreditNoteReason" AS ENUM ('CORRECTION', 'REFUND', 'OTHER');

-- CreateTable
CREATE TABLE "InvoiceNumberCounter" (
    "id" TEXT NOT NULL,
    "garageId" TEXT NOT NULL,
    "financialYearStart" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceNumberCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditNoteNumberCounter" (
    "id" TEXT NOT NULL,
    "garageId" TEXT NOT NULL,
    "financialYearStart" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CreditNoteNumberCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "garageId" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "invoiceNumber" TEXT,
    "financialYearStart" INTEGER,
    "sequenceNumber" INTEGER,
    "sellerStateCode" TEXT NOT NULL,
    "placeOfSupplyStateCode" TEXT NOT NULL,
    "gstSplit" "GstSplitKind" NOT NULL,
    "taxablePaise" INTEGER NOT NULL DEFAULT 0,
    "cgstPaise" INTEGER NOT NULL DEFAULT 0,
    "sgstPaise" INTEGER NOT NULL DEFAULT 0,
    "igstPaise" INTEGER NOT NULL DEFAULT 0,
    "totalPaise" INTEGER NOT NULL DEFAULT 0,
    "amountPaidPaise" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "garageId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "estimateLineId" TEXT,
    "type" "InvoiceLineType" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPricePaise" INTEGER NOT NULL,
    "gstRatePercent" INTEGER NOT NULL,
    "hsnOrSac" TEXT NOT NULL,
    "taxablePaise" INTEGER NOT NULL,
    "cgstPaise" INTEGER NOT NULL DEFAULT 0,
    "sgstPaise" INTEGER NOT NULL DEFAULT 0,
    "igstPaise" INTEGER NOT NULL DEFAULT 0,
    "totalPaise" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditNote" (
    "id" TEXT NOT NULL,
    "garageId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "creditNoteNumber" TEXT NOT NULL,
    "financialYearStart" INTEGER NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "reason" "CreditNoteReason" NOT NULL,
    "taxablePaise" INTEGER NOT NULL DEFAULT 0,
    "cgstPaise" INTEGER NOT NULL DEFAULT 0,
    "sgstPaise" INTEGER NOT NULL DEFAULT 0,
    "igstPaise" INTEGER NOT NULL DEFAULT 0,
    "totalPaise" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditNoteLine" (
    "id" TEXT NOT NULL,
    "garageId" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPricePaise" INTEGER NOT NULL,
    "gstRatePercent" INTEGER NOT NULL,
    "hsnOrSac" TEXT NOT NULL,
    "taxablePaise" INTEGER NOT NULL,
    "cgstPaise" INTEGER NOT NULL DEFAULT 0,
    "sgstPaise" INTEGER NOT NULL DEFAULT 0,
    "igstPaise" INTEGER NOT NULL DEFAULT 0,
    "totalPaise" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditNoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "garageId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "isRefund" BOOLEAN NOT NULL DEFAULT false,
    "cashPaise" INTEGER NOT NULL DEFAULT 0,
    "upiPaise" INTEGER NOT NULL DEFAULT 0,
    "cardPaise" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN "stateCode" TEXT NOT NULL DEFAULT '24';

-- CreateIndex
CREATE INDEX "InvoiceNumberCounter_garageId_idx" ON "InvoiceNumberCounter"("garageId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceNumberCounter_garageId_financialYearStart_key" ON "InvoiceNumberCounter"("garageId", "financialYearStart");

-- CreateIndex
CREATE INDEX "CreditNoteNumberCounter_garageId_idx" ON "CreditNoteNumberCounter"("garageId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditNoteNumberCounter_garageId_financialYearStart_key" ON "CreditNoteNumberCounter"("garageId", "financialYearStart");

-- CreateIndex
CREATE INDEX "Invoice_garageId_idx" ON "Invoice"("garageId");

-- CreateIndex
CREATE INDEX "Invoice_garageId_serviceOrderId_idx" ON "Invoice"("garageId", "serviceOrderId");

-- CreateIndex
CREATE INDEX "Invoice_garageId_status_idx" ON "Invoice"("garageId", "status");

-- CreateIndex
CREATE INDEX "Invoice_estimateId_idx" ON "Invoice"("estimateId");

-- CreateIndex
CREATE INDEX "Invoice_customerId_idx" ON "Invoice"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_garageId_invoiceNumber_key" ON "Invoice"("garageId", "invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_garageId_financialYearStart_sequenceNumber_key" ON "Invoice"("garageId", "financialYearStart", "sequenceNumber");

-- CreateIndex
CREATE INDEX "InvoiceLine_garageId_idx" ON "InvoiceLine"("garageId");

-- CreateIndex
CREATE INDEX "InvoiceLine_invoiceId_idx" ON "InvoiceLine"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceLine_estimateLineId_idx" ON "InvoiceLine"("estimateLineId");

-- CreateIndex
CREATE INDEX "CreditNote_garageId_idx" ON "CreditNote"("garageId");

-- CreateIndex
CREATE INDEX "CreditNote_invoiceId_idx" ON "CreditNote"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditNote_garageId_creditNoteNumber_key" ON "CreditNote"("garageId", "creditNoteNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CreditNote_garageId_financialYearStart_sequenceNumber_key" ON "CreditNote"("garageId", "financialYearStart", "sequenceNumber");

-- CreateIndex
CREATE INDEX "CreditNoteLine_garageId_idx" ON "CreditNoteLine"("garageId");

-- CreateIndex
CREATE INDEX "CreditNoteLine_creditNoteId_idx" ON "CreditNoteLine"("creditNoteId");

-- CreateIndex
CREATE INDEX "Payment_garageId_idx" ON "Payment"("garageId");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_receivedAt_idx" ON "Payment"("invoiceId", "receivedAt");

-- AddForeignKey
ALTER TABLE "InvoiceNumberCounter" ADD CONSTRAINT "InvoiceNumberCounter_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "Garage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNoteNumberCounter" ADD CONSTRAINT "CreditNoteNumberCounter_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "Garage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "Garage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "Garage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_estimateLineId_fkey" FOREIGN KEY ("estimateLineId") REFERENCES "EstimateLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "Garage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNoteLine" ADD CONSTRAINT "CreditNoteLine_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "Garage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNoteLine" ADD CONSTRAINT "CreditNoteLine_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "CreditNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "Garage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
