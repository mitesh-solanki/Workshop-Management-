"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

export type InspectionReportPdfDraft = {
  items: Array<{
    description: string;
    quantity: number;
    unitPricePaise: number;
    lineTotalPaise: number;
  }>;
  checkedOkLabels: string[];
  externalLabels: string[];
  expectedCompletion: string | null;
  complaint: string | null;
  recommendedNotes: string | null;
};

type Props = {
  inspectionId: string;
  registrationNumber: string;
  draft: InspectionReportPdfDraft;
};

export function DownloadInspectionReportPdfButton({
  inspectionId,
  registrationNumber,
  draft,
}: Props) {
  const t = useTranslations("inspections");
  const [loading, setLoading] = useState(false);

  async function onDownload() {
    if (loading) return;
    setLoading(true);
    try {
      const response = await fetch(`/inspections/${inspectionId}/report/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!response.ok) {
        throw new Error("pdf_failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `inspection-report-${registrationNumber}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t("reportPdfFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="md"
      className="min-h-11"
      loading={loading}
      disabled={loading}
      onClick={onDownload}
    >
      {loading ? t("reportDownloadingPdf") : t("reportDownloadPdf")}
    </Button>
  );
}
