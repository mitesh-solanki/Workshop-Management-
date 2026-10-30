import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { JOB_CARD_SECTIONS } from "@/modules/service-orders/job-card-sections";
import { SERVICE_ORDER_STATUSES } from "@/modules/service-orders/schema";
import {
  CREDIT_NOTE_REASONS,
  INVOICE_LINE_TYPES,
} from "@/modules/billing/schema";
import { ESTIMATE_LINE_TYPES } from "@/modules/estimates/schema";

const root = join(__dirname, "..");
const locales = ["en", "hi", "gu"] as const;

const JOB_CARD_SOURCE_DIRS = [
  "src/modules/service-orders/components",
  "src/modules/estimates/components",
  "src/modules/billing/components",
  "src/modules/inspections/components",
  "src/modules/live-link/components",
  "src/app/(app)/orders",
] as const;

const JOB_CARD_NAMESPACES = [
  "orders",
  "estimates",
  "billing",
  "inspections",
  "liveLink",
  "inventory",
  "customers",
  "common",
  "gst",
  "errors",
] as const;

function flatten(
  value: unknown,
  prefix = "",
  out = new Map<string, string>(),
): Map<string, string> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    out.set(prefix, String(value ?? ""));
    return out;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    flatten(child, prefix ? `${prefix}.${key}` : key, out);
  }
  return out;
}

function load(locale: string) {
  return JSON.parse(
    readFileSync(join(root, "messages", `${locale}.json`), "utf8"),
  ) as unknown;
}

function walkTsFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) walkTsFiles(full, out);
    else if (/\.(tsx|ts)$/.test(ent.name)) out.push(full);
  }
  return out;
}

function collectTranslationCalls(source: string): Array<{
  namespace: string;
  key: string;
}> {
  const nsMap = new Map<string, string>();
  const nsRe =
    /(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*["']([^"']+)["']\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = nsRe.exec(source))) {
    nsMap.set(match[1]!, match[2]!);
  }

  const calls: Array<{ namespace: string; key: string }> = [];
  for (const [varName, namespace] of nsMap) {
    const callRe = new RegExp(
      `(?<![A-Za-z0-9_])${varName}\\(\\s*["']([^"'{]+)["']`,
      "g",
    );
    let call: RegExpExecArray | null;
    while ((call = callRe.exec(source))) {
      calls.push({ namespace, key: call[1]! });
    }
  }
  return calls;
}

function icuPlaceholders(message: string): string[] {
  const found = new Set<string>();
  const re = /\{([a-zA-Z0-9_]+)(?:,[^}]*)?\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(message))) {
    found.add(match[1]!);
  }
  return [...found].sort();
}

const maps = Object.fromEntries(
  locales.map((locale) => [locale, flatten(load(locale))]),
) as Record<(typeof locales)[number], Map<string, string>>;

describe("job card i18n", () => {
  it("keeps en/hi/gu key parity for job-card namespaces", () => {
    for (const ns of JOB_CARD_NAMESPACES) {
      const enKeys = [...maps.en.keys()]
        .filter((key) => key === ns || key.startsWith(`${ns}.`))
        .sort();
      expect(
        [...maps.hi.keys()]
          .filter((key) => key === ns || key.startsWith(`${ns}.`))
          .sort(),
      ).toEqual(enKeys);
      expect(
        [...maps.gu.keys()]
          .filter((key) => key === ns || key.startsWith(`${ns}.`))
          .sort(),
      ).toEqual(enKeys);
    }
  });

  it("has section nav, titles and hints for every job-card section", () => {
    for (const section of JOB_CARD_SECTIONS) {
      expect(maps.en.has(`orders.sectionNav.${section}`)).toBe(true);
    }

    const required = [
      "orders.details",
      "orders.detailsHint",
      "orders.lines",
      "orders.linesDescription",
      "orders.estimateHint",
      "orders.billingHint",
      "orders.timeline",
      "orders.timelineHint",
      "orders.timelineEmpty",
      "orders.timelineCreated",
      "orders.timelineStatusChanged",
      "orders.timelineLineAdded",
      "orders.timelineLineUpdated",
      "orders.timelineLineRemoved",
      "orders.timelineUpdated",
      "orders.timelineUnknownActor",
      "inspections.title",
      "inspections.listTitle",
      "inspections.newInspection",
      "estimates.title",
      "billing.title",
      "liveLink.embedTitle",
      "liveLink.embedHint",
      "billing.creditNotesHistoryTitle",
      "billing.creditNotesHistoryHint",
      "billing.creditNoteMessageLabel",
      "billing.errors.creditNoteNeedItem",
      "errors.validation.hsnOrSac",
    ];

    for (const key of required) {
      for (const locale of locales) {
        const value = maps[locale].get(key);
        expect(value, `${locale}:${key}`).toBeTypeOf("string");
        expect(String(value).trim().length, `${locale}:${key}`).toBeGreaterThan(
          0,
        );
      }
    }
  });

  it("covers status, line-type and credit-note reason enums", () => {
    for (const status of SERVICE_ORDER_STATUSES) {
      expect(maps.en.has(`orders.statuses.${status}`)).toBe(true);
    }
    for (const type of ESTIMATE_LINE_TYPES) {
      expect(maps.en.has(`estimates.lineTypes.${type}`)).toBe(true);
      expect(maps.en.has(`orders.lineTypes.${type}`)).toBe(true);
    }
    for (const type of INVOICE_LINE_TYPES) {
      expect(maps.en.has(`orders.lineTypes.${type}`)).toBe(true);
    }
    for (const reason of CREDIT_NOTE_REASONS) {
      expect(maps.en.has(`billing.reasons.${reason}`)).toBe(true);
    }
  });

  it("resolves every static t()/getTranslations key used by job-card sources", () => {
    const files = JOB_CARD_SOURCE_DIRS.flatMap((dir) =>
      walkTsFiles(join(root, dir)),
    );
    expect(files.length).toBeGreaterThan(20);

    const missing: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const call of collectTranslationCalls(source)) {
        const full = `${call.namespace}.${call.key}`;
        if (!maps.en.has(full)) {
          missing.push(`${full} <- ${file.replace(`${root}\\`, "").replace(`${root}/`, "")}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it("keeps ICU placeholders aligned across locales for timeline and credit-note strings", () => {
    const keys = [
      "orders.timelineCreated",
      "orders.timelineStatusChanged",
      "orders.timelineLineAdded",
      "orders.timelineLineUpdated",
      "orders.timelineLineRemoved",
      "billing.creditNoteLine",
      "estimates.permissionCount",
    ].filter((key) => maps.en.has(key));

    for (const key of keys) {
      const enPlaceholders = icuPlaceholders(maps.en.get(key)!);
      expect(icuPlaceholders(maps.hi.get(key)!), `hi:${key}`).toEqual(
        enPlaceholders,
      );
      expect(icuPlaceholders(maps.gu.get(key)!), `gu:${key}`).toEqual(
        enPlaceholders,
      );
    }
  });
});
