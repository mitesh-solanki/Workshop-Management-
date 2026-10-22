#!/usr/bin/env node
/**
 * Fails if en.json, hi.json and gu.json have different key sets
 * or if any leaf value is empty / whitespace-only.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const locales = ["en", "hi", "gu"];

function flatten(value, prefix = "", out = new Map()) {
  if (value === null || value === undefined) {
    out.set(prefix, value);
    return out;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    out.set(prefix, value);
    return out;
  }
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    flatten(child, path, out);
  }
  return out;
}

function load(locale) {
  const path = join(root, "messages", `${locale}.json`);
  return JSON.parse(readFileSync(path, "utf8"));
}

const maps = Object.fromEntries(
  locales.map((locale) => [locale, flatten(load(locale))]),
);

const keySets = Object.fromEntries(
  locales.map((locale) => [locale, new Set(maps[locale].keys())]),
);

let failed = false;

for (const locale of locales) {
  if (locale === "en") continue;
  const missing = [...keySets.en].filter((k) => !keySets[locale].has(k));
  const extra = [...keySets[locale]].filter((k) => !keySets.en.has(k));
  if (missing.length > 0) {
    failed = true;
    console.error(`[i18n:check] ${locale} missing keys:\n  ${missing.join("\n  ")}`);
  }
  if (extra.length > 0) {
    failed = true;
    console.error(`[i18n:check] ${locale} extra keys:\n  ${extra.join("\n  ")}`);
  }
}

for (const locale of locales) {
  for (const [key, value] of maps[locale]) {
    if (typeof value !== "string") {
      failed = true;
      console.error(`[i18n:check] ${locale}.${key}: expected string leaf, got ${typeof value}`);
      continue;
    }
    if (value.trim().length === 0) {
      failed = true;
      console.error(`[i18n:check] ${locale}.${key}: empty value`);
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log(
  `[i18n:check] OK — ${keySets.en.size} keys match across ${locales.join(", ")}`,
);
