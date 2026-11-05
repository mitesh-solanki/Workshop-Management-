import "server-only";

import PDFDocument from "pdfkit";
import { formatRupees, type Paise } from "@/lib/money";
import type { DailySummaryView } from "@/modules/daily-summary/service";

function money(paise: Paise): string {
  return formatRupees(paise, "en-IN");
}

function timeLabel(value: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(value);
}

export async function buildDailySummaryPdfBuffer(
  summary: DailySummaryView,
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margin: 48,
    info: {
      Title: `Daily Summary ${summary.dateKey}`,
      Author: summary.garageName,
    },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.fontSize(16).text(summary.garageName, { continued: false });
  doc.fontSize(12).fillColor("#334155").text(`Daily Summary · ${summary.dateKey}`);
  doc.moveDown(0.5);
  doc
    .fontSize(9)
    .fillColor("#64748b")
    .text(
      `Generated ${new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date())}`,
    );
  doc.moveDown();
  doc.fillColor("#0f172a");

  const { kpis } = summary;
  doc.fontSize(11).text("Snapshot", { underline: true });
  doc.moveDown(0.4);
  doc.fontSize(10);
  doc.text(
    `Job cards created: ${kpis.jobCardsCreated}   ·   Inspections: ${kpis.inspections}   ·   Jobs completed: ${kpis.jobsCompleted}`,
  );
  doc.text(
    `Invoices finalized: ${kpis.invoicesFinalized}`,
  );
  doc.text(
    `Money in: ${money(kpis.collectedPaise)}   ·   Money out: ${money(kpis.expensePaise + kpis.refundedPaise)}`,
  );
  doc.text(
    `Cash ${money(kpis.cashCollectedPaise)}  ·  UPI ${money(kpis.upiCollectedPaise)}  ·  Card ${money(kpis.cardCollectedPaise)}`,
  );
  doc.text(
    `Paid expenses: ${money(kpis.expensePaise)}  ·  Refunds: ${money(kpis.refundedPaise)}`,
  );
  doc.text(
    `Open jobs now: ${kpis.openJobsNow}   ·   Open dues: ${money(kpis.openDuesPaise)} (${kpis.openDuesCount})`,
  );
  doc.moveDown();

  function sectionTitle(title: string) {
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor("#0f172a").text(title, { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor("#0f172a");
  }

  sectionTitle("Job Cards Created");
  if (summary.jobCards.length === 0) {
    doc.fillColor("#64748b").text("None");
  } else {
    for (const row of summary.jobCards) {
      doc.text(
        `#${row.jobCardNumber}  ${row.customerName}  ${row.registrationNumber}  ${row.status}  ${timeLabel(row.createdAt)}`,
      );
    }
  }

  sectionTitle("Inspections");
  if (summary.inspections.length === 0) {
    doc.fillColor("#64748b").text("None");
  } else {
    for (const row of summary.inspections) {
      doc
        .fillColor("#0f172a")
        .text(
          `${row.customerName}  ${row.registrationNumber}  ${timeLabel(row.createdAt)}`,
        );
    }
  }

  sectionTitle("Invoices Finalized");
  if (summary.invoices.length === 0) {
    doc.fillColor("#64748b").text("None");
  } else {
    for (const row of summary.invoices) {
      doc
        .fillColor("#0f172a")
        .text(
          `${row.invoiceNumber ?? "—"}  ${row.customerName}  ${row.registrationNumber}  ${money(row.totalPaise)}  pending ${money(row.pendingPaise)}`,
        );
    }
  }

  sectionTitle("Payments");
  if (summary.payments.length === 0) {
    doc.fillColor("#64748b").text("None");
  } else {
    for (const row of summary.payments) {
      doc
        .fillColor("#0f172a")
        .text(
          `${timeLabel(row.receivedAt)}  ${row.customerName}  ${row.invoiceNumber ?? "—"}  ${row.isRefund ? "Refund" : row.method}  ${money(row.amountPaise)}`,
        );
    }
  }

  sectionTitle("Expenses");
  if (summary.expenses.length === 0) {
    doc.fillColor("#64748b").text("None");
  } else {
    for (const row of summary.expenses) {
      doc
        .fillColor("#0f172a")
        .text(
          `${row.category}  ${row.status}  ${row.method ?? "—"}  ${money(row.amountPaise)}${row.note ? `  · ${row.note}` : ""}`,
        );
    }
  }

  doc.end();
  return done;
}
