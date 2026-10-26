/**
 * Build a catalogue SKU from a part name for create forms.
 * Uppercase, hyphen-separated tokens, max 64 chars (matches skuField length).
 */
export function skuFromPartName(name: string): string {
  const cleaned = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned.slice(0, 64);
}
