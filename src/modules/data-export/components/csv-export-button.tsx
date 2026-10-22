"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type Props = {
  href: string;
  label: string;
  size?: "sm" | "md" | "lg";
  variant?: "secondary" | "outline" | "ghost";
  className?: string;
};

function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].trim());
    } catch {
      return utf8[1].trim();
    }
  }
  const plain = /filename="([^"]+)"/i.exec(header);
  return plain?.[1]?.trim() || null;
}

/**
 * Fetches a CSV export route and downloads the file.
 * Disables the button (with spinner) while the response is generating.
 */
export function CsvExportButton({
  href,
  label,
  size = "md",
  variant = "secondary",
  className,
}: Props) {
  const t = useTranslations("common");
  const [pending, setPending] = useState(false);

  async function handleExport() {
    if (pending) return;
    setPending(true);
    try {
      const response = await fetch(href, { method: "GET" });
      if (!response.ok) {
        throw new Error(`export_failed_${response.status}`);
      }
      const blob = await response.blob();
      const filename =
        filenameFromDisposition(response.headers.get("Content-Disposition")) ??
        "export.csv";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Keep UX quiet; toast system is not used on these list pages yet.
      window.alert(t("error"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      loading={pending}
      disabled={pending}
      onClick={() => {
        void handleExport();
      }}
    >
      {pending ? t("exporting") : label}
    </Button>
  );
}
