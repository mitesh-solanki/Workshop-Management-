"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type Props = {
  orderId: string;
  invoiceId: string;
  /** Job Card number used as the download file name. */
  jobCardNumber: number | null;
  /** Fallback when job card number is missing (legacy). */
  invoiceNumber: string | null;
  locale: string;
};

export function DownloadInvoicePdfButton({
  orderId,
  invoiceId,
  jobCardNumber,
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
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      const fileBase =
        jobCardNumber != null
          ? String(jobCardNumber)
          : (invoiceNumber ?? invoiceId);
      anchor.download = `${fileBase}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Keep the button usable; server already logged failures.
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="min-h-11 text-blue-700"
      loading={loading}
      disabled={loading}
      onClick={onDownload}
    >
      {loading ? t("downloadingPdf") : t("downloadPdf")}
    </Button>
  );
}
