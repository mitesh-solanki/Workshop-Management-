import "server-only";

import PDFDocument from "pdfkit";
import { formatRupees, multiplyByQuantity, type Paise } from "@/lib/money";

export type InspectionReportPdfItem = {
  description: string;
  quantity: number;
  unitPricePaise: Paise;
  /** When set, used for the Price column (matches on-screen report line total). */
  lineTotalPaise?: Paise;
};

export type InspectionReportPdfPhoto = {
  label: string;
  buffer: Buffer;
};

export type InspectionReportPdfInput = {
  garageName: string;
  customerName: string;
  vehicleRegistration: string;
  vehicleMakeModel: string;
  expectedCompletion: string | null;
  complaint: string | null;
  recommendedNotes: string | null;
  items: InspectionReportPdfItem[];
  checkedOkLabels?: string[];
  externalLabels?: string[];
  photos?: InspectionReportPdfPhoto[];
  closingNote: string;
  generatedAt: Date;
};

/** Readable date/time for the PDF header (ASCII-safe). */
export function formatInspectionPdfExpectedCompletion(
  value: Date | string | null | undefined,
): string | null {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const day = date.getDate();
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = months[date.getMonth()] ?? "";
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "pm" : "am";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
}

const PAGE = { margin: 48, width: 595.28, height: 841.89 } as const;
const COLORS = {
  text: "#152238",
  muted: "#5c6b7e",
  line: "#d7deea",
  header: "#1f5eff",
  note: "#dc2626",
  soft: "#f8fafc",
  tableHeader: "#e8eef5",
} as const;

/** Helvetica cannot draw ₹ — reuse app paise→rupees formatting. */
export function formatInspectionPdfMoney(paise: number): string {
  return formatRupees(paise as Paise)
    .replace(/^₹\s?/, "Rs. ")
    .replace(/\u00a0/g, " ");
}

function drawDivider(doc: PDFKit.PDFDocument, y: number, width: number) {
  doc
    .strokeColor(COLORS.line)
    .lineWidth(1)
    .moveTo(PAGE.margin, y)
    .lineTo(PAGE.margin + width, y)
    .stroke();
}

/**
 * Customer-facing inspection findings report (not an invoice).
 */
