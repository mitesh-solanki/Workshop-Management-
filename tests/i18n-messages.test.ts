import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");
const locales = ["en", "hi", "gu"] as const;

function flatten(
  value: unknown,
  prefix = "",
  out = new Map<string, unknown>(),
): Map<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    out.set(prefix, value);
    return out;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    flatten(child, path, out);
  }
  return out;
}

function load(locale: string) {
  return JSON.parse(
    readFileSync(join(root, "messages", `${locale}.json`), "utf8"),
  ) as unknown;
}

describe("i18n message files", () => {
  const maps = Object.fromEntries(
    locales.map((locale) => [locale, flatten(load(locale))]),
  ) as Record<(typeof locales)[number], Map<string, unknown>>;

  it("en, hi and gu share the same key set", () => {
    const enKeys = [...maps.en.keys()].sort();
    expect([...maps.hi.keys()].sort()).toEqual(enKeys);
    expect([...maps.gu.keys()].sort()).toEqual(enKeys);
  });

  it("has no empty string values in any locale", () => {
    for (const locale of locales) {
      for (const [key, value] of maps[locale]) {
        expect(typeof value, `${locale}.${key}`).toBe("string");
        expect(String(value).trim().length, `${locale}.${key}`).toBeGreaterThan(
          0,
        );
      }
    }
  });

  it("hi and gu error/generic strings are not English copies of en", () => {
    const enError = maps.en.get("common.error");
    expect(maps.hi.get("common.error")).not.toBe(enError);
    expect(maps.gu.get("common.error")).not.toBe(enError);
  });
});
