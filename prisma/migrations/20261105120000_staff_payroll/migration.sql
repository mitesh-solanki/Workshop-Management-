-- CreateEnum
CREATE TYPE "StaffPayMode" AS ENUM ('FULL_BASIC');

-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "PayrollLineStatus" AS ENUM ('DRAFT', 'PAID');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('PAID', 'UNPAID');

-- CreateTable
CREATE TABLE "StaffPayProfile" (
    "id" TEXT NOT NULL,
    "garageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "basicSalaryPaise" INTEGER NOT NULL DEFAULT 0,
    "payMode" "StaffPayMode" NOT NULL DEFAULT 'FULL_BASIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPayProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAdvance" (
    "id" TEXT NOT NULL,
    "garageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "remainingPaise" INTEGER NOT NULL,
    "givenOn" DATE NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAdvance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffBonus" (
    "id" TEXT NOT NULL,
    "garageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "givenOn" DATE NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "note" TEXT,
    "payrollLineId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffBonus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "garageId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'OPEN',
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollLine" (
    "id" TEXT NOT NULL,
    "garageId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "basicPaise" INTEGER NOT NULL DEFAULT 0,
    "bonusPaise" INTEGER NOT NULL DEFAULT 0,
    "commissionPaise" INTEGER NOT NULL DEFAULT 0,
    "advanceDeductedPaise" INTEGER NOT NULL DEFAULT 0,
    "adjustmentPaise" INTEGER NOT NULL DEFAULT 0,
    "adjustmentNote" TEXT,
    "note" TEXT,
    "netPaise" INTEGER NOT NULL DEFAULT 0,
    "status" "PayrollLineStatus" NOT NULL DEFAULT 'DRAFT',
    "paidAt" TIMESTAMP(3),
    "paidMethod" "PaymentMethod",
    "paidById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "garageId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "spentAt" TIMESTAMP(3) NOT NULL,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'PAID',
    "method" "PaymentMethod",
    "category" TEXT NOT NULL,
    "note" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "passwordResetTokenHash" TEXT;
ALTER TABLE "User" ADD COLUMN "passwordResetExpiresAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "lockoutUntil" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "StaffPayProfile_userId_key" ON "StaffPayProfile"("userId");

-- CreateIndex
CREATE INDEX "StaffPayProfile_garageId_idx" ON "StaffPayProfile"("garageId");

-- CreateIndex
CREATE INDEX "StaffPayProfile_garageId_userId_idx" ON "StaffPayProfile"("garageId", "userId");

-- CreateIndex
CREATE INDEX "StaffAdvance_garageId_userId_idx" ON "StaffAdvance"("garageId", "userId");

-- CreateIndex
CREATE INDEX "StaffAdvance_garageId_remainingPaise_idx" ON "StaffAdvance"("garageId", "remainingPaise");

-- CreateIndex
CREATE INDEX "StaffBonus_garageId_userId_idx" ON "StaffBonus"("garageId", "userId");

-- CreateIndex
CREATE INDEX "StaffBonus_garageId_payrollLineId_idx" ON "StaffBonus"("garageId", "payrollLineId");

-- CreateIndex
CREATE INDEX "PayrollRun_garageId_periodStart_idx" ON "PayrollRun"("garageId", "periodStart");

-- CreateIndex
CREATE INDEX "PayrollRun_garageId_status_idx" ON "PayrollRun"("garageId", "status");

-- CreateIndex
CREATE INDEX "PayrollLine_garageId_userId_idx" ON "PayrollLine"("garageId", "userId");

-- CreateIndex
CREATE INDEX "PayrollLine_garageId_status_idx" ON "PayrollLine"("garageId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollLine_payrollRunId_userId_key" ON "PayrollLine"("payrollRunId", "userId");

-- CreateIndex
CREATE INDEX "Expense_garageId_spentAt_idx" ON "Expense"("garageId", "spentAt");

-- CreateIndex
CREATE INDEX "Expense_garageId_category_idx" ON "Expense"("garageId", "category");

-- CreateIndex
CREATE INDEX "Expense_garageId_status_idx" ON "Expense"("garageId", "status");

-- AddForeignKey
ALTER TABLE "StaffPayProfile" ADD CONSTRAINT "StaffPayProfile_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "Garage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPayProfile" ADD CONSTRAINT "StaffPayProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAdvance" ADD CONSTRAINT "StaffAdvance_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "Garage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAdvance" ADD CONSTRAINT "StaffAdvance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAdvance" ADD CONSTRAINT "StaffAdvance_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffBonus" ADD CONSTRAINT "StaffBonus_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "Garage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffBonus" ADD CONSTRAINT "StaffBonus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffBonus" ADD CONSTRAINT "StaffBonus_payrollLineId_fkey" FOREIGN KEY ("payrollLineId") REFERENCES "PayrollLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffBonus" ADD CONSTRAINT "StaffBonus_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "Garage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "Garage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "Garage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
