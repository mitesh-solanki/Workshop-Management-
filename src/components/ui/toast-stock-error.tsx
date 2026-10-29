"use client";

import Link from "next/link";
import { toast } from "@/components/ui/toast";

/** Error toast with optional link to the part stock page. */
export function toastStockError(
  message: string,
  options?: {
    stockPartId?: string | null;
    viewStockLabel: string;
  },
) {
  const partId = options?.stockPartId?.trim();
  const viewStockLabel = options?.viewStockLabel;
  if (!partId || !viewStockLabel) {
    toast.error(message);
    return;
  }

  toast.error(
    <span className="inline">
      {message}{" "}
      <Link
        href={`/inventory/${partId}`}
        className="font-semibold underline underline-offset-2"
      >
        {viewStockLabel}
      </Link>
    </span>,
    { duration: 12_000 },
  );
}
