"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function NewInspectionButton() {
  const t = useTranslations("inspections");

  return (
    <Button
      type="button"
      size="md"
      onClick={() => {
        window.location.assign("/inspections/new");
      }}
    >
      <Plus className="size-4" aria-hidden />
      {t("newInspection")}
    </Button>
  );
}
