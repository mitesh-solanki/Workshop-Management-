"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  EditPartModal,
  type EditPartValues,
} from "@/modules/inventory/components/edit-part-modal";

type Props = {
  part: EditPartValues;
  canWrite: boolean;
};

export function InventoryRowActions({ part, canWrite }: Props) {
  const t = useTranslations("inventory");

  return (
    <div
      className="flex items-center gap-1.5"
      data-row-stop
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <Button asChild variant="outline" size="icon-sm">
        <Link href={`/inventory/${part.id}`} aria-label={t("view")}>
          <Eye className="size-4" aria-hidden />
        </Link>
      </Button>
      {canWrite ? <EditPartModal part={part} /> : null}
    </div>
  );
}
