import "server-only";

import { writeAuditLog } from "@/lib/audit";
import { AppError, ForbiddenError } from "@/lib/errors";
import { requireRole, type RoleSession } from "@/lib/rbac";
import {
  computePayrollNetPaise,
  defaultMonthPeriod,
  draftBasicPaise,
  planAdvanceDeductions,
  planAdvanceRestores,
} from "@/modules/payroll/calc";
import * as repo from "@/modules/payroll/repo";
import {
  currentYearMonth,
  periodFromYearMonth,
} from "@/modules/payroll/date";
import {
  createPayrollRunSchema,
  generateMonthPayrollSchema,
  deleteAdvanceSchema,
  deleteBonusSchema,
  giveAdvanceSchema,
  giveBonusSchema,
  payrollMoneyListQuerySchema,
  markPayrollLinePaidSchema,
  payrollManagementQuerySchema,
  payrollRunIdSchema,
  deletePayrollLineSchema,
  unmarkPayrollLinePaidSchema,
  updateAdvanceSchema,
  updateBonusSchema,
  updatePayrollLineSchema,
  upsertPayProfileSchema,
  type CreatePayrollRunInput,
  type DeleteAdvanceInput,
  type DeleteBonusInput,
  type DeletePayrollLineInput,
  type GenerateMonthPayrollInput,
  type GiveAdvanceInput,
  type GiveBonusInput,
  type MarkPayrollLinePaidInput,
  type PayrollManagementQueryInput,
  type PayrollMoneyListQueryInput,
  type UnmarkPayrollLinePaidInput,
  type UpdateAdvanceInput,
  type UpdateBonusInput,
  type UpdatePayrollLineInput,
  type UpsertPayProfileInput,
} from "@/modules/payroll/schema";

const MONEY_ROLES = ["OWNER", "ACCOUNTANT"] as const;
const TEAM_VIEW_ROLES = ["OWNER", "MANAGER", "ACCOUNTANT"] as const;

