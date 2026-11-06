/**
 * Live Postgres proofs for payroll money rules and garage isolation.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { AppError, ForbiddenError } from "@/lib/errors";
import type { RoleSession } from "@/lib/rbac";
import {
  createPayrollRun,
  generateMonthPayroll,
  getMyPayLine,
  getPayrollManagement,
  getPayrollRunForGarage,
  giveAdvance,
  listMyPay,
  markPayrollLinePaid,
  savePayProfile,
  updatePayrollLine,
} from "@/modules/payroll/service";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    "postgresql://workshop:workshop@localhost:5433/workshop?schema=public";
}

const prisma = new PrismaClient();

async function dbReachable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

describe("payroll against Postgres", () => {
  let garageId = "";
  let otherGarageId = "";
  let ownerId = "";
  let techId = "";
  let ready = false;

  const ownerSession = (): RoleSession => ({
    userId: ownerId,
    garageId,
    role: "OWNER",
  });

  beforeAll(async () => {
    ready = await dbReachable();
    if (!ready) return;

    const garage = await prisma.garage.create({
      data: { name: `Payroll garage ${suffix}` },
      select: { id: true },
    });
    garageId = garage.id;

    const other = await prisma.garage.create({
      data: { name: `Payroll other ${suffix}` },
      select: { id: true },
    });
    otherGarageId = other.id;

    const owner = await prisma.user.create({
      data: {
        email: `payroll-owner-${suffix}@example.com`,
        name: "Payroll Owner",
        role: "OWNER",
        garageId,
      },
      select: { id: true },
    });
    ownerId = owner.id;

    const tech = await prisma.user.create({
      data: {
        email: `payroll-tech-${suffix}@example.com`,
        name: "Payroll Tech",
        role: "TECHNICIAN",
        garageId,
      },
      select: { id: true },
    });
    techId = tech.id;
  });

  afterAll(async () => {
    if (ready) {
      await prisma.garage.deleteMany({
        where: { id: { in: [garageId, otherGarageId].filter(Boolean) } },
      });
    }
    await prisma.$disconnect();
  });

  it("computes net, deducts advance on pay, and isolates garages", async () => {
    if (!ready) {
      expect.fail(
        "Postgres not reachable — start docker compose and set DATABASE_URL",
      );
    }

    await savePayProfile(ownerSession(), {
      userId: techId,
      basicRupees: "20000",
      payMode: "FULL_BASIC",
    });

    await giveAdvance(ownerSession(), {
      userId: techId,
      amountRupees: "5000",
      givenOn: "2026-11-10",
      method: "CASH",
      note: "Mid month",
    });

    const run = await createPayrollRun(ownerSession(), {
      periodStart: "2026-11-01",
      periodEnd: "2026-11-30",
      lines: [{ userId: techId, basicRupees: "20000" }],
    });

    const techLine = run.lines.find((l) => l.userId === techId);
    expect(techLine).toBeTruthy();
    expect(techLine!.basicPaise).toBe(2_000_000);
    expect(techLine!.advanceDeductedPaise).toBe(500_000);
    expect(techLine!.netPaise).toBe(1_500_000);

    await updatePayrollLine(ownerSession(), {
      lineId: techLine!.id,
      basicRupees: "20000",
      bonusRupees: "1000",
      commissionRupees: "2000",
      advanceDeductedRupees: "5000",
      adjustmentRupees: "-200",
      adjustmentNote: "Late",
    });

    const updated = await prisma.payrollLine.findFirstOrThrow({
      where: { id: techLine!.id, garageId },
    });
    expect(updated.netPaise).toBe(1_780_000);

    await markPayrollLinePaid(ownerSession(), {
      lineId: techLine!.id,
      method: "UPI",
    });

    const advance = await prisma.staffAdvance.findFirstOrThrow({
      where: { garageId, userId: techId },
    });
    expect(advance.remainingPaise).toBe(0);

    const paid = await prisma.payrollLine.findFirstOrThrow({
      where: { id: techLine!.id },
    });
    expect(paid.status).toBe("PAID");

    await expect(
      getPayrollRunForGarage(ownerSession(), otherGarageId, run.id),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const monthView = await getPayrollManagement(ownerSession(), {
      yearMonth: "2026-11",
      status: "ALL",
    });
    expect(monthView.lines.some((l) => l.userId === techId)).toBe(true);

    await expect(
      generateMonthPayroll(ownerSession(), {
        yearMonth: "2026-11",
        lines: [{ userId: techId, basicRupees: "20000" }],
      }),
    ).rejects.toBeInstanceOf(AppError);

    const refreshed = await getPayrollManagement(ownerSession(), {
      yearMonth: "2026-11",
      status: "ALL",
    });
    expect(
      refreshed.lines.filter((l) => l.userId === techId),
    ).toHaveLength(1);
  });

  it("lets a technician view only their own pay lines", async () => {
    if (!ready) {
      expect.fail(
        "Postgres not reachable — start docker compose and set DATABASE_URL",
      );
    }

    const otherTech = await prisma.user.create({
      data: {
        email: `payroll-tech-b-${suffix}@example.com`,
        name: "Other Tech",
        role: "TECHNICIAN",
        garageId,
      },
      select: { id: true },
    });

    await savePayProfile(ownerSession(), {
      userId: otherTech.id,
      basicRupees: "15000",
      payMode: "FULL_BASIC",
    });

    const run = await createPayrollRun(ownerSession(), {
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      lines: [
        { userId: techId, basicRupees: "18000" },
        { userId: otherTech.id, basicRupees: "15000" },
      ],
    });

    const ownLine = run.lines.find((l) => l.userId === techId);
    const otherLine = run.lines.find((l) => l.userId === otherTech.id);
    expect(ownLine).toBeTruthy();
    expect(otherLine).toBeTruthy();

    const techSession = (): RoleSession => ({
      userId: techId,
      garageId,
      role: "TECHNICIAN",
    });

    await expect(
      getMyPayLine(techSession(), ownLine!.id),
    ).rejects.toBeInstanceOf(AppError);

    await markPayrollLinePaid(ownerSession(), {
      lineId: ownLine!.id,
      method: "CASH",
    });

    const mine = await listMyPay(techSession());
    expect(mine.lines.every((l) => l.status === "PAID")).toBe(true);
    expect(mine.lines.some((l) => l.id === ownLine!.id)).toBe(true);
    expect(mine.lines.some((l) => l.id === otherLine!.id)).toBe(false);

    const detail = await getMyPayLine(techSession(), ownLine!.id);
    expect(detail.id).toBe(ownLine!.id);
    expect(detail.basicPaise).toBe(1_800_000);
    expect(detail.status).toBe("PAID");

    await expect(
      getMyPayLine(techSession(), otherLine!.id),
    ).rejects.toBeInstanceOf(AppError);

    await expect(listMyPay(ownerSession())).rejects.toBeInstanceOf(
      ForbiddenError,
    );

    const otherGarageTech = await prisma.user.create({
      data: {
        email: `payroll-tech-other-${suffix}@example.com`,
        name: "Other Garage Tech",
        role: "TECHNICIAN",
        garageId: otherGarageId,
      },
      select: { id: true },
    });

    await expect(
      listMyPay({
        userId: otherGarageTech.id,
        garageId: otherGarageId,
        role: "TECHNICIAN",
      }),
    ).resolves.toEqual({ lines: [] });

    await expect(
      getMyPayLine(
        {
          userId: otherGarageTech.id,
          garageId: otherGarageId,
          role: "TECHNICIAN",
        },
        ownLine!.id,
      ),
    ).rejects.toBeInstanceOf(AppError);
  });
});
