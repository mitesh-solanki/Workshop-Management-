"use server";

import { getTranslations } from "next-intl/server";
import { translateError } from "@/lib/translate-error";
import { requireSession } from "@/lib/session";
import { toMoneyReportCardState } from "@/modules/reports/money-card-state";
import type { MoneyReportCardState } from "@/modules/reports/money-card-state";
import type { DetailReportCardView } from "@/modules/reports/detail-types";
import {
  getDetailReportCard,
  getMoneyReportCard,
} from "@/modules/reports/service";
import {
  DETAIL_REPORT_KEYS,
  REPORT_CARD_KEYS,
  REPORT_PERIODS,
  type DetailReportKey,
  type ReportCardKey,
  type ReportPeriod,
} from "@/modules/reports/schema";

function parseMoneyKey(value: string): ReportCardKey | null {
  return REPORT_CARD_KEYS.includes(value as ReportCardKey)
    ? (value as ReportCardKey)
    : null;
}

function parseDetailKey(value: string): DetailReportKey | null {
  return DETAIL_REPORT_KEYS.includes(value as DetailReportKey)
    ? (value as DetailReportKey)
    : null;
}

function parsePeriod(value: string): ReportPeriod | null {
  return REPORT_PERIODS.includes(value as ReportPeriod)
    ? (value as ReportPeriod)
    : null;
}

export async function loadMoneyReportCardAction(
  key: string,
  period: string,
): Promise<{ ok: true; card: MoneyReportCardState } | { ok: false; message: string }> {
  const cardKey = parseMoneyKey(key);
  const cardPeriod = parsePeriod(period);
  if (!cardKey || !cardPeriod) {
    const t = await getTranslations("reports");
    return { ok: false, message: t("loadError") };
  }

  try {
    const session = await requireSession();
    const card = await getMoneyReportCard(session, cardKey, cardPeriod);
    return { ok: true, card: toMoneyReportCardState(card) };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}

export async function loadDetailReportCardAction(
  key: string,
  period: string,
): Promise<
  { ok: true; card: DetailReportCardView } | { ok: false; message: string }
> {
  const cardKey = parseDetailKey(key);
  const cardPeriod = parsePeriod(period);
  if (!cardKey || !cardPeriod) {
    const t = await getTranslations("reports");
    return { ok: false, message: t("loadError") };
  }

  try {
    const session = await requireSession();
    const card = await getDetailReportCard(session, cardKey, cardPeriod);
    return { ok: true, card };
  } catch (error) {
    return { ok: false, message: await translateError(error) };
  }
}
