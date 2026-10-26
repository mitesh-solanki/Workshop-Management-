"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  InvoicePreviewDialog,
  type InvoicePreviewData,
} from "@/modules/billing/components/invoice-preview-dialog";

type Props = {
  data: InvoicePreviewData;
  variant?: "default" | "outline" | "soft";
  label?: string;
};

export function InvoicePreviewButton({ data, variant = "outline", label }: Props) {
  const t = useTranslations("billing");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant={variant === "soft" ? "secondary" : variant}
        size="sm"
        className="min-h-10"
        onClick={() => setOpen(true)}
      >
        {label ?? t("previewBill")}
      </Button>
      <InvoicePreviewDialog
        open={open}
        onOpenChange={setOpen}
        data={data}
        onPrint={() => {
          setOpen(true);
          window.setTimeout(() => window.print(), 150);
        }}
      />
    </>
  );
}
