"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { displayInvoiceNumber } from "@/lib/financial-year";

type Props = {
  orderId: string;
  invoiceId: string;
  /** Job card number — used as the last segment of the PDF file name. */
  jobCardNumber?: number | null;
  /** Tax invoice number (on the PDF). FY prefix is reused for the file name. */
  invoiceNumber: string | null;
  locale: string;
};

/** File name: INV-{FY}-{jobCardNumber}, e.g. INV-2026-27-259. */
function invoicePdfFileBase(
  invoiceNumber: string | null,
  jobCardNumber: number | null | undefined,
  invoiceId: string,
): string {
  return (
    displayInvoiceNumber({ invoiceNumber, jobCardNumber }) ??
    invoiceNumber?.trim() ??
    invoiceId
  );
}

export function DownloadInvoicePdfButton({
  orderId,
  invoiceId,
  jobCardNumber = null,
  invoiceNumber,
  locale,
}: Props) {
  const t = useTranslations("billing");
  const [loading, setLoading] = useState(false);

  async function onDownload() {
    if (loading) {
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(
        `/orders/${orderId}/invoices/${invoiceId}/pdf?locale=${locale}`,
      );
      if (!response.ok) {
        throw new Error("pdf_failed");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="([^"]+)"/);
      const filename =
        match?.[1] ??
        `${invoicePdfFileBase(invoiceNumber, jobCardNumber, invoiceId)}.pdf`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      // Parent toast / silent — keep button usable
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={loading}
      onClick={() => void onDownload()}
    >
      {loading ? t("downloadingPdf") : t("downloadPdf")}
    </Button>
  );
}
