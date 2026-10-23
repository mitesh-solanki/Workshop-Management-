"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  serviceOrderId: string;
};

export function InvoiceRowActions({ serviceOrderId }: Props) {
  const t = useTranslations("invoices");

  return (
    <div
      className="flex items-center gap-1.5"
      data-row-stop
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <Button asChild variant="outline" size="icon-sm">
        <Link
          href={`/orders/${serviceOrderId}?section=billing`}
          aria-label={t("view")}
        >
          <Eye className="size-4" aria-hidden />
        </Link>
      </Button>
    </div>
  );
}
