"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ImportWizard } from "@/modules/data-import/components/import-wizard";
import type { ImportEntity } from "@/modules/data-import/schema";

type Props = {
  entity: ImportEntity;
  trigger?: React.ReactNode;
  size?: "sm" | "md";
};

export function ImportModal({ entity, trigger, size = "md" }: Props) {
  const t = useTranslations("dataImport");
  const [open, setOpen] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="secondary" size={size}>
            <Upload className="size-4" aria-hidden />
            {t("importButton")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(92vh,880px)] w-[calc(100%-1rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:w-[calc(100%-1.5rem)] sm:max-w-3xl lg:max-w-3xl">
        <DialogHeader className="shrink-0 border-b border-border px-4 py-4 text-left sm:px-5">
          <DialogTitle>{t(`titles.${entity}`)}</DialogTitle>
          <DialogDescription>{t("subtitleModule")}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {open ? (
            <ImportWizard
              key={entity}
              entity={entity}
              onDone={() => setOpen(false)}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
