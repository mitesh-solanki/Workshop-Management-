import "server-only";

import type { PaymentMethod, Prisma, StaffPayMode } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function listGarageUsers(garageId: string) {
  return prisma.user.findMany({
    where: { garageId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
}

export async function findUserInGarage(garageId: string, userId: string) {
  return prisma.user.findFirst({
    where: { id: userId, garageId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      passwordHash: true,
      createdAt: true,
    },
  });
}

export async function findPayProfile(garageId: string, userId: string) {
  return prisma.staffPayProfile.findFirst({
    where: { garageId, userId },
  });
}

export async function upsertPayProfile(input: {
  garageId: string;
  userId: string;
  basicSalaryPaise: number;
  payMode: StaffPayMode;
}) {
  return prisma.staffPayProfile.upsert({
    where: { userId: input.userId },
    create: {
      garageId: input.garageId,
      userId: input.userId,
      basicSalaryPaise: input.basicSalaryPaise,
      payMode: input.payMode,
    },
    update: {
      basicSalaryPaise: input.basicSalaryPaise,
      payMode: input.payMode,
    },
  });
}

export async function listPayProfiles(garageId: string) {
  return prisma.staffPayProfile.findMany({
    where: { garageId },
  });
}

export async function createAdvance(input: {
  garageId: string;
  userId: string;
  amountPaise: number;
  givenOn: Date;
  method: PaymentMethod;
  note: string | null;
  createdById: string;
}) {
  return prisma.staffAdvance.create({
    data: {
      garageId: input.garageId,
      userId: input.userId,
      amountPaise: input.amountPaise,
      remainingPaise: input.amountPaise,
      givenOn: input.givenOn,
      method: input.method,
      note: input.note,
      createdById: input.createdById,
    },
  });
}

export async function findAdvance(garageId: string, advanceId: string) {
  return prisma.staffAdvance.findFirst({
    where: { id: advanceId, garageId },
  });
}

export async function updateAdvance(input: {
  garageId: string;
  advanceId: string;
  amountPaise: number;
  remainingPaise: number;
  givenOn: Date;
  method: PaymentMethod;
  note: string | null;
}) {
  return prisma.staffAdvance.updateMany({
    where: { id: input.advanceId, garageId: input.garageId },
    data: {
      amountPaise: input.amountPaise,
      remainingPaise: input.remainingPaise,
      givenOn: input.givenOn,
      method: input.method,
      note: input.note,
    },
  });
}

export async function deleteAdvance(garageId: string, advanceId: string) {
  return prisma.staffAdvance.deleteMany({
    where: { id: advanceId, garageId },
  });
}

export async function createBonus(input: {
  garageId: string;
  userId: string;
  amountPaise: number;
  givenOn: Date;
  method: PaymentMethod;
  note: string | null;
  createdById: string;
}) {
  return prisma.staffBonus.create({
    data: {
      garageId: input.garageId,
      userId: input.userId,
      amountPaise: input.amountPaise,
      givenOn: input.givenOn,
      method: input.method,
      note: input.note,
      createdById: input.createdById,
    },
  });
}

export async function findBonus(garageId: string, bonusId: string) {
  return prisma.staffBonus.findFirst({
    where: { id: bonusId, garageId },
  });
}

export async function updateBonus(input: {
  garageId: string;
  bonusId: string;
  amountPaise: number;
  givenOn: Date;
  method: PaymentMethod;
  note: string | null;
}) {
  return prisma.staffBonus.updateMany({
    where: {
      id: input.bonusId,
      garageId: input.garageId,
      payrollLineId: null,
    },
    data: {
      amountPaise: input.amountPaise,
      givenOn: input.givenOn,
      method: input.method,
      note: input.note,
    },
  });
}

export async function deleteBonus(garageId: string, bonusId: string) {
  return prisma.staffBonus.deleteMany({
    where: { id: bonusId, garageId, payrollLineId: null },
  });
}

export async function listOpenAdvances(garageId: string, userId: string) {
  return prisma.staffAdvance.findMany({
    where: { garageId, userId, remainingPaise: { gt: 0 } },
    orderBy: [{ givenOn: "asc" }, { createdAt: "asc" }],
  });
}

export async function sumOpenAdvancePaise(garageId: string, userId: string) {
  const agg = await prisma.staffAdvance.aggregate({
    where: { garageId, userId, remainingPaise: { gt: 0 } },
    _sum: { remainingPaise: true },
  });
  return agg._sum.remainingPaise ?? 0;
}

export async function listUnappliedBonusesInRange(
  garageId: string,
  userId: string,
  periodStart: Date,
  periodEnd: Date,
) {
  return prisma.staffBonus.findMany({
    where: {
      garageId,
      userId,
      payrollLineId: null,
      givenOn: { gte: periodStart, lte: periodEnd },
    },
    orderBy: [{ givenOn: "asc" }, { createdAt: "asc" }],
  });
}

export async function listUnappliedBonusesForGarage(garageId: string) {
  return prisma.staffBonus.findMany({
    where: { garageId, payrollLineId: null },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
    orderBy: [{ givenOn: "desc" }, { createdAt: "desc" }],
  });
}

export async function listAdvancesForUser(garageId: string, userId: string) {
  return prisma.staffAdvance.findMany({
    where: { garageId, userId },
    orderBy: [{ givenOn: "desc" }, { createdAt: "desc" }],
    take: 50,
  });
}

export async function listBonusesForUser(garageId: string, userId: string) {
  return prisma.staffBonus.findMany({
    where: { garageId, userId },
    orderBy: [{ givenOn: "desc" }, { createdAt: "desc" }],
    take: 50,
  });
}

export async function listOpenAdvancesForGarage(garageId: string) {
  return prisma.staffAdvance.findMany({
    where: { garageId, remainingPaise: { gt: 0 } },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
    orderBy: [{ givenOn: "asc" }, { createdAt: "asc" }],
  });
}

export async function listRecentBonusesForGarage(garageId: string) {
  return prisma.staffBonus.findMany({
    where: { garageId },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
    orderBy: [{ givenOn: "desc" }, { createdAt: "desc" }],
    take: 50,
  });
}

export async function listPayrollRuns(garageId: string) {
  return prisma.payrollRun.findMany({
    where: { garageId },
    include: {
      _count: { select: { lines: true } },
      lines: {
        select: {
          status: true,
          netPaise: true,
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }],
  });
}

export async function findPayrollRun(garageId: string, runId: string) {
  return prisma.payrollRun.findFirst({
    where: { id: runId, garageId },
    include: {
      lines: {
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export async function findPayrollLine(garageId: string, lineId: string) {
  return prisma.payrollLine.findFirst({
    where: { id: lineId, garageId },
    include: {
      payrollRun: true,
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  });
}

export async function createPayrollRunWithLines(
  input: {
    garageId: string;
    periodStart: Date;
    periodEnd: Date;
    note: string | null;
    createdById: string;
    lines: {
      userId: string;
      basicPaise: number;
      bonusPaise: number;
      commissionPaise: number;
      advanceDeductedPaise: number;
      adjustmentPaise: number;
      note: string | null;
      netPaise: number;
      bonusIds: string[];
    }[];
  },
  tx: Prisma.TransactionClient = prisma,
) {
  const run = await tx.payrollRun.create({
    data: {
      garageId: input.garageId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      note: input.note,
      createdById: input.createdById,
      status: "OPEN",
      lines: {
        create: input.lines.map((line) => ({
          garageId: input.garageId,
          userId: line.userId,
          basicPaise: line.basicPaise,
          bonusPaise: line.bonusPaise,
          commissionPaise: line.commissionPaise,
          advanceDeductedPaise: line.advanceDeductedPaise,
          adjustmentPaise: line.adjustmentPaise,
          note: line.note,
          netPaise: line.netPaise,
          status: "DRAFT",
        })),
      },
    },
    include: { lines: true },
  });

  for (const draft of input.lines) {
    if (draft.bonusIds.length === 0) continue;
    const line = run.lines.find((l) => l.userId === draft.userId);
    if (!line) continue;
    await tx.staffBonus.updateMany({
      where: {
        id: { in: draft.bonusIds },
        garageId: input.garageId,
        userId: draft.userId,
        payrollLineId: null,
      },
      data: { payrollLineId: line.id },
    });
  }

  return run;
}

export async function updatePayrollLineAmounts(
  input: {
    garageId: string;
    lineId: string;
    basicPaise: number;
    bonusPaise: number;
    commissionPaise: number;
    advanceDeductedPaise: number;
    adjustmentPaise: number;
    adjustmentNote: string | null;
    netPaise: number;
  },
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.payrollLine.updateMany({
    where: {
      id: input.lineId,
      garageId: input.garageId,
      status: "DRAFT",
    },
    data: {
      basicPaise: input.basicPaise,
      bonusPaise: input.bonusPaise,
      commissionPaise: input.commissionPaise,
      advanceDeductedPaise: input.advanceDeductedPaise,
      adjustmentPaise: input.adjustmentPaise,
      adjustmentNote: input.adjustmentNote,
      netPaise: input.netPaise,
    },
  });
}

export async function listAdvancesForRestore(
  garageId: string,
  userId: string,
) {
  return prisma.staffAdvance.findMany({
    where: { garageId, userId },
    orderBy: [{ givenOn: "desc" }, { createdAt: "desc" }],
  });
}

export async function markPayrollLinePaidInTx(
  tx: Prisma.TransactionClient,
  input: {
    garageId: string;
    lineId: string;
    method: PaymentMethod;
    paidById: string;
    paidAt: Date;
    advancePlan: { id: string; deductPaise: number }[];
  },
) {
  const updated = await tx.payrollLine.updateMany({
    where: {
      id: input.lineId,
      garageId: input.garageId,
      status: "DRAFT",
    },
    data: {
      status: "PAID",
      paidAt: input.paidAt,
      paidMethod: input.method,
      paidById: input.paidById,
    },
  });
  if (updated.count === 0) {
    return { ok: false as const };
  }

  for (const step of input.advancePlan) {
    const advance = await tx.staffAdvance.findFirst({
      where: {
        id: step.id,
        garageId: input.garageId,
        remainingPaise: { gte: step.deductPaise },
      },
    });
    if (!advance) {
      throw new Error("ADVANCE_CONFLICT");
    }
    await tx.staffAdvance.update({
      where: { id: advance.id },
      data: { remainingPaise: advance.remainingPaise - step.deductPaise },
    });
  }

  return { ok: true as const };
}

export async function unmarkPayrollLinePaidInTx(
  tx: Prisma.TransactionClient,
  input: {
    garageId: string;
    lineId: string;
    payrollRunId: string;
    advancePlan: { id: string; restorePaise: number }[];
  },
) {
  const updated = await tx.payrollLine.updateMany({
    where: {
      id: input.lineId,
      garageId: input.garageId,
      status: "PAID",
    },
    data: {
      status: "DRAFT",
      paidAt: null,
      paidMethod: null,
      paidById: null,
    },
  });
  if (updated.count === 0) {
    return { ok: false as const };
  }

  for (const step of input.advancePlan) {
    const advance = await tx.staffAdvance.findFirst({
      where: { id: step.id, garageId: input.garageId },
    });
    if (!advance) {
      throw new Error("ADVANCE_CONFLICT");
    }
    const nextRemaining = advance.remainingPaise + step.restorePaise;
    if (nextRemaining > advance.amountPaise) {
      throw new Error("ADVANCE_CONFLICT");
    }
    await tx.staffAdvance.update({
      where: { id: advance.id },
      data: { remainingPaise: nextRemaining },
    });
  }

  await tx.payrollRun.updateMany({
    where: { id: input.payrollRunId, garageId: input.garageId },
    data: { status: "OPEN" },
  });

  return { ok: true as const };
}

export async function deletePayrollLineInTx(
  tx: Prisma.TransactionClient,
  input: {
    garageId: string;
    lineId: string;
    payrollRunId: string;
    advancePlan: { id: string; restorePaise: number }[];
  },
) {
  const line = await tx.payrollLine.findFirst({
    where: { id: input.lineId, garageId: input.garageId },
  });
  if (!line) {
    return { ok: false as const };
  }

  if (line.status === "PAID") {
    for (const step of input.advancePlan) {
      const advance = await tx.staffAdvance.findFirst({
        where: { id: step.id, garageId: input.garageId },
      });
      if (!advance) {
        throw new Error("ADVANCE_CONFLICT");
      }
      const nextRemaining = advance.remainingPaise + step.restorePaise;
      if (nextRemaining > advance.amountPaise) {
        throw new Error("ADVANCE_CONFLICT");
      }
      await tx.staffAdvance.update({
        where: { id: advance.id },
        data: { remainingPaise: nextRemaining },
      });
    }
  }

  await tx.staffBonus.updateMany({
    where: { garageId: input.garageId, payrollLineId: input.lineId },
    data: { payrollLineId: null },
  });

  await tx.payrollLine.deleteMany({
    where: { id: input.lineId, garageId: input.garageId },
  });

  const remaining = await tx.payrollLine.count({
    where: { garageId: input.garageId, payrollRunId: input.payrollRunId },
  });
  if (remaining === 0) {
    await tx.payrollRun.deleteMany({
      where: { id: input.payrollRunId, garageId: input.garageId },
    });
  } else {
    await closeRunIfAllPaid(tx, input.garageId, input.payrollRunId);
  }

  return { ok: true as const };
}

export async function closeRunIfAllPaid(
  tx: Prisma.TransactionClient,
  garageId: string,
  runId: string,
) {
  const open = await tx.payrollLine.count({
    where: { garageId, payrollRunId: runId, status: "DRAFT" },
  });
  if (open > 0) return;
  await tx.payrollRun.updateMany({
    where: { id: runId, garageId, status: "OPEN" },
    data: { status: "CLOSED" },
  });
}

export async function listPaidLinesForUser(garageId: string, userId: string) {
  return prisma.payrollLine.findMany({
    where: { garageId, userId, status: "PAID" },
    include: {
      payrollRun: {
        select: { id: true, periodStart: true, periodEnd: true },
      },
    },
    orderBy: { paidAt: "desc" },
    take: 12,
  });
}

export async function listPayrollLinesForUser(garageId: string, userId: string) {
  return prisma.payrollLine.findMany({
    where: { garageId, userId },
    include: {
      payrollRun: {
        select: { id: true, periodStart: true, periodEnd: true, status: true },
      },
    },
    orderBy: [
      { payrollRun: { periodStart: "desc" } },
      { createdAt: "desc" },
    ],
    take: 24,
  });
}

export async function findPayrollLineForUserInPeriod(
  garageId: string,
  userId: string,
  periodStart: Date,
  periodEnd: Date,
) {
  return prisma.payrollLine.findFirst({
    where: {
      garageId,
      userId,
      payrollRun: { garageId, periodStart, periodEnd },
    },
    select: { id: true },
  });
}

export async function withPayrollTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return prisma.$transaction(fn);
}

export async function findPayrollRunByPeriod(
  garageId: string,
  periodStart: Date,
  periodEnd: Date,
) {
  return prisma.payrollRun.findFirst({
    where: { garageId, periodStart, periodEnd },
    include: {
      lines: {
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listPayrollLinesForGarage(
  garageId: string,
  opts?: {
    periodStart?: Date;
    periodEnd?: Date;
  },
) {
  return prisma.payrollLine.findMany({
    where: {
      garageId,
      ...(opts?.periodStart && opts?.periodEnd
        ? {
            payrollRun: {
              periodStart: opts.periodStart,
              periodEnd: opts.periodEnd,
            },
          }
        : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      payrollRun: {
        select: { id: true, periodStart: true, periodEnd: true, status: true },
      },
    },
    orderBy: [
      { payrollRun: { periodStart: "desc" } },
      { createdAt: "desc" },
    ],
  });
}

export async function addPayrollLinesToRun(
  input: {
    garageId: string;
    payrollRunId: string;
    lines: {
      userId: string;
      basicPaise: number;
      bonusPaise: number;
      commissionPaise: number;
      advanceDeductedPaise: number;
      adjustmentPaise: number;
      note: string | null;
      netPaise: number;
      bonusIds: string[];
    }[];
  },
  tx: Prisma.TransactionClient = prisma,
) {
  const created = [];
  for (const line of input.lines) {
    const row = await tx.payrollLine.create({
      data: {
        garageId: input.garageId,
        payrollRunId: input.payrollRunId,
        userId: line.userId,
        basicPaise: line.basicPaise,
        bonusPaise: line.bonusPaise,
        commissionPaise: line.commissionPaise,
        advanceDeductedPaise: line.advanceDeductedPaise,
        adjustmentPaise: line.adjustmentPaise,
        note: line.note,
        netPaise: line.netPaise,
        status: "DRAFT",
      },
    });
    created.push(row);
    if (line.bonusIds.length > 0) {
      await tx.staffBonus.updateMany({
        where: {
          id: { in: line.bonusIds },
          garageId: input.garageId,
          userId: line.userId,
          payrollLineId: null,
        },
        data: { payrollLineId: row.id },
      });
    }
  }
  return created;
}

export async function listBonusesInRange(
  garageId: string,
  periodStart: Date,
  periodEnd: Date,
  userId?: string,
) {
  return prisma.staffBonus.findMany({
    where: {
      garageId,
      givenOn: { gte: periodStart, lte: periodEnd },
      ...(userId ? { userId } : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      payrollLine: {
        select: { id: true, status: true, payrollRunId: true },
      },
    },
    orderBy: [{ createdAt: "desc" }, { givenOn: "desc" }],
  });
}

export async function listAdvancesInRange(
  garageId: string,
  periodStart: Date,
  periodEnd: Date,
  userId?: string,
) {
  return prisma.staffAdvance.findMany({
    where: {
      garageId,
      givenOn: { gte: periodStart, lte: periodEnd },
      ...(userId ? { userId } : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
    orderBy: [{ createdAt: "desc" }, { givenOn: "desc" }],
  });
}

export async function listAllOpenAdvancesForGarage(garageId: string) {
  return listOpenAdvancesForGarage(garageId);
}
