import { formatRupees } from "@/lib/money";

export type TimelineMeta = Record<string, unknown>;

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function money(paise: number | null, locale: string): string | null {
  if (paise == null) {
    return null;
  }
  return formatRupees(paise, locale);
}

export type FormatOrderTimelineLabels = {
  fallbackDescription: string;
  created: (status: string) => string;
  statusChanged: (from: string, to: string) => string;
  lineAdded: (description: string, quantity: string, price: string) => string;
  lineRemoved: (description: string, quantity: string, price: string) => string;
  lineUpdated: (description: string) => string;
  lineUpdatedWithChanges: (description: string, changes: string) => string;
  changeQuantity: (from: string, to: string) => string;
  changePrice: (from: string, to: string) => string;
  changeName: (from: string, to: string) => string;
  detailsUpdated: string;
  cataloguePrices: (count: string) => string;
  billDraft: (amount: string) => string;
  billDraftNoAmount: string;
  billFinalized: (invoiceNumber: string, amount: string) => string;
  billFinalizedNoAmount: (invoiceNumber: string) => string;
  billDraftDeleted: string;
  billDeleted: (invoiceNumber: string) => string;
  billDeletedNoNumber: string;
  billLinesUpdated: (amount: string) => string;
  billLinesUpdatedNoAmount: string;
  paymentReceived: (method: string, amount: string) => string;
  refundGiven: (method: string, amount: string) => string;
  creditNote: (
    creditNoteNumber: string,
    amount: string,
    reason: string,
  ) => string;
  statusLabel: (status: string) => string;
  methodLabel: (method: string) => string;
  reasonLabel: (reason: string) => string;
};

export function formatOrderTimelineEvent(
  action: string,
  meta: TimelineMeta,
  labels: FormatOrderTimelineLabels,
  locale = "en-IN",
): string {
  if (action === "service_order.status_changed") {
    const toRaw = asString(meta.to);
    const to = toRaw ? labels.statusLabel(toRaw) : null;
    if (meta.created === true && to) {
      return labels.created(to);
    }
    const fromRaw = asString(meta.from);
    const from = fromRaw ? labels.statusLabel(fromRaw) : null;
    if (from && to) {
      return labels.statusChanged(from, to);
    }
  }

  if (action === "service_order.line_added") {
    const description =
      asString(meta.description) ?? labels.fallbackDescription;
    const quantity = String(asNumber(meta.quantity) ?? "—");
    const price =
      money(asNumber(meta.unitPricePaise), locale) ??
      money(0, locale) ??
      "—";
    return labels.lineAdded(description, quantity, price);
  }

  if (action === "service_order.line_removed") {
    const description =
      asString(meta.description) ?? labels.fallbackDescription;
    const quantity = String(asNumber(meta.quantity) ?? "—");
    const price =
      money(asNumber(meta.unitPricePaise), locale) ??
      money(0, locale) ??
      "—";
    return labels.lineRemoved(description, quantity, price);
  }

  if (action === "service_order.line_updated") {
    const description =
      asString(meta.description) ?? labels.fallbackDescription;
    const changes: string[] = [];

    const previousDescription = asString(meta.previousDescription);
    if (previousDescription && previousDescription !== description) {
      changes.push(labels.changeName(previousDescription, description));
    }

    const previousQuantity = asNumber(meta.previousQuantity);
    const quantity = asNumber(meta.quantity);
    if (
      previousQuantity != null &&
      quantity != null &&
      previousQuantity !== quantity
    ) {
      changes.push(
        labels.changeQuantity(String(previousQuantity), String(quantity)),
      );
    }

    const previousPrice = asNumber(meta.previousUnitPricePaise);
    const price = asNumber(meta.unitPricePaise);
    if (previousPrice != null && price != null && previousPrice !== price) {
      const from = money(previousPrice, locale);
      const to = money(price, locale);
      if (from && to) {
        changes.push(labels.changePrice(from, to));
      }
    }

    if (changes.length === 0) {
      return labels.lineUpdated(description);
    }
    return labels.lineUpdatedWithChanges(description, changes.join(", "));
  }

  if (action === "service_order.updated") {
    return labels.detailsUpdated;
  }

  if (action === "service_order.catalogue_prices_applied") {
    const count = asNumber(meta.count);
    return labels.cataloguePrices(String(count ?? 0));
  }

  if (action === "billing.invoice_draft_created") {
    const amount = money(asNumber(meta.totalPaise), locale);
    return amount ? labels.billDraft(amount) : labels.billDraftNoAmount;
  }

  if (action === "billing.invoice_finalized") {
    const invoiceNumber = asString(meta.invoiceNumber) ?? "—";
    const amount = money(asNumber(meta.totalPaise), locale);
    return amount
      ? labels.billFinalized(invoiceNumber, amount)
      : labels.billFinalizedNoAmount(invoiceNumber);
  }

  if (action === "billing.invoice_draft_deleted") {
    return labels.billDraftDeleted;
  }

  if (action === "billing.invoice_deleted") {
    const invoiceNumber = asString(meta.invoiceNumber);
    return invoiceNumber
      ? labels.billDeleted(invoiceNumber)
      : labels.billDeletedNoNumber;
  }

  if (action === "billing.invoice_lines_updated") {
    const amount = money(asNumber(meta.totalPaise), locale);
    return amount
      ? labels.billLinesUpdated(amount)
      : labels.billLinesUpdatedNoAmount;
  }

  if (action === "billing.payment_recorded") {
    const methodRaw = asString(meta.method) ?? "CASH";
    const amount = money(asNumber(meta.amountPaise), locale) ?? "—";
    return labels.paymentReceived(labels.methodLabel(methodRaw), amount);
  }

  if (action === "billing.refund_recorded") {
    const methodRaw = asString(meta.method) ?? "CASH";
    const amount = money(asNumber(meta.amountPaise), locale) ?? "—";
    return labels.refundGiven(labels.methodLabel(methodRaw), amount);
  }

  if (action === "billing.credit_note_created") {
    const creditNoteNumber = asString(meta.creditNoteNumber) ?? "—";
    const amount = money(asNumber(meta.totalPaise), locale) ?? "—";
    const reasonRaw = asString(meta.reason) ?? "OTHER";
    return labels.creditNote(
      creditNoteNumber,
      amount,
      labels.reasonLabel(reasonRaw),
    );
  }

  return action;
}
