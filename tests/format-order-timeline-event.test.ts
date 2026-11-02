import { describe, expect, it } from "vitest";
import {
  formatOrderTimelineEvent,
  type FormatOrderTimelineLabels,
} from "@/modules/service-orders/format-order-timeline-event";

const labels: FormatOrderTimelineLabels = {
  fallbackDescription: "Item",
  created: (status) => `Job card opened — status set to ${status}`,
  statusChanged: (from, to) => `Status changed from ${from} to ${to}`,
  lineAdded: (description, quantity, price) =>
    `Added ${description} — quantity ${quantity}, price ${price}`,
  lineRemoved: (description, quantity, price) =>
    `Removed ${description} — quantity ${quantity}, price ${price}`,
  lineUpdated: (description) => `Updated ${description}`,
  lineUpdatedWithChanges: (description, changes) =>
    `Updated ${description} — ${changes}`,
  changeQuantity: (from, to) => `quantity ${from} to ${to}`,
  changePrice: (from, to) => `price ${from} to ${to}`,
  changeName: (from, to) => `name from “${from}” to “${to}”`,
  detailsUpdated: "Job card details updated",
  cataloguePrices: (count) => `Filled prices from inventory for ${count} items`,
  billDraft: (amount) => `Draft bill prepared — total ${amount}`,
  billDraftNoAmount: "Draft bill prepared",
  billFinalized: (invoiceNumber, amount) =>
    `Bill finalized as ${invoiceNumber} — total ${amount}`,
  billFinalizedNoAmount: (invoiceNumber) =>
    `Bill finalized as ${invoiceNumber}`,
  billDraftDeleted: "Draft bill removed",
  paymentReceived: (method, amount) =>
    `Payment received — ${method}, ${amount}`,
  refundGiven: (method, amount) =>
    `Refund given to customer — ${method}, ${amount}`,
  creditNote: (creditNoteNumber, amount, reason) =>
    `Credit note ${creditNoteNumber} added — bill reduced by ${amount} (${reason})`,
  statusLabel: (status) => status,
  methodLabel: (method) => method,
  reasonLabel: (reason) => reason,
};

describe("formatOrderTimelineEvent", () => {
  it("explains line updates with quantity and price changes", () => {
    const text = formatOrderTimelineEvent(
      "service_order.line_updated",
      {
        description: "Engine oil 5W-30",
        previousDescription: "Engine oil 5W-30",
        quantity: 2,
        previousQuantity: 1,
        unitPricePaise: 70_000,
        previousUnitPricePaise: 65_000,
      },
      labels,
      "en-IN",
    );

    expect(text).toContain("Updated Engine oil 5W-30");
    expect(text).toContain("quantity 1 to 2");
    expect(text).toContain("price");
    expect(text).toContain("650");
    expect(text).toContain("700");
  });

  it("explains credit notes in plain language", () => {
    const text = formatOrderTimelineEvent(
      "billing.credit_note_created",
      {
        creditNoteNumber: "CN-2026-0001",
        totalPaise: 10_000,
        reason: "CORRECTION",
      },
      labels,
      "en-IN",
    );

    expect(text).toContain("Credit note CN-2026-0001 added");
    expect(text).toContain("bill reduced by");
    expect(text).toContain("100");
    expect(text).toContain("CORRECTION");
  });

  it("keeps status changes readable", () => {
    expect(
      formatOrderTimelineEvent(
        "service_order.status_changed",
        { from: "WAITING", to: "IN_PROGRESS" },
        {
          ...labels,
          statusLabel: (status) =>
            status === "WAITING" ? "Waiting" : "In progress",
        },
      ),
    ).toBe("Status changed from Waiting to In progress");
  });
});