export async function generateInspectionReportPdf(
  input: InspectionReportPdfInput,
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margin: PAGE.margin,
    info: {
      Title: `Inspection Report — ${input.vehicleRegistration}`,
      Author: input.garageName,
    },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const contentWidth = PAGE.width - PAGE.margin * 2;
  let y = PAGE.margin;

  doc
    .fillColor(COLORS.header)
    .fontSize(18)
    .font("Helvetica-Bold")
    .text(input.garageName, PAGE.margin, y, { width: contentWidth });
  y = doc.y + 6;
  doc
    .fillColor(COLORS.text)
    .fontSize(14)
    .font("Helvetica-Bold")
    .text("Inspection Report", PAGE.margin, y);
  y = doc.y + 14;

  drawDivider(doc, y, contentWidth);
  y += 14;

  const half = contentWidth / 2;
  const leftX = PAGE.margin;
  const rightX = PAGE.margin + half;

  doc.fillColor(COLORS.muted).fontSize(9).font("Helvetica-Bold");
  doc.text("Name", leftX, y, { width: half - 12 });
  doc.text("Vehicle", rightX, y, { width: half });
  y = doc.y + 3;

  doc.fillColor(COLORS.text).fontSize(11).font("Helvetica-Bold");
  doc.text(input.customerName, leftX, y, { width: half - 12 });
  const nameBottom = doc.y;
  doc.text(input.vehicleRegistration, rightX, y, { width: half });
  let vehicleBottom = doc.y;
  if (input.vehicleMakeModel.trim()) {
    doc
      .fillColor(COLORS.muted)
      .fontSize(9)
      .font("Helvetica")
      .text(input.vehicleMakeModel.trim(), rightX, vehicleBottom + 2, {
        width: half,
      });
    vehicleBottom = doc.y;
  }
  y = Math.max(nameBottom, vehicleBottom) + 14;

  const expectedText = input.expectedCompletion?.trim() || "";
  const complaintText = input.complaint?.trim() || "";
  if (expectedText || complaintText) {
    doc.fillColor(COLORS.muted).fontSize(9).font("Helvetica-Bold");
    if (complaintText) {
      doc.text("Complaint", leftX, y, { width: half - 12 });
    }
    if (expectedText) {
      doc.text("Expected Completion", rightX, y, { width: half });
    }
    y = doc.y + 3;

    doc.fillColor(COLORS.text).fontSize(11).font("Helvetica");
    const rowTop = y;
    let complaintBottom = rowTop;
    let expectedBottom = rowTop;
    if (complaintText) {
      doc.font("Helvetica-Bold").text(complaintText, leftX, rowTop, {
        width: half - 12,
      });
      complaintBottom = doc.y;
    }
    if (expectedText) {
      doc
        .font("Helvetica-Bold")
        .text(expectedText, rightX, rowTop, { width: half });
      expectedBottom = doc.y;
    }
    y = Math.max(complaintBottom, expectedBottom) + 14;
  }

  if (input.recommendedNotes?.trim()) {
    doc
      .fillColor(COLORS.muted)
      .fontSize(11)
      .font("Helvetica-Bold")
      .text("Recommendation Notes", PAGE.margin, y);
    y = doc.y + 4;
    doc
      .fillColor(COLORS.text)
      .font("Helvetica")
      .fontSize(12)
      .text(input.recommendedNotes.trim(), PAGE.margin, y, {
        width: contentWidth,
      });
    y = doc.y + 12;
  }

  drawDivider(doc, y, contentWidth);
  y += 14;

  doc
    .fillColor(COLORS.text)
    .font("Helvetica-Bold")
    .fontSize(12)
    .text("Inspected Items", PAGE.margin, y);
  y = doc.y + 10;

  const qtyWidth = 48;
  const priceWidth = 96;
  const descWidth = contentWidth - qtyWidth - priceWidth - 16;
  const cols = {
    item: PAGE.margin,
    qty: PAGE.margin + descWidth + 8,
    price: PAGE.margin + descWidth + qtyWidth + 12,
  };
  const rowHeight = 28;
  const headerHeight = 28;

  doc.rect(PAGE.margin, y, contentWidth, headerHeight).fill(COLORS.tableHeader);
  doc.fillColor(COLORS.text).fontSize(10).font("Helvetica-Bold");
  const headerTextY = y + 9;
  doc.text("Description", cols.item + 8, headerTextY, { width: descWidth - 4 });
  doc.text("Qty", cols.qty, headerTextY, { width: qtyWidth, align: "right" });
  doc.text("Price", cols.price, headerTextY, {
    width: priceWidth - 8,
    align: "right",
  });
  y += headerHeight;

  if (input.items.length === 0) {
    y += 8;
    doc
      .fillColor(COLORS.muted)
      .font("Helvetica-Oblique")
      .fontSize(10)
      .text("No priced items to list.", PAGE.margin + 6, y);
    y = doc.y + 12;
  } else {
    let grand = 0;
    for (const item of input.items) {
      const lineTotal =
        item.lineTotalPaise ??
        multiplyByQuantity(item.unitPricePaise, item.quantity);
      grand += lineTotal;
      if (y + rowHeight > PAGE.height - PAGE.margin - 80) {
        doc.addPage();
        y = PAGE.margin;
      }
      doc
        .strokeColor(COLORS.line)
        .lineWidth(0.5)
        .moveTo(PAGE.margin, y + rowHeight)
        .lineTo(PAGE.margin + contentWidth, y + rowHeight)
        .stroke();

      const textY = y + 9;
      doc.fillColor(COLORS.text).font("Helvetica").fontSize(10);
      doc.text(item.description, cols.item + 8, textY, {
        width: descWidth - 12,
        height: rowHeight - 10,
        ellipsis: true,
        lineBreak: false,
      });
      doc.text(String(item.quantity), cols.qty, textY, {
        width: qtyWidth,
        align: "right",
        lineBreak: false,
      });
      doc.text(formatInspectionPdfMoney(lineTotal), cols.price, textY, {
        width: priceWidth - 8,
        align: "right",
        lineBreak: false,
      });
      y += rowHeight;
    }
    y += 12;
    doc
      .fillColor(COLORS.header)
      .font("Helvetica-Bold")
      .fontSize(12)
      .text(`Total ${formatInspectionPdfMoney(grand)}`, PAGE.margin, y, {
        width: contentWidth,
        align: "right",
      });
    y = doc.y + 16;
  }

  const checkedOk = (input.checkedOkLabels ?? []).filter((label) =>
    label.trim(),
  );
  if (checkedOk.length > 0) {
    if (y > PAGE.height - PAGE.margin - 60) {
      doc.addPage();
      y = PAGE.margin;
    }
    y += 10;
    doc
      .fillColor(COLORS.text)
      .font("Helvetica-Bold")
      .fontSize(12)
      .text("Marked Good", PAGE.margin, y);
    y = doc.y + 8;
    doc.fillColor(COLORS.text).font("Helvetica").fontSize(10);
    doc.text(checkedOk.join("  ·  "), PAGE.margin, y, { width: contentWidth });
    y = doc.y + 18;
  }

  const external = (input.externalLabels ?? []).filter((label) => label.trim());
  if (external.length > 0) {
    if (y > PAGE.height - PAGE.margin - 60) {
      doc.addPage();
      y = PAGE.margin;
    }
    y += 10;
    doc
      .fillColor(COLORS.text)
      .font("Helvetica-Bold")
      .fontSize(12)
      .text("Needs External Check", PAGE.margin, y);
    y = doc.y + 8;
    doc.fillColor(COLORS.text).font("Helvetica").fontSize(10);
    doc.text(external.join("  ·  "), PAGE.margin, y, { width: contentWidth });
    y = doc.y + 18;
  }

  const photos = input.photos ?? [];
  if (photos.length > 0) {
    if (y > PAGE.height - PAGE.margin - 180) {
      doc.addPage();
      y = PAGE.margin;
    }
    y += 14;
    doc
      .fillColor(COLORS.text)
      .font("Helvetica-Bold")
      .fontSize(12)
      .text("Inspection Photos", PAGE.margin, y);
    y = doc.y + 16;

    const gap = 16;
    const thumbWidth = Math.min(260, (contentWidth - gap) / 2);
    const thumbHeight = 140;
    let col = 0;

    for (const photo of photos) {
      if (y + thumbHeight + gap > PAGE.height - PAGE.margin) {
        doc.addPage();
        y = PAGE.margin;
        col = 0;
      }
      const x = PAGE.margin + col * (thumbWidth + gap);
      try {
        doc.image(photo.buffer, x, y, {
          fit: [thumbWidth, thumbHeight],
          align: "center",
          valign: "center",
        });
      } catch {
        doc
          .rect(x, y, thumbWidth, thumbHeight)
          .strokeColor(COLORS.line)
          .stroke();
      }
      col += 1;
      if (col >= 2) {
        col = 0;
        y += thumbHeight + gap;
      }
    }
    if (col !== 0) {
      y += thumbHeight + gap;
    }
    y += 12;
  }

  const footerHeight = 36;
  const footerTop = PAGE.height - PAGE.margin - footerHeight;
  if (y > footerTop - 70) {
    doc.addPage();
    y = PAGE.margin;
  }

  y += 8;
  doc
    .fillColor(COLORS.note)
    .font("Helvetica-Bold")
    .fontSize(11)
    .text("Note", PAGE.margin, y);
  y = doc.y + 6;
  doc
    .fillColor(COLORS.text)
    .font("Helvetica")
    .fontSize(11)
    .text(input.closingNote, PAGE.margin, y, { width: contentWidth });

  drawDivider(doc, footerTop, contentWidth);
  doc
    .fillColor(COLORS.muted)
    .font("Helvetica")
    .fontSize(9)
    .text(
      `Generated ${input.generatedAt.toLocaleString("en-IN")}`,
      PAGE.margin,
      footerTop + 10,
      { width: contentWidth, align: "right" },
    );

  doc.end();
  return done;
}
