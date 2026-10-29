"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { saveInvoiceLineWarrantyAction } from "@/app/actions/warranties";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { partRequiresWarrantyCard } from "@/modules/warranties/part-requires-warranty";
import { WarrantyCardPhotoField } from "@/modules/warranties/components/warranty-card-photo-field";
import { uploadWarrantyCardFile } from "@/modules/warranties/components/upload-warranty-file";

type LineWarrantyDoc = {
  id: string;
  warrantyExpiresAt: Date | string | null;
  storageKey: string | null;
  contentType?: string | null;
  byteSize?: number | null;
  fileName: string | null;
  url: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  invoiceId: string;
  vehicleId: string;
  lineId: string;
  lineDescription: string;
  doc: LineWarrantyDoc | null;
  onSaveStart?: () => void;
  onSaveSuccess?: () => void;
  onSaveError?: () => void;
};

function toDateInput(value: Date | string | null): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function InvoiceLineWarrantyModal({
  open,
  onOpenChange,
  orderId,
  invoiceId,
  vehicleId,
  lineId,
  lineDescription,
  doc,
  onSaveStart,
  onSaveSuccess,
  onSaveError,
}: Props) {
  const t = useTranslations("warranties");
  const idPrefix = useId();
  const required = partRequiresWarrantyCard(lineDescription);
  const [expiry, setExpiry] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [photoCleared, setPhotoCleared] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setExpiry(toDateInput(doc?.warrantyExpiresAt ?? null));
    setFile(null);
    setPhotoCleared(false);
    setPending(false);
  }, [open, doc?.id, doc?.warrantyExpiresAt, doc?.storageKey]);

  const showExistingPhoto = Boolean(doc?.storageKey) && !photoCleared && !file;
  const hasPhoto = Boolean(file || showExistingPhoto);
  const hasExpiry = Boolean(expiry.trim());
  const canSave = required
    ? hasExpiry && hasPhoto
    : hasExpiry || hasPhoto || Boolean(doc);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;

    if (required && !hasExpiry) {
      toast.error(t("errors.batteryExpiryRequired"));
      return;
    }
    if (required && !hasPhoto) {
      toast.error(t("errors.batteryPhotoRequired"));
      return;
    }
    if (!hasExpiry && !hasPhoto && !doc) {
      toast.error(t("errors.emptyDocument"));
      return;
    }

    setPending(true);
    onSaveStart?.();

    try {
      let storageKey: string | null = null;
      let contentType: string | null = null;
      let byteSize: number | null = null;
      let fileName: string | null = null;

      if (file) {
        const uploaded = await uploadWarrantyCardFile({
          vehicleId,
          file,
          uploadFailedMessage: t("uploadFailed"),
        });
        storageKey = uploaded.storageKey;
        contentType = uploaded.contentType;
        byteSize = uploaded.byteSize;
        fileName = uploaded.fileName;
      } else if (showExistingPhoto) {
        storageKey = doc?.storageKey ?? null;
        contentType = doc?.contentType ?? null;
        byteSize = doc?.byteSize ?? null;
        fileName = doc?.fileName ?? null;
      }

      const result = await saveInvoiceLineWarrantyAction({
        orderId,
        invoiceId,
        invoiceLineId: lineId,
        warrantyExpiresAt: expiry || undefined,
        storageKey,
        contentType,
        byteSize,
        fileName,
      });

      if (!result.ok) {
        setPending(false);
        onSaveError?.();
        toast.error(result.message ?? t("error"));
        return;
      }

      toast.success(t("created"));
      onSaveSuccess?.();
      onOpenChange(false);
    } catch (error) {
      setPending(false);
      onSaveError?.();
      toast.error(
        error instanceof Error ? error.message : t("uploadFailed"),
      );
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="gap-0 p-0 sm:max-w-md"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => {
          if (pending) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <DialogHeader className="border-b border-border px-5 py-4 pr-12 text-left">
          <DialogTitle>
            {doc ? t("editLineTitle") : t("addLineTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("addLineSubtitle", { part: lineDescription })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="px-5 py-4">
          <form
            id={`${idPrefix}-form`}
            onSubmit={onSubmit}
            className="flex flex-col gap-4"
          >
            {required ? (
              <p className="text-caption text-amber-800">{t("batteryHint")}</p>
            ) : (
              <p className="text-caption text-slate-600">{t("optionalHint")}</p>
            )}
            <FormField
              id={`${idPrefix}-expiry`}
              label={required ? `${t("expiry")} *` : t("expiry")}
            >
              <Input
                id={`${idPrefix}-expiry`}
                type="date"
                value={expiry}
                onChange={(event) => setExpiry(event.target.value)}
                required={required}
                disabled={pending}
                className="h-11 min-h-11"
              />
            </FormField>
            <WarrantyCardPhotoField
              id={`${idPrefix}-file`}
              label={required ? `${t("cardPhoto")} *` : t("cardPhoto")}
              file={file}
              onChange={(next) => {
                if (!next) {
                  setFile(null);
                  setPhotoCleared(true);
                  return;
                }
                setPhotoCleared(false);
                setFile(next);
              }}
              existingUrl={showExistingPhoto ? doc?.url : null}
              existingFileName={showExistingPhoto ? doc?.fileName : null}
              existingContentType={
                showExistingPhoto ? doc?.contentType : null
              }
              required={required}
              disabled={pending}
            />
          </form>
        </DialogBody>
        <DialogFooter className="gap-2 border-t border-border bg-background px-5 py-4 sm:justify-end">
          <DialogClose asChild>
            <Button type="button" variant="outline" size="md" disabled={pending}>
              {t("cancel")}
            </Button>
          </DialogClose>
          <Button
            type="submit"
            form={`${idPrefix}-form`}
            size="md"
            disabled={pending || !canSave}
            className="text-white"
          >
            {pending ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
