import "server-only";

import { createWriteStream, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import PDFDocument from "pdfkit";
import type { Paise } from "@/lib/money";
import {
  getInvoicePdfLabels,
  type InvoicePdfLabels,
} from "@/modules/billing/pdf-labels";
import type { PdfLocale } from "@/modules/billing/schema";
import { pendingBalancePaise } from "@/modules/billing/balance";

export type InvoicePdfLine = {
  description: string;
  hsnOrSac: string;
  quantity: number;
  unitPricePaise: Paise;
  gstRatePercent: number;
  taxablePaise: Paise;
  cgstPaise: Paise;
  sgstPaise: Paise;
  igstPaise: Paise;
  totalPaise: Paise;
};

export type InvoicePdfPayment = {
  method: string;
  amountPaise: Paise;
  receivedAt: Date;
};

export type InvoicePdfCreditNote = {
  creditNoteNumber: string;
  totalPaise: Paise;
  reason: string;
};

export type InvoicePdfInput = {
  locale: PdfLocale;
  status: "DRAFT" | "FINALIZED";
  invoiceNumber: string | null;
  issuedAt: Date;
  garage: { name: string; address: string | null; gstin: string | null };
  customer: { name: string; phone: string; address: string | null };
  vehicle: { registrationNumber: string; make: string; model: string } | null;
  placeOfSupplyStateCode: string;
  sellerStateCode: string;
  gstSplit: "CGST_SGST" | "IGST";
  lines: InvoicePdfLine[];
  taxablePaise: Paise;
  cgstPaise: Paise;
  sgstPaise: Paise;
  igstPaise: Paise;
  totalPaise: Paise;
  amountPaidPaise: Paise;
  payments: InvoicePdfPayment[];
  creditNotes: InvoicePdfCreditNote[];
  notes: string | null;
};

const PAGE = {
  margin: 40,
  width: 595.28,
  height: 841.89,
} as const;

/** Paper-style invoice colours aligned with HTML bill preview. */
const COLORS = {
  text: "#172a42",
  muted: "#6c7a8b",
  metaLabel: "#7a8899",
  metaBody: "#67788c",
  line: "#e7ebf2",
  summaryRule: "#dfe7f4",
  headerBg: "#eff4ff",
  headerText: "#354e73",
  accent: "#285de5",
  accentText: "#2454c9",
  brandRule: "#2559df",
  footer: "#8491a3",
} as const;

type Doc = PDFKit.PDFDocument;

function resolveUnicodeFont(locale: PdfLocale): string | null {
  if (locale === "en") {
    return null;
  }
  const candidates =
    locale === "hi"
      ? [
          join(process.cwd(), "assets/fonts/NotoSansDevanagari-Regular.ttf"),
          "C:\\Windows\\Fonts\\Nirmala.ttf",
          "C:\\Windows\\Fonts\\NirmalaUI.ttf",
          "/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf",
        ]
      : [
          join(process.cwd(), "assets/fonts/NotoSansGujarati-Regular.ttf"),
          "C:\\Windows\\Fonts\\Nirmala.ttf",
          "C:\\Windows\\Fonts\\NirmalaUI.ttf",
          "/usr/share/fonts/truetype/noto/NotoSansGujarati-Regular.ttf",
        ];
  for (const path of candidates) {
    if (existsSync(path)) {
      return path;
    }
  }
  return null;
}

/** Helvetica cannot draw ₹ — use ASCII-safe Indian rupee format. */
function money(paise: Paise): string {
  const rupees = paise / 100;
  return (
    "Rs. " +
    new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(rupees)
  );
}

function dateLabel(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function contentWidth(): number {
  return PAGE.width - PAGE.margin * 2;
}

function ensureSpace(doc: Doc, needed: number): void {
  if (doc.y + needed > PAGE.height - PAGE.margin - 36) {
    doc.addPage();
    doc.y = PAGE.margin;
  }
}

function setBodyFont(doc: Doc, fontPath: string | null, size: number): void {
  if (fontPath) {
    doc.font("InvoiceBody").fontSize(size);
  } else {
    doc.font("Helvetica").fontSize(size);
  }
}

function setBoldFont(doc: Doc, fontPath: string | null, size: number): void {
  if (fontPath) {
    // Unicode TTF may be regular-only; still size correctly.
    doc.font("InvoiceBody").fontSize(size);
  } else {
    doc.font("Helvetica-Bold").fontSize(size);
  }
}

function drawHRule(doc: Doc, y: number, color: string = COLORS.line): void {
  doc
    .strokeColor(color)
    .lineWidth(0.75)
    .moveTo(PAGE.margin, y)
    .lineTo(PAGE.width - PAGE.margin, y)
    .stroke();
}

type Col = { key: string; label: string; width: number; align: "left" | "right" | "center" };

/** Scale fixed column weights so the table spans the full content width (no right gap). */
function fitColumns(cols: Col[], targetWidth: number): Col[] {
  const sum = cols.reduce((total, col) => total + col.width, 0);
  if (sum <= 0 || Math.abs(sum - targetWidth) < 0.5) {
    return cols;
  }
  const scaled = cols.map((col) => ({
    ...col,
    width: (col.width / sum) * targetWidth,
  }));
  const scaledSum = scaled.reduce((total, col) => total + col.width, 0);
  const last = scaled[scaled.length - 1];
  if (last) {
    last.width += targetWidth - scaledSum;
  }
  return scaled;
}

function tableColumns(
  labels: InvoicePdfLabels,
  gstSplit: "CGST_SGST" | "IGST",
): Col[] {
  const base: Col[] =
    gstSplit === "CGST_SGST"
      ? [
          { key: "sno", label: "#", width: 18, align: "center" },
          { key: "description", label: labels.description, width: 108, align: "left" },
          { key: "hsn", label: labels.hsnOrSac, width: 44, align: "center" },
          { key: "qty", label: labels.qty, width: 24, align: "center" },
          { key: "rate", label: labels.rate, width: 52, align: "right" },
          { key: "taxable", label: labels.taxable, width: 52, align: "right" },
          { key: "gst", label: labels.gstRate, width: 28, align: "center" },
          { key: "cgst", label: labels.cgst, width: 48, align: "right" },
          { key: "sgst", label: labels.sgst, width: 48, align: "right" },
          { key: "total", label: labels.lineTotal, width: 68, align: "right" },
        ]
      : [
          { key: "sno", label: "#", width: 18, align: "center" },
          { key: "description", label: labels.description, width: 130, align: "left" },
          { key: "hsn", label: labels.hsnOrSac, width: 48, align: "center" },
          { key: "qty", label: labels.qty, width: 26, align: "center" },
          { key: "rate", label: labels.rate, width: 56, align: "right" },
          { key: "taxable", label: labels.taxable, width: 56, align: "right" },
          { key: "gst", label: labels.gstRate, width: 30, align: "center" },
          { key: "igst", label: labels.igst, width: 56, align: "right" },
          { key: "total", label: labels.lineTotal, width: 70, align: "right" },
        ];
  return fitColumns(base, contentWidth());
}

function cellText(
  doc: Doc,
  text: string,
  x: number,
  y: number,
  width: number,
  align: "left" | "right" | "center",
  fontSize: number,
  fontPath: string | null,
  bold = false,
): number {
  if (bold) {
    setBoldFont(doc, fontPath, fontSize);
  } else {
    setBodyFont(doc, fontPath, fontSize);
  }
  const height = doc.heightOfString(text, { width: width - 6, align });
  doc.fillColor(COLORS.text).text(text, x + 3, y, {
    width: width - 6,
    align,
    lineBreak: true,
  });
  return height;
}

function drawTableHeader(
  doc: Doc,
  cols: Col[],
  y: number,
  fontPath: string | null,
): number {
  const rowH = 30;
  const totalW = cols.reduce((sum, col) => sum + col.width, 0);
  doc.rect(PAGE.margin, y, totalW, rowH).fill(COLORS.headerBg);

  let x = PAGE.margin;
  for (const col of cols) {
    setBoldFont(doc, fontPath, 7);
    doc.fillColor(COLORS.headerText).text(col.label, x + 3, y + 10, {
      width: col.width - 6,
      align: col.align,
      lineBreak: false,
    });
    x += col.width;
  }
  return y + rowH;
}

function drawLineRow(
  doc: Doc,
  cols: Col[],
  values: Record<string, string>,
  y: number,
  fontPath: string | null,
): number {
  const padY = 12;
  let contentH = 10;
  for (const col of cols) {
    setBodyFont(doc, fontPath, 7.5);
    const h = doc.heightOfString(values[col.key] ?? "", {
      width: col.width - 6,
      align: col.align,
    });
    contentH = Math.max(contentH, h);
  }
  const maxH = contentH + padY * 2;

  const totalW = cols.reduce((sum, col) => sum + col.width, 0);
  let x = PAGE.margin;
  for (const col of cols) {
    cellText(
      doc,
      values[col.key] ?? "",
      x,
      y + padY,
      col.width,
      col.align,
      7.5,
      fontPath,
      col.key === "description",
    );
    x += col.width;
  }

  doc
    .strokeColor(COLORS.line)
    .lineWidth(0.5)
    .moveTo(PAGE.margin, y + maxH)
    .lineTo(PAGE.margin + totalW, y + maxH)
    .stroke();

  return y + maxH;
}

function drawMetaPair(
  doc: Doc,
  label: string,
  value: string,
  x: number,
  y: number,
  labelW: number,
  valueW: number,
  fontPath: string | null,
): number {
  setBodyFont(doc, fontPath, 8);
  doc.fillColor(COLORS.muted).text(`${label}:`, x, y, {
    width: labelW,
    lineBreak: false,
  });
  setBoldFont(doc, fontPath, 9);
  doc.fillColor(COLORS.text).text(value, x + labelW, y, {
    width: valueW,
    align: "right",
    lineBreak: false,
  });
  return y + 14;
}

/**
 * Build a tax-invoice PDF (not an e-invoice). Uses locale label set;
 * Hindi/Gujarati need a Unicode TTF when available, otherwise labels
 * still come from that set but may fall back to Helvetica glyphs.
 */
export async function generateInvoicePdf(
  input: InvoicePdfInput,
): Promise<{ buffer: Buffer; labels: InvoicePdfLabels }> {
  const labels = getInvoicePdfLabels(input.locale);
  const fontPath = resolveUnicodeFont(input.locale);
  const creditTotal = input.creditNotes.reduce(
    (sum, note) => sum + note.totalPaise,
    0,
  );
  const pending = pendingBalancePaise({
    totalPaise: input.totalPaise,
    amountPaidPaise: input.amountPaidPaise,
    creditNotesTotalPaise: creditTotal,
  });

  const doc = new PDFDocument({
    margin: PAGE.margin,
    size: "A4",
    info: {
      Title: input.invoiceNumber
        ? `${labels.title} ${input.invoiceNumber}`
        : labels.draftTitle,
      Author: input.garage.name,
    },
  });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  if (fontPath) {
    doc.registerFont("InvoiceBody", fontPath);
  }

  const title =
    input.status === "FINALIZED" ? labels.title : labels.draftTitle;
  const leftW = contentWidth() * 0.58;
  const rightW = contentWidth() * 0.38;
  const rightX = PAGE.width - PAGE.margin - rightW;

  // —— Brand mark + garage (left) | INVOICE meta (right) ——
  const markSize = 36;
  doc
    .roundedRect(PAGE.margin, PAGE.margin, markSize, markSize, 8)
    .fill(COLORS.accent);
  setBoldFont(doc, fontPath, 13);
  doc.fillColor("#ffffff").text(
    input.garage.name.slice(0, 2).toUpperCase(),
    PAGE.margin,
    PAGE.margin + 11,
    { width: markSize, align: "center", lineBreak: false },
  );

  const brandX = PAGE.margin + markSize + 10;
  setBoldFont(doc, fontPath, 14);
  doc.fillColor(COLORS.text).text(input.garage.name.toUpperCase(), brandX, PAGE.margin + 2, {
    width: leftW - markSize - 10,
    lineBreak: true,
  });
  let leftY = doc.y + 2;
  setBodyFont(doc, fontPath, 8);
  doc.fillColor(COLORS.muted);
  if (input.garage.address) {
    doc.text(input.garage.address, brandX, leftY, {
      width: leftW - markSize - 10,
    });
    leftY = doc.y + 2;
  }
  if (input.garage.gstin) {
    setBoldFont(doc, fontPath, 8);
    doc.fillColor(COLORS.text).text(
      `${labels.gstin}: ${input.garage.gstin}`,
      brandX,
      leftY,
      { width: leftW - markSize - 10 },
    );
    leftY = doc.y + 2;
  }

  setBoldFont(doc, fontPath, 20);
  doc.fillColor(COLORS.accentText).text(title.toUpperCase(), rightX, PAGE.margin, {
    width: rightW,
    align: "right",
  });
  let rightY = PAGE.margin + 28;
  setBoldFont(doc, fontPath, 9);
  doc.fillColor(COLORS.text).text(
    input.invoiceNumber ?? labels.draftTitle,
    rightX,
    rightY,
    { width: rightW, align: "right", lineBreak: false },
  );
  rightY += 14;
  setBodyFont(doc, fontPath, 8);
  doc.fillColor(COLORS.muted).text(dateLabel(input.issuedAt), rightX, rightY, {
    width: rightW,
    align: "right",
    lineBreak: false,
  });
  rightY += 12;
  rightY = drawMetaPair(
    doc,
    labels.reverseCharge,
    labels.reverseChargeNo,
    rightX,
    rightY,
    rightW * 0.55,
    rightW * 0.45,
    fontPath,
  );

  const headerBottom = Math.max(leftY, rightY, PAGE.margin + markSize) + 12;
  drawHRule(doc, headerBottom, COLORS.brandRule);
  doc.y = headerBottom + 16;

  // —— Bill to | Vehicle (two columns) ——
  const colGap = 20;
  const half = (contentWidth() - colGap) / 2;
  const billX = PAGE.margin;
  const vehicleX = PAGE.margin + half + colGap;
  const sectionTop = doc.y;

  setBoldFont(doc, fontPath, 7.5);
  doc.fillColor(COLORS.metaLabel).text(labels.billTo.toUpperCase(), billX, sectionTop, {
    width: half,
    characterSpacing: 0.8,
  });
  let billY = sectionTop + 14;
  setBoldFont(doc, fontPath, 11);
  doc.fillColor(COLORS.text).text(input.customer.name, billX, billY, {
    width: half,
  });
  billY = doc.y + 3;
  setBodyFont(doc, fontPath, 9);
  doc.fillColor(COLORS.metaBody).text(input.customer.phone, billX, billY, {
    width: half,
  });
  billY = doc.y + 3;
  if (input.customer.address) {
    doc.fillColor(COLORS.metaBody).text(input.customer.address, billX, billY, {
      width: half,
    });
    billY = doc.y + 3;
  }

  setBoldFont(doc, fontPath, 7.5);
  doc
    .fillColor(COLORS.metaLabel)
    .text(labels.vehicleDetails.toUpperCase(), vehicleX, sectionTop, {
      width: half,
      characterSpacing: 0.8,
    });
  let vehY = sectionTop + 14;
  if (input.vehicle) {
    setBoldFont(doc, fontPath, 11);
    doc
      .fillColor(COLORS.text)
      .text(input.vehicle.registrationNumber, vehicleX, vehY, { width: half });
    vehY = doc.y + 3;
    setBodyFont(doc, fontPath, 9);
    doc
      .fillColor(COLORS.metaBody)
      .text(`${input.vehicle.make} ${input.vehicle.model}`, vehicleX, vehY, {
        width: half,
      });
    vehY = doc.y + 3;
  } else {
    setBodyFont(doc, fontPath, 9);
    doc.fillColor(COLORS.muted).text("—", vehicleX, vehY, { width: half });
    vehY = doc.y + 3;
  }

  doc.y = Math.max(billY, vehY) + 16;

  // —— Line items table ——
  const cols = tableColumns(labels, input.gstSplit);
  const tableW = cols.reduce((sum, col) => sum + col.width, 0);
  ensureSpace(doc, 40);
  let tableY = drawTableHeader(doc, cols, doc.y, fontPath);

  input.lines.forEach((line, index) => {
    ensureSpace(doc, 28);
    const values: Record<string, string> =
      input.gstSplit === "CGST_SGST"
        ? {
            sno: String(index + 1),
            description: line.description,
            hsn: line.hsnOrSac,
            qty: String(line.quantity),
            rate: money(line.unitPricePaise),
            taxable: money(line.taxablePaise),
            gst: `${line.gstRatePercent}%`,
            cgst: money(line.cgstPaise),
            sgst: money(line.sgstPaise),
            total: money(line.totalPaise),
          }
        : {
            sno: String(index + 1),
            description: line.description,
            hsn: line.hsnOrSac,
            qty: String(line.quantity),
            rate: money(line.unitPricePaise),
            taxable: money(line.taxablePaise),
            gst: `${line.gstRatePercent}%`,
            igst: money(line.igstPaise),
            total: money(line.totalPaise),
          };
    tableY = drawLineRow(doc, cols, values, tableY, fontPath);
  });

  if (input.lines.length === 0) {
    ensureSpace(doc, 24);
    setBodyFont(doc, fontPath, 8);
    doc
      .fillColor(COLORS.muted)
      .text("—", PAGE.margin, tableY + 6, { width: tableW, align: "center" });
    tableY += 22;
    doc
      .strokeColor(COLORS.line)
      .lineWidth(0.5)
      .moveTo(PAGE.margin, tableY)
      .lineTo(PAGE.margin + tableW, tableY)
      .stroke();
  }

  doc.y = tableY + 18;

  // —— Paper summary: customer note (left) | totals (right) ——
  const totalsW = 200;
  const remarkW = contentWidth() - totalsW - 24;
  const totalsX = PAGE.margin + remarkW + 24;
  ensureSpace(doc, 140);

  const summaryTop = doc.y;
  setBoldFont(doc, fontPath, 9);
  doc.fillColor(COLORS.text).text(labels.notes, PAGE.margin, summaryTop, {
    width: remarkW,
  });
  setBodyFont(doc, fontPath, 8);
  doc.fillColor(COLORS.metaBody).text(input.notes?.trim() || "—", PAGE.margin, doc.y + 4, {
    width: remarkW,
  });
  let remarkBottom = doc.y + 10;

  if (input.payments.length > 0) {
    setBoldFont(doc, fontPath, 8);
    doc.fillColor(COLORS.text).text(labels.payments, PAGE.margin, remarkBottom, {
      width: remarkW,
    });
    remarkBottom = doc.y + 3;
    setBodyFont(doc, fontPath, 7.5);
    doc.fillColor(COLORS.metaBody);
    for (const payment of input.payments) {
      doc.text(
        `${dateLabel(payment.receivedAt)}  ·  ${payment.method}  ·  ${money(payment.amountPaise)}`,
        PAGE.margin,
        remarkBottom,
        { width: remarkW },
      );
      remarkBottom = doc.y + 2;
    }
    remarkBottom += 6;
  }

  if (input.creditNotes.length > 0) {
    setBoldFont(doc, fontPath, 8);
    doc.fillColor(COLORS.text).text(labels.creditNotes, PAGE.margin, remarkBottom, {
      width: remarkW,
    });
    remarkBottom = doc.y + 3;
    setBodyFont(doc, fontPath, 7.5);
    doc.fillColor(COLORS.metaBody);
    for (const note of input.creditNotes) {
      doc.text(
        `${note.creditNoteNumber}  ·  ${note.reason}  ·  ${money(note.totalPaise)}`,
        PAGE.margin,
        remarkBottom,
        { width: remarkW },
      );
      remarkBottom = doc.y + 2;
    }
    remarkBottom += 6;
  }

  setBodyFont(doc, fontPath, 7);
  doc.fillColor(COLORS.footer).text(labels.notEInvoice, PAGE.margin, remarkBottom + 8, {
    width: remarkW,
  });
  remarkBottom = doc.y + 4;

  const totalRows: Array<{
    label: string;
    value: string;
    bold?: boolean;
    accent?: boolean;
    large?: boolean;
    ruleBefore?: "thin" | "thick";
  }> = [{ label: labels.taxableTotal, value: money(input.taxablePaise) }];
  if (input.gstSplit === "CGST_SGST") {
    totalRows.push(
      { label: labels.cgst, value: money(input.cgstPaise) },
      { label: labels.sgst, value: money(input.sgstPaise) },
    );
  } else {
    totalRows.push({ label: labels.igst, value: money(input.igstPaise) });
  }
  if (creditTotal > 0) {
    totalRows.push({
      label: labels.creditNotes,
      value: `- ${money(creditTotal)}`,
    });
  }
  totalRows.push({
    label: labels.grandTotal,
    value: money(input.totalPaise),
    bold: true,
    accent: true,
    large: true,
    ruleBefore: "thick",
  });
  totalRows.push(
    { label: labels.amountPaid, value: money(input.amountPaidPaise) },
    {
      label: labels.pendingBalance,
      value: money(pending),
      bold: true,
    },
  );

  let rowY = summaryTop;
  for (const row of totalRows) {
    if (row.ruleBefore) {
      doc
        .strokeColor(COLORS.summaryRule)
        .lineWidth(1)
        .moveTo(totalsX, rowY)
        .lineTo(totalsX + totalsW, rowY)
        .stroke();
      rowY += 8;
    }
    const fontSize = row.large ? 11 : row.bold ? 9 : 8;
    if (row.bold || row.large) {
      setBoldFont(doc, fontPath, fontSize);
    } else {
      setBodyFont(doc, fontPath, fontSize);
    }
    doc.fillColor(row.accent ? COLORS.accentText : COLORS.muted);
    doc.text(row.label, totalsX, rowY, {
      width: totalsW * 0.48,
      lineBreak: false,
    });
    doc.fillColor(row.accent ? COLORS.accentText : COLORS.text);
    doc.text(row.value, totalsX + totalsW * 0.48, rowY, {
      width: totalsW * 0.52,
      align: "right",
      lineBreak: false,
    });
    rowY += row.large ? 22 : 16;
    if (row.ruleBefore === "thick") {
      doc
        .strokeColor(COLORS.summaryRule)
        .lineWidth(1)
        .moveTo(totalsX, rowY - 4)
        .lineTo(totalsX + totalsW, rowY - 4)
        .stroke();
      rowY += 4;
    }
  }

  doc.y = Math.max(remarkBottom, rowY) + 18;

  // —— Centered thank-you footer ——
  ensureSpace(doc, 36);
  const footY = Math.max(doc.y + 8, PAGE.height - PAGE.margin - 36);
  drawHRule(doc, footY, COLORS.line);
  setBodyFont(doc, fontPath, 8);
  doc.fillColor(COLORS.footer).text(labels.thankYou, PAGE.margin, footY + 10, {
    width: contentWidth(),
    align: "center",
  });

  doc.end();
  const buffer = await done;
  return { buffer, labels };
}

/** Test helper: write PDF to a temp file (optional debugging). */
export async function writeInvoicePdfToTemp(
  input: InvoicePdfInput,
): Promise<string> {
  const { buffer } = await generateInvoicePdf(input);
  const path = join(tmpdir(), `invoice-${Date.now()}.pdf`);
  const stream = createWriteStream(path);
  const { Readable } = await import("node:stream");
  await pipeline(Readable.from(buffer), stream);
  return path;
}
