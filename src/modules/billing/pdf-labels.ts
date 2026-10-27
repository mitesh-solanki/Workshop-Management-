import type { PdfLocale } from "@/modules/billing/schema";

/** Invoice PDF UI strings — not e-invoice / IRN. */
export type InvoicePdfLabels = {
  locale: PdfLocale;
  title: string;
  draftTitle: string;
  invoiceNumber: string;
  date: string;
  garage: string;
  gstin: string;
  billTo: string;
  vehicle: string;
  vehicleDetails: string;
  placeOfSupply: string;
  supplyType: string;
  supplyTypeIntra: string;
  supplyTypeInter: string;
  reverseCharge: string;
  reverseChargeNo: string;
  hsnOrSac: string;
  description: string;
  qty: string;
  rate: string;
  taxable: string;
  gstRate: string;
  cgst: string;
  sgst: string;
  igst: string;
  lineTotal: string;
  taxableTotal: string;
  grandTotal: string;
  amountPaid: string;
  pendingBalance: string;
  payments: string;
  creditNotes: string;
  creditNoteReasons: {
    CORRECTION: string;
    REFUND: string;
    OTHER: string;
  };
  notes: string;
  authorisedSignatory: string;
  thankYou: string;
  /** Explicit non-claim: this is not an e-invoice. */
  notEInvoice: string;
};

const LABELS: Record<PdfLocale, Omit<InvoicePdfLabels, "locale">> = {
  en: {
    title: "Tax Invoice",
    draftTitle: "Draft Invoice",
    invoiceNumber: "Invoice no.",
    date: "Date",
    garage: "Garage",
    gstin: "GSTIN",
    billTo: "Bill to",
    vehicle: "Vehicle",
    vehicleDetails: "Vehicle & job",
    placeOfSupply: "Place of supply",
    supplyType: "Supply",
    supplyTypeIntra: "Intra-state (CGST + SGST)",
    supplyTypeInter: "Inter-state (IGST)",
    reverseCharge: "Reverse charge",
    reverseChargeNo: "No",
    hsnOrSac: "HSN/SAC",
    description: "Description",
    qty: "Qty",
    rate: "Rate",
    taxable: "Net",
    gstRate: "GST%",
    cgst: "CGST",
    sgst: "SGST",
    igst: "IGST",
    lineTotal: "Amount",
    taxableTotal: "Subtotal",
    grandTotal: "Total",
    amountPaid: "Paid",
    pendingBalance: "Balance",
    payments: "Payments",
    creditNotes: "Adjustments",
    creditNoteReasons: {
      CORRECTION: "Correction",
      REFUND: "Refund",
      OTHER: "Other",
    },
    notes: "Customer note",
    authorisedSignatory: "Authorised signatory",
    thankYou: "Thank you for using our service.",
    notEInvoice:
      "This is a tax invoice for workshop records. It is not an e-invoice (no IRN).",
  },
  hi: {
    title: "कर चालान",
    draftTitle: "ड्राफ्ट चालान",
    invoiceNumber: "चालान संख्या",
    date: "दिनांक",
    garage: "गैराज",
    gstin: "GSTIN",
    billTo: "बिल प्राप्तकर्ता",
    vehicle: "वाहन",
    vehicleDetails: "वाहन और जॉब",
    placeOfSupply: "आपूर्ति स्थान",
    supplyType: "आपूर्ति",
    supplyTypeIntra: "अंतःराज्यीय (CGST + SGST)",
    supplyTypeInter: "अंतरराज्यीय (IGST)",
    reverseCharge: "रिवर्स चार्ज",
    reverseChargeNo: "नहीं",
    hsnOrSac: "HSN/SAC",
    description: "विवरण",
    qty: "मात्रा",
    rate: "दर",
    taxable: "नेट",
    gstRate: "GST%",
    cgst: "CGST",
    sgst: "SGST",
    igst: "IGST",
    lineTotal: "राशि",
    taxableTotal: "उप-योग",
    grandTotal: "कुल",
    amountPaid: "भुगतान",
    pendingBalance: "बकाया",
    payments: "भुगतान",
    creditNotes: "समायोजन",
    creditNoteReasons: {
      CORRECTION: "सुधार",
      REFUND: "रिफंड",
      OTHER: "अन्य",
    },
    notes: "ग्राहक नोट",
    authorisedSignatory: "अधिकृत हस्ताक्षरकर्ता",
    thankYou: "हमारी सेवा का उपयोग करने के लिए धन्यवाद।",
    notEInvoice:
      "यह वर्कशॉप रिकॉर्ड के लिए कर चालान है। यह ई-इनवॉइस नहीं है (कोई IRN नहीं)।",
  },
  gu: {
    title: "ટેક્સ ઇનવૉઇસ",
    draftTitle: "ડ્રાફ્ટ ઇનવૉઇસ",
    invoiceNumber: "ઇનવૉઇસ નંબર",
    date: "તારીખ",
    garage: "ગેરેજ",
    gstin: "GSTIN",
    billTo: "બિલ મેળવનાર",
    vehicle: "વાહન",
    vehicleDetails: "વાહન અને જોબ",
    placeOfSupply: "સપ્લાયનું સ્થાન",
    supplyType: "સપ્લાય",
    supplyTypeIntra: "અંતઃરાજ્ય (CGST + SGST)",
    supplyTypeInter: "આંતરરાજ્ય (IGST)",
    reverseCharge: "રિવર્સ ચાર્જ",
    reverseChargeNo: "ના",
    hsnOrSac: "HSN/SAC",
    description: "વિગત",
    qty: "જથ્થો",
    rate: "દર",
    taxable: "નેટ",
    gstRate: "GST%",
    cgst: "CGST",
    sgst: "SGST",
    igst: "IGST",
    lineTotal: "રકમ",
    taxableTotal: "ઉપકુલ",
    grandTotal: "કુલ",
    amountPaid: "ચૂકવેલ",
    pendingBalance: "બાકી",
    payments: "ચુકવણીઓ",
    creditNotes: "સમાયોજન",
    creditNoteReasons: {
      CORRECTION: "સુધારો",
      REFUND: "રિફંડ",
      OTHER: "અન્ય",
    },
    notes: "ગ્રાહક નોંધ",
    authorisedSignatory: "અધિકૃત હસ્તાક્ષરકર્તા",
    thankYou: "અમારી સેવાનો ઉપયોગ કરવા બદલ આભાર.",
    notEInvoice:
      "આ વર્કશોપ રેકોર્ડ માટે ટેક્સ ઇનવૉઇસ છે. આ ઈ-ઇનવૉઇસ નથી (IRN નથી).",
  },
};

export function getInvoicePdfLabels(locale: PdfLocale): InvoicePdfLabels {
  return { locale, ...LABELS[locale] };
}