function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function emptyNote(note: string | undefined | null): string | null {
  const trimmed = (note ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function canManagePayrollMoney(session: RoleSession) {
  return MONEY_ROLES.includes(session.role as (typeof MONEY_ROLES)[number]);
}

export function assertCanViewTeamForPayroll(session: RoleSession) {
  requireRole(session, TEAM_VIEW_ROLES);
}

export function assertCanManagePayrollMoney(session: RoleSession) {
  requireRole(session, MONEY_ROLES);
}

function isPayrollEligibleRole(role: string) {
  return role !== "OWNER";
}

function assertPayrollEligibleMember(member: { role: string }) {
  if (!isPayrollEligibleRole(member.role)) {
    throw new AppError("payroll.owner_not_payable", 400);
  }
}

export async function getDefaultPayrollPeriod() {
  return defaultMonthPeriod();
}

export async function listPayrollDashboard(session: RoleSession) {
  assertCanManagePayrollMoney(session);
  const [runs, openAdvances, recentBonuses, members, profiles] =
    await Promise.all([
      repo.listPayrollRuns(session.garageId),
      repo.listOpenAdvancesForGarage(session.garageId),
      repo.listRecentBonusesForGarage(session.garageId),
      repo.listGarageUsers(session.garageId),
      repo.listPayProfiles(session.garageId),
    ]);
  const profileByUser = new Map(profiles.map((p) => [p.userId, p]));

  return {
    runs: runs.map((run) => {
      const paid = run.lines.filter((l) => l.status === "PAID").length;
      const draft = run.lines.filter((l) => l.status === "DRAFT").length;
      const netTotal = run.lines.reduce((sum, l) => sum + l.netPaise, 0);
      return {
        id: run.id,
        periodStart: run.periodStart,
        periodEnd: run.periodEnd,
        status: run.status,
        note: run.note,
        createdAt: run.createdAt,
        lineCount: run._count.lines,
        paidCount: paid,
        draftCount: draft,
        netTotalPaise: netTotal,
        members: run.lines.map((line) => ({
          id: line.user.id,
          name: line.user.name?.trim() || line.user.email,
          status: line.status,
          netPaise: line.netPaise,
        })),
      };
    }),
    openAdvances,
    recentBonuses,
    members: members
      .filter((member) => isPayrollEligibleRole(member.role))
      .map((member) => ({
        ...member,
        basicSalaryPaise: profileByUser.get(member.id)?.basicSalaryPaise ?? 0,
        payMode:
          profileByUser.get(member.id)?.payMode ?? ("FULL_BASIC" as const),
      })),
    defaultPeriod: defaultMonthPeriod(),
  };
}

export async function getPayrollRun(session: RoleSession, runId: string) {
  assertCanManagePayrollMoney(session);
  const run = await repo.findPayrollRun(session.garageId, runId);
  if (!run) {
    throw new AppError("payroll.not_found", 404);
  }
  return run;
}

export async function getMemberPayroll(
  session: RoleSession,
  userId: string,
) {
  assertCanViewTeamForPayroll(session);
  const member = await repo.findUserInGarage(session.garageId, userId);
  if (!member) {
    throw new AppError("payroll.member_not_found", 404);
  }

  const canMoney = canManagePayrollMoney(session);
  if (!canMoney && session.role !== "MANAGER") {
    throw new ForbiddenError();
  }

  const currentMonth = currentYearMonth();
  const { periodStart, periodEnd } = periodFromYearMonth(currentMonth);

  const [profile, advances, bonuses, payrollLines, openAdvancePaise, currentLine] =
    await Promise.all([
      repo.findPayProfile(session.garageId, userId),
      canMoney
        ? repo.listOpenAdvances(session.garageId, userId)
        : Promise.resolve([]),
      canMoney
        ? repo.listBonusesForUser(session.garageId, userId)
        : Promise.resolve([]),
      canMoney
        ? repo.listPayrollLinesForUser(session.garageId, userId)
        : Promise.resolve([]),
      canMoney
        ? repo.sumOpenAdvancePaise(session.garageId, userId)
        : Promise.resolve(0),
      canMoney
        ? repo.findPayrollLineForUserInPeriod(
            session.garageId,
            userId,
            periodStart,
            periodEnd,
          )
        : Promise.resolve(null),
    ]);

  const { passwordHash, ...memberRest } = member;
  return {
    member: {
      ...memberRest,
      hasPassword: Boolean(passwordHash),
    },
    profile: profile ?? {
      basicSalaryPaise: 0,
      payMode: "FULL_BASIC" as const,
    },
    advances,
    bonuses,
    payrollLines,
    paidLines: payrollLines.filter((line) => line.status === "PAID"),
    openAdvancePaise,
    onCurrentMonthPayroll: Boolean(currentLine),
    canMoney,
  };
}

export async function savePayProfile(
  session: RoleSession,
  raw: UpsertPayProfileInput,
) {
  assertCanManagePayrollMoney(session);
  const input = upsertPayProfileSchema.parse(raw);
  const member = await repo.findUserInGarage(session.garageId, input.userId);
  if (!member) {
    throw new AppError("payroll.member_not_found", 404);
  }
  assertPayrollEligibleMember(member);

  const profile = await repo.upsertPayProfile({
    garageId: session.garageId,
    userId: input.userId,
    basicSalaryPaise: input.basicRupees,
    payMode: input.payMode,
  });

  await writeAuditLog({
    garageId: session.garageId,
    actorId: session.userId,
    action: "payroll.pay_profile_saved",
    entity: "StaffPayProfile",
    entityId: profile.id,
    meta: {
      userId: input.userId,
      basicSalaryPaise: profile.basicSalaryPaise,
      payMode: profile.payMode,
    },
  });

  return profile;
}

export async function giveAdvance(session: RoleSession, raw: GiveAdvanceInput) {
  assertCanManagePayrollMoney(session);
  const input = giveAdvanceSchema.parse(raw);
  const member = await repo.findUserInGarage(session.garageId, input.userId);
  if (!member) {
    throw new AppError("payroll.member_not_found", 404);
  }
  assertPayrollEligibleMember(member);

  const advance = await repo.createAdvance({
    garageId: session.garageId,
    userId: input.userId,
    amountPaise: input.amountRupees,
    givenOn: parseDateOnly(input.givenOn),
    method: input.method,
    note: emptyNote(input.note),
    createdById: session.userId,
  });

  await writeAuditLog({
    garageId: session.garageId,
    actorId: session.userId,
    action: "payroll.advance_given",
    entity: "StaffAdvance",
    entityId: advance.id,
    meta: {
      userId: input.userId,
      amountPaise: advance.amountPaise,
      method: advance.method,
    },
  });

  return advance;
}

export async function updateAdvance(
  session: RoleSession,
  raw: UpdateAdvanceInput,
) {
  assertCanManagePayrollMoney(session);
  const input = updateAdvanceSchema.parse(raw);
  const existing = await repo.findAdvance(session.garageId, input.advanceId);
  if (!existing) {
    throw new AppError("payroll.advance_not_found", 404);
  }
  if (existing.remainingPaise !== existing.amountPaise) {
    throw new AppError("payroll.advance_already_recovered", 409);
  }

  await repo.updateAdvance({
    garageId: session.garageId,
    advanceId: input.advanceId,
    amountPaise: input.amountRupees,
    remainingPaise: input.amountRupees,
    givenOn: parseDateOnly(input.givenOn),
    method: input.method,
    note: emptyNote(input.note),
  });

  await writeAuditLog({
    garageId: session.garageId,
    actorId: session.userId,
    action: "payroll.advance_updated",
    entity: "StaffAdvance",
    entityId: existing.id,
    meta: {
      userId: existing.userId,
      amountPaise: input.amountRupees,
      method: input.method,
    },
  });

  return existing.userId;
}

export async function deleteAdvance(
  session: RoleSession,
  raw: DeleteAdvanceInput,
) {
  assertCanManagePayrollMoney(session);
  const input = deleteAdvanceSchema.parse(raw);
  const existing = await repo.findAdvance(session.garageId, input.advanceId);
  if (!existing) {
    throw new AppError("payroll.advance_not_found", 404);
  }
  if (existing.remainingPaise !== existing.amountPaise) {
    throw new AppError("payroll.advance_already_recovered", 409);
  }

  await repo.deleteAdvance(session.garageId, input.advanceId);

  await writeAuditLog({
    garageId: session.garageId,
    actorId: session.userId,
    action: "payroll.advance_deleted",
    entity: "StaffAdvance",
    entityId: existing.id,
    meta: {
      userId: existing.userId,
      amountPaise: existing.amountPaise,
    },
  });

  return existing.userId;
}

export async function giveBonus(session: RoleSession, raw: GiveBonusInput) {
  assertCanManagePayrollMoney(session);
  const input = giveBonusSchema.parse(raw);
  const member = await repo.findUserInGarage(session.garageId, input.userId);
  if (!member) {
    throw new AppError("payroll.member_not_found", 404);
  }
  assertPayrollEligibleMember(member);

  const bonus = await repo.createBonus({
    garageId: session.garageId,
    userId: input.userId,
    amountPaise: input.amountRupees,
    givenOn: parseDateOnly(input.givenOn),
    method: input.method,
    note: emptyNote(input.note),
    createdById: session.userId,
  });

  await writeAuditLog({
    garageId: session.garageId,
    actorId: session.userId,
    action: "payroll.bonus_given",
    entity: "StaffBonus",
    entityId: bonus.id,
    meta: {
      userId: input.userId,
      amountPaise: bonus.amountPaise,
      method: bonus.method,
    },
  });

  return bonus;
}

export async function updateBonus(
  session: RoleSession,
  raw: UpdateBonusInput,
) {
  assertCanManagePayrollMoney(session);
  const input = updateBonusSchema.parse(raw);
  const existing = await repo.findBonus(session.garageId, input.bonusId);
  if (!existing) {
    throw new AppError("payroll.bonus_not_found", 404);
  }
  if (existing.payrollLineId != null) {
    throw new AppError("payroll.bonus_already_included", 409);
  }

  const updated = await repo.updateBonus({
    garageId: session.garageId,
    bonusId: input.bonusId,
    amountPaise: input.amountRupees,
    givenOn: parseDateOnly(input.givenOn),
    method: input.method,
    note: emptyNote(input.note),
  });
  if (updated.count === 0) {
    throw new AppError("payroll.bonus_already_included", 409);
  }

  await writeAuditLog({
    garageId: session.garageId,
    actorId: session.userId,
    action: "payroll.bonus_updated",
    entity: "StaffBonus",
    entityId: existing.id,
    meta: {
      userId: existing.userId,
      amountPaise: input.amountRupees,
      method: input.method,
    },
  });

  return existing.userId;
}

export async function deleteBonus(
  session: RoleSession,
  raw: DeleteBonusInput,
) {
  assertCanManagePayrollMoney(session);
  const input = deleteBonusSchema.parse(raw);
  const existing = await repo.findBonus(session.garageId, input.bonusId);
  if (!existing) {
    throw new AppError("payroll.bonus_not_found", 404);
  }
  if (existing.payrollLineId != null) {
    throw new AppError("payroll.bonus_already_included", 409);
  }

  const deleted = await repo.deleteBonus(session.garageId, input.bonusId);
  if (deleted.count === 0) {
    throw new AppError("payroll.bonus_already_included", 409);
  }

  await writeAuditLog({
    garageId: session.garageId,
    actorId: session.userId,
    action: "payroll.bonus_deleted",
    entity: "StaffBonus",
    entityId: existing.id,
    meta: {
      userId: existing.userId,
      amountPaise: existing.amountPaise,
    },
  });

  return existing.userId;
}

export async function createPayrollRun(
  session: RoleSession,
  raw: CreatePayrollRunInput,
) {
  assertCanManagePayrollMoney(session);
  const input = createPayrollRunSchema.parse(raw);
  const periodStart = parseDateOnly(input.periodStart);
  const periodEnd = parseDateOnly(input.periodEnd);

  const allMembers = await repo.listGarageUsers(session.garageId);
  const lineInputByUser = new Map(
    input.lines.map((line) => [line.userId, line]),
  );
  const selectedIds = [...lineInputByUser.keys()];
  const members = allMembers.filter((m) => lineInputByUser.has(m.id));
  if (members.length === 0) {
    throw new AppError("payroll.no_members");
  }
  if (members.length !== selectedIds.length) {
    throw new AppError("payroll.member_not_found", 404);
  }
  for (const member of members) {
    assertPayrollEligibleMember(member);
  }

  const lines: {
    userId: string;
    basicPaise: number;
    bonusPaise: number;
    commissionPaise: number;
    advanceDeductedPaise: number;
    adjustmentPaise: number;
    note: string | null;
    netPaise: number;
    bonusIds: string[];
  }[] = [];
  for (const member of members) {
    const lineInput = lineInputByUser.get(member.id)!;
    const enteredBasicPaise = lineInput.basicRupees;

    const [openAdvances, unappliedBonuses] = await Promise.all([
      repo.listOpenAdvances(session.garageId, member.id),
      repo.listUnappliedBonusesInRange(
        session.garageId,
        member.id,
        periodStart,
        periodEnd,
      ),
    ]);

    // Amount entered on Create Payroll is the basic for this period.
    const basicPaise = draftBasicPaise({
      basicSalaryPaise: enteredBasicPaise,
      payMode: "FULL_BASIC",
      periodStart,
      periodEnd,
    });
    const bonusPaise = unappliedBonuses.reduce(
      (sum, b) => sum + b.amountPaise,
      0,
    );
    const advanceDeductedPaise = openAdvances.reduce(
      (sum, a) => sum + a.remainingPaise,
      0,
    );
    const commissionPaise = 0;
    const adjustmentPaise = 0;
    const netPaise = computePayrollNetPaise({
      basicPaise,
      bonusPaise,
      commissionPaise,
      advanceDeductedPaise,
      adjustmentPaise,
    });

    lines.push({
      userId: member.id,
      basicPaise,
      bonusPaise,
      commissionPaise,
      advanceDeductedPaise,
      adjustmentPaise,
      note: emptyNote(lineInput.note),
      netPaise,
      bonusIds: unappliedBonuses.map((b) => b.id),
    });

    // Remember the amount for next time if they typed one.
    if (enteredBasicPaise > 0) {
      await repo.upsertPayProfile({
        garageId: session.garageId,
        userId: member.id,
        basicSalaryPaise: enteredBasicPaise,
        payMode: "FULL_BASIC",
      });
    }
  }

  if (lines.length === 0) {
    throw new AppError("payroll.no_members");
  }

  const run = await repo.withPayrollTransaction((tx) =>
    repo.createPayrollRunWithLines(
      {
        garageId: session.garageId,
        periodStart,
        periodEnd,
        note: null,
        createdById: session.userId,
        lines,
      },
      tx,
    ),
  );

  await writeAuditLog({
    garageId: session.garageId,
    actorId: session.userId,
    action: "payroll.run_created",
    entity: "PayrollRun",
    entityId: run.id,
    meta: {
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      lineCount: lines.length,
    },
  });

  return run;
}

export async function updatePayrollLine(
  session: RoleSession,
  raw: UpdatePayrollLineInput,
) {
  assertCanManagePayrollMoney(session);
  const input = updatePayrollLineSchema.parse(raw);
  const line = await repo.findPayrollLine(session.garageId, input.lineId);
  if (!line) {
    throw new AppError("payroll.not_found", 404);
  }
  if (line.status !== "DRAFT") {
    throw new AppError("payroll.line_already_paid");
  }

  const openAdvancePaise = await repo.sumOpenAdvancePaise(
    session.garageId,
    line.userId,
  );
  if (input.advanceDeductedRupees > openAdvancePaise) {
    throw new AppError("payroll.advance_exceeds_open");
  }

  const commissionPaise = input.commissionRupees ?? 0;
  const netPaise = computePayrollNetPaise({
    basicPaise: input.basicRupees,
    bonusPaise: input.bonusRupees,
    commissionPaise,
    advanceDeductedPaise: input.advanceDeductedRupees,
    adjustmentPaise: input.adjustmentRupees,
  });
  if (netPaise < 0) {
    throw new AppError("payroll.net_negative");
  }

  const updated = await repo.updatePayrollLineAmounts({
    garageId: session.garageId,
    lineId: line.id,
    basicPaise: input.basicRupees,
    bonusPaise: input.bonusRupees,
    commissionPaise,
    advanceDeductedPaise: input.advanceDeductedRupees,
    adjustmentPaise: input.adjustmentRupees,
    adjustmentNote: emptyNote(input.adjustmentNote),
    netPaise,
  });
  if (updated.count === 0) {
    throw new AppError("payroll.line_already_paid");
  }

  if (input.basicRupees > 0) {
    await repo.upsertPayProfile({
      garageId: session.garageId,
      userId: line.userId,
      basicSalaryPaise: input.basicRupees,
      payMode: "FULL_BASIC",
    });
  }

  await writeAuditLog({
    garageId: session.garageId,
    actorId: session.userId,
    action: "payroll.line_updated",
    entity: "PayrollLine",
    entityId: line.id,
    meta: {
      basicPaise: input.basicRupees,
      bonusPaise: input.bonusRupees,
      commissionPaise,
      advanceDeductedPaise: input.advanceDeductedRupees,
      adjustmentPaise: input.adjustmentRupees,
      netPaise,
    },
  });

  return { id: line.id, netPaise };
}

export async function markPayrollLinePaid(
  session: RoleSession,
  raw: MarkPayrollLinePaidInput,
) {
  assertCanManagePayrollMoney(session);
  const input = markPayrollLinePaidSchema.parse(raw);
  const line = await repo.findPayrollLine(session.garageId, input.lineId);
  if (!line) {
    throw new AppError("payroll.not_found", 404);
  }
  if (line.status !== "DRAFT") {
    throw new AppError("payroll.line_already_paid");
  }
  if (line.netPaise < 0) {
    throw new AppError("payroll.net_negative");
  }

  const advances = await repo.listOpenAdvances(session.garageId, line.userId);
  const openSum = advances.reduce((s, a) => s + a.remainingPaise, 0);
  if (line.advanceDeductedPaise > openSum) {
    throw new AppError("payroll.advance_exceeds_open");
  }
  const plan = planAdvanceDeductions(advances, line.advanceDeductedPaise);
  const paidAt = input.paidOn
    ? parseDateOnly(input.paidOn)
    : new Date();

  try {
    await repo.withPayrollTransaction(async (tx) => {
      const result = await repo.markPayrollLinePaidInTx(tx, {
        garageId: session.garageId,
        lineId: line.id,
        method: input.method,
        paidById: session.userId,
        paidAt,
        advancePlan: plan,
      });
      if (!result.ok) {
        throw new AppError("payroll.line_already_paid");
      }
      await repo.closeRunIfAllPaid(tx, session.garageId, line.payrollRunId);
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ADVANCE_CONFLICT") {
      throw new AppError("payroll.advance_conflict");
    }
    throw error;
  }

  await writeAuditLog({
    garageId: session.garageId,
    actorId: session.userId,
    action: "payroll.line_paid",
    entity: "PayrollLine",
    entityId: line.id,
    meta: {
      userId: line.userId,
      netPaise: line.netPaise,
      method: input.method,
      paidAt: paidAt.toISOString(),
      advanceDeductedPaise: line.advanceDeductedPaise,
    },
  });

  return { id: line.id };
}

export async function unmarkPayrollLinePaid(
  session: RoleSession,
  raw: UnmarkPayrollLinePaidInput,
) {
  assertCanManagePayrollMoney(session);
  const input = unmarkPayrollLinePaidSchema.parse(raw);
  const line = await repo.findPayrollLine(session.garageId, input.lineId);
  if (!line) {
    throw new AppError("payroll.not_found", 404);
  }
  if (line.status !== "PAID") {
    throw new AppError("payroll.line_not_paid");
  }

  const advances = await repo.listAdvancesForRestore(
    session.garageId,
    line.userId,
  );
  const plan = planAdvanceRestores(advances, line.advanceDeductedPaise);

  try {
    await repo.withPayrollTransaction(async (tx) => {
      const result = await repo.unmarkPayrollLinePaidInTx(tx, {
        garageId: session.garageId,
        lineId: line.id,
        payrollRunId: line.payrollRunId,
        advancePlan: plan,
      });
      if (!result.ok) {
        throw new AppError("payroll.line_not_paid");
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ADVANCE_CONFLICT") {
      throw new AppError("payroll.advance_conflict");
    }
    throw error;
  }

  await writeAuditLog({
    garageId: session.garageId,
    actorId: session.userId,
    action: "payroll.line_unpaid",
    entity: "PayrollLine",
    entityId: line.id,
    meta: {
      userId: line.userId,
      netPaise: line.netPaise,
      advanceRestoredPaise: line.advanceDeductedPaise,
    },
  });

  return { id: line.id };
}

export async function deletePayrollLine(
  session: RoleSession,
  raw: DeletePayrollLineInput,
) {
  assertCanManagePayrollMoney(session);
  const input = deletePayrollLineSchema.parse(raw);
  const line = await repo.findPayrollLine(session.garageId, input.lineId);
  if (!line) {
    throw new AppError("payroll.not_found", 404);
  }

  const advances =
    line.status === "PAID"
      ? await repo.listAdvancesForRestore(session.garageId, line.userId)
      : [];
  const plan =
    line.status === "PAID"
      ? planAdvanceRestores(advances, line.advanceDeductedPaise)
      : [];

  try {
    await repo.withPayrollTransaction(async (tx) => {
      const result = await repo.deletePayrollLineInTx(tx, {
        garageId: session.garageId,
        lineId: line.id,
        payrollRunId: line.payrollRunId,
        advancePlan: plan,
      });
      if (!result.ok) {
        throw new AppError("payroll.not_found", 404);
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ADVANCE_CONFLICT") {
      throw new AppError("payroll.advance_conflict");
    }
    throw error;
  }

  await writeAuditLog({
    garageId: session.garageId,
    actorId: session.userId,
    action: "payroll.line_deleted",
    entity: "PayrollLine",
    entityId: line.id,
    meta: {
      userId: line.userId,
      status: line.status,
      netPaise: line.netPaise,
    },
  });

  return { id: line.id };
}

export async function getPayrollRunForGarage(
  session: RoleSession,
  requestedGarageId: string,
  runId: string,
) {
  if (requestedGarageId !== session.garageId) {
    throw new ForbiddenError();
  }
  assertCanManagePayrollMoney(session);
  return repo.findPayrollRun(session.garageId, runId);
}

export function parsePayrollRunId(raw: unknown) {
  return payrollRunIdSchema.parse(raw);
}

async function buildDraftLineForMember(input: {
  garageId: string;
  member: { id: string };
  periodStart: Date;
  periodEnd: Date;
  basicSalaryPaise: number;
  bonusPaise?: number;
  advanceDeductedPaise?: number;
  adjustmentPaise?: number;
  adjustmentNote?: string | null;
}) {
  const [openAdvances, unappliedBonuses] = await Promise.all([
    repo.listOpenAdvances(input.garageId, input.member.id),
    repo.listUnappliedBonusesInRange(
      input.garageId,
      input.member.id,
      input.periodStart,
      input.periodEnd,
    ),
  ]);
  const basicPaise = draftBasicPaise({
    basicSalaryPaise: input.basicSalaryPaise,
    payMode: "FULL_BASIC",
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
  });
  const defaultBonusPaise = unappliedBonuses.reduce(
    (sum, b) => sum + b.amountPaise,
    0,
  );
  const openAdvancePaise = openAdvances.reduce(
    (sum, a) => sum + a.remainingPaise,
    0,
  );
  const bonusPaise =
    input.bonusPaise !== undefined ? input.bonusPaise : defaultBonusPaise;
  const advanceDeductedPaise =
    input.advanceDeductedPaise !== undefined
      ? input.advanceDeductedPaise
      : openAdvancePaise;
  if (advanceDeductedPaise > openAdvancePaise) {
    throw new AppError("payroll.advance_exceeds_open");
  }
  const commissionPaise = 0;
  const adjustmentPaise = input.adjustmentPaise ?? 0;
  const netPaise = computePayrollNetPaise({
    basicPaise,
    bonusPaise,
    commissionPaise,
    advanceDeductedPaise,
    adjustmentPaise,
  });
  if (netPaise < 0) {
    throw new AppError("payroll.net_negative");
  }
  return {
    userId: input.member.id,
    basicPaise,
    bonusPaise,
    commissionPaise,
    advanceDeductedPaise,
    adjustmentPaise,
    note: emptyNote(input.adjustmentNote),
    netPaise,
    bonusIds: unappliedBonuses.map((b) => b.id),
  };
}

export async function getPayrollManagement(
  session: RoleSession,
  raw: PayrollManagementQueryInput,
) {
  assertCanManagePayrollMoney(session);
  const query = payrollManagementQuerySchema.parse(raw);
  const allMonths = query.yearMonth === "all";
  const period = allMonths
    ? null
    : periodFromYearMonth(query.yearMonth);
  const memberFilter =
    query.memberId && query.memberId.length > 0 ? query.memberId : undefined;

  const [allMembers, profiles, rawLines, openAdvances, monthRun] =
    await Promise.all([
      repo.listGarageUsers(session.garageId),
      repo.listPayProfiles(session.garageId),
      repo.listPayrollLinesForGarage(
        session.garageId,
        period
          ? { periodStart: period.periodStart, periodEnd: period.periodEnd }
          : undefined,
      ),
      repo.listOpenAdvancesForGarage(session.garageId),
      period
        ? repo.findPayrollRunByPeriod(
            session.garageId,
            period.periodStart,
            period.periodEnd,
          )
        : Promise.resolve(null),
    ]);

  const eligible = allMembers.filter((m) => isPayrollEligibleRole(m.role));
  const profileByUser = new Map(profiles.map((p) => [p.userId, p]));
  const lines = rawLines.filter((line) => {
    if (memberFilter && line.userId !== memberFilter) return false;
    if (query.status === "DRAFT" && line.status !== "DRAFT") return false;
    if (query.status === "PAID" && line.status !== "PAID") return false;
    return true;
  });

  const totalPayrollPaise = lines.reduce((s, l) => s + l.netPaise, 0);
  const paidPaise = lines
    .filter((l) => l.status === "PAID")
    .reduce((s, l) => s + l.netPaise, 0);
  const pendingPaise = lines
    .filter((l) => l.status === "DRAFT")
    .reduce((s, l) => s + l.netPaise, 0);
  const outstandingAdvancesPaise = openAdvances
    .filter((a) => !memberFilter || a.userId === memberFilter)
    .reduce((s, a) => s + a.remainingPaise, 0);

  const openAdvanceByUser = new Map<string, number>();
  for (const advance of openAdvances) {
    openAdvanceByUser.set(
      advance.userId,
      (openAdvanceByUser.get(advance.userId) ?? 0) + advance.remainingPaise,
    );
  }

  const monthLineUserIds = new Set(
    (monthRun?.lines ?? []).map((l) => l.userId),
  );

  return {
    yearMonth: query.yearMonth,
    periodStart: period?.periodStart ?? null,
    periodEnd: period?.periodEnd ?? null,
    runId: monthRun?.id ?? null,
    runStatus: monthRun?.status ?? null,
    members: eligible.map((m) => ({
      id: m.id,
      label: m.name?.trim() || m.email,
      basicSalaryPaise: profileByUser.get(m.id)?.basicSalaryPaise ?? 0,
      openAdvancePaise: openAdvanceByUser.get(m.id) ?? 0,
    })),
    lines: lines.map((line) => ({
      id: line.id,
      userId: line.userId,
      memberName: line.user.name?.trim() || line.user.email,
      periodStart: line.payrollRun.periodStart,
      periodEnd: line.payrollRun.periodEnd,
      basicPaise: line.basicPaise,
      bonusPaise: line.bonusPaise,
      commissionPaise: line.commissionPaise,
      advanceDeductedPaise: line.advanceDeductedPaise,
      openAdvancePaise: openAdvanceByUser.get(line.userId) ?? 0,
      adjustmentPaise: line.adjustmentPaise,
      adjustmentNote: line.adjustmentNote,
      netPaise: line.netPaise,
      status: line.status,
      paidAt: line.paidAt,
      paidMethod: line.paidMethod,
    })),
    addedMemberIds: [...monthLineUserIds],
    missingMemberCount: eligible.filter((m) => !monthLineUserIds.has(m.id))
      .length,
    summary: {
      totalPayrollPaise,
      paidPaise,
      pendingPaise,
      outstandingAdvancesPaise,
    },
    openAdvances: openAdvances
      .filter((a) => !memberFilter || a.userId === memberFilter)
      .map((a) => ({
        id: a.id,
        userId: a.userId,
        memberName: a.user.name?.trim() || a.user.email,
        remainingPaise: a.remainingPaise,
        amountPaise: a.amountPaise,
      })),
  };
}

function memberLabel(user: {
  name: string | null;
  email: string;
}): string {
  return user.name?.trim() || user.email;
}

export async function listPayrollBonuses(
  session: RoleSession,
  raw: PayrollMoneyListQueryInput,
) {
  assertCanManagePayrollMoney(session);
  const query = payrollMoneyListQuerySchema.parse(raw);
  const { periodStart, periodEnd } = periodFromYearMonth(query.yearMonth);
  const memberFilter =
    query.memberId && query.memberId.length > 0 ? query.memberId : undefined;

  const [allMembers, bonuses] = await Promise.all([
    repo.listGarageUsers(session.garageId),
    repo.listBonusesInRange(
      session.garageId,
      periodStart,
      periodEnd,
      memberFilter,
    ),
  ]);
  const eligible = allMembers.filter((m) => isPayrollEligibleRole(m.role));

  return {
    yearMonth: query.yearMonth,
    members: eligible.map((m) => ({
      id: m.id,
      label: memberLabel(m),
    })),
    bonuses: bonuses.map((b) => ({
      id: b.id,
      userId: b.userId,
      memberName: memberLabel(b.user),
      amountPaise: b.amountPaise,
      givenOn: b.givenOn,
      method: b.method,
      note: b.note,
      inclusion:
        b.payrollLineId == null
          ? ("pending" as const)
          : b.payrollLine?.status === "PAID"
            ? ("paid" as const)
            : ("included" as const),
    })),
  };
}

export async function listPayrollAdvances(
  session: RoleSession,
  raw: PayrollMoneyListQueryInput,
) {
  assertCanManagePayrollMoney(session);
  const query = payrollMoneyListQuerySchema.parse(raw);
  const { periodStart, periodEnd } = periodFromYearMonth(query.yearMonth);
  const memberFilter =
    query.memberId && query.memberId.length > 0 ? query.memberId : undefined;

  const [allMembers, advancesMonth] = await Promise.all([
    repo.listGarageUsers(session.garageId),
    repo.listAdvancesInRange(
      session.garageId,
      periodStart,
      periodEnd,
      memberFilter,
    ),
  ]);
  const eligible = allMembers.filter((m) => isPayrollEligibleRole(m.role));

  return {
    yearMonth: query.yearMonth,
    members: eligible.map((m) => ({
      id: m.id,
      label: memberLabel(m),
    })),
    advances: advancesMonth.map((a) => ({
      id: a.id,
      userId: a.userId,
      memberName: memberLabel(a.user),
      amountPaise: a.amountPaise,
      remainingPaise: a.remainingPaise,
      recoveredPaise: a.amountPaise - a.remainingPaise,
      givenOn: a.givenOn,
      method: a.method,
      note: a.note,
      status:
        a.remainingPaise <= 0
          ? ("recovered" as const)
          : a.remainingPaise >= a.amountPaise
            ? ("pending" as const)
            : ("partial" as const),
    })),
  };
}

export async function getAddPayrollForm(
  session: RoleSession,
  yearMonth: string,
) {
  assertCanManagePayrollMoney(session);
  const parsed = yearMonthSchemaSafe(yearMonth);
  const { periodStart, periodEnd } = periodFromYearMonth(parsed);
  const [allMembers, profiles, run, openAdvances, bonusesMonth] =
    await Promise.all([
      repo.listGarageUsers(session.garageId),
      repo.listPayProfiles(session.garageId),
      repo.findPayrollRunByPeriod(session.garageId, periodStart, periodEnd),
      repo.listOpenAdvancesForGarage(session.garageId),
      repo.listBonusesInRange(session.garageId, periodStart, periodEnd),
    ]);
  const addedIds = new Set((run?.lines ?? []).map((l) => l.userId));
  const eligible = allMembers.filter(
    (m) => isPayrollEligibleRole(m.role) && !addedIds.has(m.id),
  );
  const profileByUser = new Map(profiles.map((p) => [p.userId, p]));
  const openAdvanceByUser = new Map<string, number>();
  for (const advance of openAdvances) {
    openAdvanceByUser.set(
      advance.userId,
      (openAdvanceByUser.get(advance.userId) ?? 0) + advance.remainingPaise,
    );
  }
  const pendingBonusByUser = new Map<string, { count: number; paise: number }>();
  for (const bonus of bonusesMonth) {
    if (bonus.payrollLineId != null) continue;
    const prev = pendingBonusByUser.get(bonus.userId) ?? {
      count: 0,
      paise: 0,
    };
    pendingBonusByUser.set(bonus.userId, {
      count: prev.count + 1,
      paise: prev.paise + bonus.amountPaise,
    });
  }

  const members = eligible.map((member) => {
    const pending = pendingBonusByUser.get(member.id);
    return {
      id: member.id,
      label: memberLabel(member),
      basicSalaryPaise: profileByUser.get(member.id)?.basicSalaryPaise ?? 0,
      openAdvancePaise: openAdvanceByUser.get(member.id) ?? 0,
      pendingBonusPaise: pending?.paise ?? 0,
      pendingBonusCount: pending?.count ?? 0,
    };
  });

  return { yearMonth: parsed, members };
}

function yearMonthSchemaSafe(yearMonth: string) {
  if (!/^\d{4}-\d{2}$/.test(yearMonth.trim())) {
    throw new AppError("payroll.not_found", 400);
  }
  return yearMonth.trim();
}

export async function generateMonthPayroll(
  session: RoleSession,
  raw: GenerateMonthPayrollInput,
) {
  assertCanManagePayrollMoney(session);
  const input = generateMonthPayrollSchema.parse(raw);
  const { periodStart, periodEnd } = periodFromYearMonth(input.yearMonth);

  const [allMembers, existing] = await Promise.all([
    repo.listGarageUsers(session.garageId),
    repo.findPayrollRunByPeriod(session.garageId, periodStart, periodEnd),
  ]);
  const eligibleById = new Map(
    allMembers
      .filter((m) => isPayrollEligibleRole(m.role))
      .map((m) => [m.id, m]),
  );
  const existingUserIds = new Set((existing?.lines ?? []).map((l) => l.userId));
  const selectedIds = [...new Set(input.lines.map((l) => l.userId))];
  if (selectedIds.length !== input.lines.length) {
    throw new AppError("payroll.member_not_found", 400);
  }

  const draftLines: Awaited<ReturnType<typeof buildDraftLineForMember>>[] = [];
  for (const lineInput of input.lines) {
    const member = eligibleById.get(lineInput.userId);
    if (!member) {
      throw new AppError("payroll.owner_not_payable", 400);
    }
    if (existingUserIds.has(member.id)) {
      continue;
    }
    draftLines.push(
      await buildDraftLineForMember({
        garageId: session.garageId,
        member,
        periodStart,
        periodEnd,
        basicSalaryPaise: lineInput.basicRupees,
        bonusPaise: lineInput.bonusRupees,
        advanceDeductedPaise: lineInput.advanceDeductedRupees,
        adjustmentPaise: lineInput.adjustmentRupees,
        adjustmentNote: lineInput.adjustmentNote,
      }),
    );
  }

  if (draftLines.length === 0) {
    throw new AppError("payroll.members_already_added");
  }

  for (const line of draftLines) {
    if (line.basicPaise > 0) {
      await repo.upsertPayProfile({
        garageId: session.garageId,
        userId: line.userId,
        basicSalaryPaise: line.basicPaise,
        payMode: "FULL_BASIC",
      });
    }
  }

  if (!existing) {
    const run = await repo.withPayrollTransaction((tx) =>
      repo.createPayrollRunWithLines(
        {
          garageId: session.garageId,
          periodStart,
          periodEnd,
          note: null,
          createdById: session.userId,
          lines: draftLines,
        },
        tx,
      ),
    );
    await writeAuditLog({
      garageId: session.garageId,
      actorId: session.userId,
      action: "payroll.run_created",
      entity: "PayrollRun",
      entityId: run.id,
      meta: {
        yearMonth: input.yearMonth,
        lineCount: draftLines.length,
      },
    });
    return run;
  }

  await repo.withPayrollTransaction((tx) =>
    repo.addPayrollLinesToRun(
      {
        garageId: session.garageId,
        payrollRunId: existing.id,
        lines: draftLines,
      },
      tx,
    ),
  );

  if (existing.status === "CLOSED") {
    await repo.withPayrollTransaction(async (tx) => {
      await tx.payrollRun.updateMany({
        where: { id: existing.id, garageId: session.garageId },
        data: { status: "OPEN" },
      });
    });
  }

  await writeAuditLog({
    garageId: session.garageId,
    actorId: session.userId,
    action: "payroll.run_lines_added",
    entity: "PayrollRun",
    entityId: existing.id,
    meta: {
      yearMonth: input.yearMonth,
      lineCount: draftLines.length,
    },
  });

  return repo.findPayrollRun(session.garageId, existing.id);
}
