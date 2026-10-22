import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = join(__dirname, "..", "src", "app");

/** Match JSX text nodes like >Hello world< (not `{t("…")}`). */
const JSX_TEXT = />\s*([A-Za-z][^<{]{2,})\s*</g;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (/\.(tsx|jsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

describe("app route JSX literals", () => {
  it("has no obvious hard-coded English text nodes in src/app", () => {
    const offenders: string[] = [];
    for (const file of walk(appRoot)) {
      const source = readFileSync(file, "utf8");
      // Strip comments so examples in comments do not fail the check.
      const withoutComments = source
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      for (const match of withoutComments.matchAll(JSX_TEXT)) {
        const text = match[1]?.trim() ?? "";
        if (!text || /^[\d\s.:|·—–…/\-]+$/.test(text)) continue;
        // Arrow functions (`=>`) produce false positives between `>` and the next `<`.
        if (/===|=>|return\s*\(|const\s+\w+\s*=/.test(text)) continue;
        offenders.push(`${relative(appRoot, file)}: "${text}"`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
