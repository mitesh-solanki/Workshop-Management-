"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FileText, Upload } from "lucide-react";
import { listPaperCopiesAction } from "@/app/actions/service-orders";
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
import { toast } from "@/components/ui/toast";
import {
  LiveMediaLightbox,
  type LiveMediaItem,
} from "@/modules/live-link/components/live-media-gallery";
import { uploadPaperJobCardFiles } from "@/modules/service-orders/components/upload-paper-job-card";

export type HardCopyItem = {
  id: string;
  contentType: string;
  fileName: string | null;
  url: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceOrderId: string;
  customerId: string;
  vehicleId?: string;
  label: string;
  canUpload?: boolean;
  copies?: HardCopyItem[];
};

const MAX_FILES = 5;

function toImages(copies: HardCopyItem[]): LiveMediaItem[] {
  return copies
    .filter(
      (copy) =>
        Boolean(copy.url) && copy.contentType.toLowerCase().startsWith("image/"),
    )
    .map((copy) => ({
      id: copy.id,
      kind: "PHOTO" as const,
      url: copy.url as string,
      itemLabel: copy.fileName?.trim() || copy.id,
    }));
}

function toPdfs(copies: HardCopyItem[]) {
  return copies.filter(
    (copy) =>
      Boolean(copy.url) &&
      (copy.contentType.toLowerCase() === "application/pdf" ||
        (copy.fileName ?? "").toLowerCase().endsWith(".pdf")),
  );
}

export function HardCopyDialog({
  open,
  onOpenChange,
  serviceOrderId,
  customerId,
  vehicleId,
  label,
  canUpload = false,
  copies: copiesProp,
}: Props) {
  const t = useTranslations("orders");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [copies, setCopies] = useState<HardCopyItem[]>(copiesProp ?? []);
  const [loading, setLoading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [uploadPending, startUpload] = useTransition();

  useEffect(() => {
    if (copiesProp) setCopies(copiesProp);
  }, [copiesProp]);

  useEffect(() => {
    if (!open) {
      setLightboxIndex(null);
      return;
    }
    if (copiesProp) return;
    let cancelled = false;
    setLoading(true);
    void listPaperCopiesAction(serviceOrderId).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        toast.error(result.message);
        setCopies([]);
      } else {
        setCopies(
          result.copies.map((copy) => ({
            id: copy.id,
            contentType: copy.contentType,
            fileName: copy.fileName,
            url: copy.url,
          })),
        );
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, serviceOrderId, copiesProp]);

  const images = useMemo(() => toImages(copies), [copies]);
  const pdfs = useMemo(() => toPdfs(copies), [copies]);
  const remaining = Math.max(0, MAX_FILES - copies.length);
  const canAdd = canUpload && remaining > 0;

  function onPick(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (selected.length === 0 || remaining === 0) return;
    const files = selected.slice(0, remaining);
    startUpload(async () => {
      try {
        const result = await uploadPaperJobCardFiles({
          serviceOrderId,
          files,
          uploadFailedMessage: t("paperUploadFailed"),
          customerId,
          vehicleId,
          maxFiles: remaining,
        });
        toast.success(
          result.uploaded > 1
            ? t("paperUploadedMany", { count: result.uploaded })
            : (result.message ?? t("paperUploaded")),
        );
        const refreshed = await listPaperCopiesAction(serviceOrderId);
        if (refreshed.ok) {
          setCopies(
            refreshed.copies.map((copy) => ({
              id: copy.id,
              contentType: copy.contentType,
              fileName: copy.fileName,
              url: copy.url,
            })),
          );
        }
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : t("paperUploadFailed");
        toast.error(message);
      }
    });
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next && (lightboxIndex !== null || uploadPending)) return;
          onOpenChange(next);
          if (!next) setLightboxIndex(null);
        }}
      >
        <DialogContent
          className="gap-0 p-0 sm:max-w-md"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onFocusOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            if (lightboxIndex !== null || uploadPending) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (lightboxIndex !== null || uploadPending) event.preventDefault();
          }}
        >
          <DialogHeader className="border-b border-border px-5 py-4 pr-12 text-left">
            <DialogTitle>{t("paperTitle")}</DialogTitle>
            <DialogDescription>
              {t("paperUploadDescription", { label })}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3 px-5 py-4">
            <p className="text-sm text-muted-foreground">{t("paperHint")}</p>
            {loading ? (
              <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
            ) : null}
            {!loading && images.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5">
                {images.map((item, index) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setLightboxIndex(index)}
                      aria-label={item.itemLabel}
                      className="relative size-28 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-slate-50 transition hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:size-32"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.url}
                        alt={item.itemLabel}
                        className="size-full object-cover"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {!loading && pdfs.length > 0 ? (
              <ul className="space-y-2">
                {pdfs.map((copy) => (
                  <li key={copy.id}>
                    <a
                      href={copy.url ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
                    >
                      <FileText className="size-4 shrink-0" aria-hidden />
                      <span className="truncate">
                        {copy.fileName?.trim() || t("paperTitle")}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
            {!loading && images.length === 0 && pdfs.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("paperEmpty")}</p>
            ) : null}
            {canAdd ? (
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                multiple
                className="hidden"
                disabled={uploadPending}
                onChange={onPick}
              />
            ) : null}
          </DialogBody>
          <DialogFooter className="gap-2 border-t border-border bg-background px-5 py-4 sm:justify-end">
            <DialogClose asChild>
              <Button
                type="button"
                variant="secondary"
                size="md"
                disabled={uploadPending}
              >
                {t("cancelEdit")}
              </Button>
            </DialogClose>
            {canAdd ? (
              <Button
                type="button"
                size="md"
                loading={uploadPending}
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="size-4" aria-hidden />
                {uploadPending ? t("paperUploading") : t("paperUpload")}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {lightboxIndex !== null && images.length > 0 ? (
        <LiveMediaLightbox
          items={images}
          activeIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      ) : null}
    </>
  );
}
