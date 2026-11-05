import type { StaffPayMode } from "@prisma/client";
import { add, type Paise } from "@/lib/money";

/** Inclusive calendar day count between two UTC-date midnights. */
export function inclusiveDayCount(periodStart: Date, periodEnd: Date): number {
  const start = Date.UTC(
    periodStart.getUTCFullYear(),
    periodStart.getUTCMonth(),
    periodStart.getUTCDate(),
  );
  const end = Date.UTC(
    periodEnd.getUTCFullYear(),
    periodEnd.getUTCMonth(),
    periodEnd.getUTCDate(),
  );
  if (end < start) return 0;
  return Math.floor((end - start) / 86_400_000) + 1;
}

export function defaultMonthPeriod(now = new Date()): {
  periodStart: Date;
  periodEnd: Date;
} {
  const y = now.getFullYear();
  const m = now.getMonth();
  const periodStart = new Date(Date.UTC(y, m, 1));
  const periodEnd = new Date(Date.UTC(y, m + 1, 0));
  return { periodStart, periodEnd };
}

/**
 * Draft basic for a period.
 * Always the full monthly basic (attendance-based pay was removed).
 */
export function draftBasicPaise(input: {
  basicSalaryPaise: Paise;
  payMode: StaffPayMode;
  periodStart: Date;
  periodEnd: Date;
}): Paise {
  return Math.max(0, Math.round(input.basicSalaryPaise));
}

export function computePayrollNetPaise(input: {
  basicPaise: Paise;
  bonusPaise: Paise;
  commissionPaise: Paise;
  advanceDeductedPaise: Paise;
  adjustmentPaise: Paise;
}): Paise {
  return add(
    Math.round(input.basicPaise),
    Math.round(input.bonusPaise),
    Math.round(input.commissionPaise),
    -Math.round(input.advanceDeductedPaise),
    Math.round(input.adjustmentPaise),
  );
}

/** FIFO deduction plan across open advances. */
export function planAdvanceDeductions(
  advances: readonly { id: string; remainingPaise: Paise }[],
  deductPaise: Paise,
): { id: string; deductPaise: Paise }[] {
  let left = Math.max(0, Math.round(deductPaise));
  const plan: { id: string; deductPaise: Paise }[] = [];
  for (const advance of advances) {
    if (left <= 0) break;
    const remaining = Math.max(0, Math.round(advance.remainingPaise));
    if (remaining <= 0) continue;
    const take = Math.min(remaining, left);
    plan.push({ id: advance.id, deductPaise: take });
    left -= take;
  }
  return plan;
}

/**
 * Restore previously deducted advance paise (newest first into room under amount).
 * Pass advances newest-first for LIFO restore after FIFO deduct.
 */
export function planAdvanceRestores(
  advances: readonly {
    id: string;
    amountPaise: Paise;
    remainingPaise: Paise;
  }[],
  restorePaise: Paise,
): { id: string; restorePaise: Paise }[] {
  let left = Math.max(0, Math.round(restorePaise));
  const plan: { id: string; restorePaise: Paise }[] = [];
  for (const advance of advances) {
    if (left <= 0) break;
    const amount = Math.max(0, Math.round(advance.amountPaise));
    const remaining = Math.max(0, Math.round(advance.remainingPaise));
    const room = Math.max(0, amount - remaining);
    if (room <= 0) continue;
    const take = Math.min(room, left);
    plan.push({ id: advance.id, restorePaise: take });
    left -= take;
  }
  return plan;
}
