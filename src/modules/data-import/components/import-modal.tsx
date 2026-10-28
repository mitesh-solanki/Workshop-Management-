"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
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
      <DialogContent className="w-[calc(100%-1rem)] max-w-3xl gap-0 p-0 sm:w-[calc(100%-1.5rem)] sm:max-w-3xl lg:max-w-3xl">
        <DialogHeader className="border-b border-border px-4 py-4 text-left sm:px-5">
          <DialogTitle>{t(`titles.${entity}`)}</DialogTitle>
          <DialogDescription>{t("subtitleModule")}</DialogDescription>
        </DialogHeader>
        <DialogBody className="px-4 py-4 sm:px-5">
          {open ? (
            <ImportWizard
              key={entity}
              entity={entity}
              onDone={() => setOpen(false)}
            />
          ) : null}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
