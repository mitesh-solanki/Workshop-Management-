export type ShopReceiveParsedLine = {
  vendorId: string;
  quantity: number;
};

/** Reads multi-line Bought From fields; skips blank vendor rows. */
export function parseShopReceiveLines(
  formData: FormData,
): ShopReceiveParsedLine[] {
  const countRaw = String(formData.get("shopLineCount") ?? "0").trim();
  const count = Number(countRaw);
  if (!Number.isFinite(count) || count <= 0) {
    return [];
  }
  const lines: ShopReceiveParsedLine[] = [];
  for (let i = 0; i < count; i += 1) {
    const vendorId = String(formData.get(`shopVendorId_${i}`) ?? "").trim();
    if (!vendorId) {
      continue;
    }
    const qtyRaw = String(formData.get(`shopQty_${i}`) ?? "").trim();
    const quantity = qtyRaw === "" ? 0 : Number(qtyRaw);
    lines.push({
      vendorId,
      quantity: Number.isFinite(quantity) ? quantity : 0,
    });
  }
  return lines;
}

export type ShopReceiveLineLike = {
  key: string;
  vendorId: string;
  quantity: number;
};

/**
 * Job-card part create/edit: at least one vendor required.
 * Blank extra rows are ignored — only the first empty row errors when none filled.
 */
export function shopReceiveRequiredVendorErrorKeys(
  lines: ShopReceiveLineLike[],
): string[] {
  const filled = lines.filter((line) => line.vendorId.trim());
  if (filled.length > 0) {
    const badQty = filled.filter((line) => line.quantity < 1);
    return badQty.map((line) => line.key);
  }
  const firstKey = lines[0]?.key;
  return firstKey ? [firstKey] : [];
}

export type ShopReceiveFileLine = ShopReceiveLineLike & {
  file: File | null;
};

/** Files in the same order as shop lines that have vendor + qty (for post-save upload). */
export function shopReceiveFilesForUpload(
  lines: ShopReceiveFileLine[],
): Array<File | null> {
  return lines
    .filter((line) => line.vendorId.trim() && line.quantity > 0)
    .map((line) => line.file);
}

/** Invisible marker linking a stock-in note to its VendorBill row. */
const SHOP_RECEIVE_BILL_MARKER =
  /\u2060vb:([a-zA-Z0-9_-]+)\u2060/;

export function withShopReceiveBillId(note: string, vendorBillId: string) {
  const id = vendorBillId.trim();
  if (!id) return note;
  return `${note}\u2060vb:${id}\u2060`;
}

export function parseShopReceiveBillId(note: string | null | undefined) {
  if (!note) return null;
  const match = note.match(SHOP_RECEIVE_BILL_MARKER);
  return match?.[1] ?? null;
}

export function displayShopReceiveNote(note: string | null | undefined) {
  if (!note) return null;
  let cleaned = note.replace(SHOP_RECEIVE_BILL_MARKER, "").trim();
  // Legacy notes used a full sentence; show vendor name only in Bought From.
  cleaned = cleaned.replace(/^Bought from\s+/i, "");
  cleaned = cleaned.replace(/\s+से खरीदा$/u, "");
  cleaned = cleaned.replace(/\s+પાસેથી ખરીદ્યું$/u, "");
  return cleaned.trim() || null;
}
