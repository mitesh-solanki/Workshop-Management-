"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FileText, ImageIcon, Upload, X } from "lucide-react";
import { removePaperCopyAction } from "@/app/actions/service-orders";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  LiveMediaLightbox,
  type LiveMediaItem,
} from "@/modules/live-link/components/live-media-gallery";
import { uploadPaperJobCardFiles } from "@/modules/service-orders/components/upload-paper-job-card";

export type PaperCopyView = {
  id: string;
  url: string | null;
  contentType: string;
  fileName: string | null;
  byteSize: number;
};

type Props = {
  serviceOrderId: string;
  customerId: string;
  vehicleId: string;
  canEdit: boolean;
  copies: PaperCopyView[];
  embedded?: boolean;
};

const MAX_FILES = 5;

function isImageContentType(contentType: string) {
  return contentType.toLowerCase().startsWith("image/");
}

function usePaperUpload({
  serviceOrderId,
  customerId,
  vehicleId,
  canEdit,
  remaining,
}: {
  serviceOrderId: string;
  customerId: string;
  vehicleId: string;
  canEdit: boolean;
  remaining: number;
}) {
  const t = useTranslations("orders");
  const router = useRouter();
  const addInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const atLimit = remaining === 0;

  function openPicker() {
    if (!canEdit || atLimit || pending) return;
    addInputRef.current?.click();
  }

  function onAddFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (selected.length === 0) return;
    const files = selected.slice(0, remaining);
    startTransition(async () => {
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
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : t("paperUploadFailed");
        toast.error(message);
      }
    });
  }

  const fileInput = canEdit ? (
    <input
      ref={addInputRef}
      type="file"
      accept="image/jpeg,image/png,image/webp,application/pdf"
      multiple
      className="hidden"
      disabled={pending}
      onChange={onAddFiles}
    />
  ) : null;

  return { pending, atLimit, openPicker, fileInput };
}

export function PaperJobCardHeaderUpload({
  serviceOrderId,
  customerId,
  vehicleId,
  canEdit,
  copyCount,
}: {
  serviceOrderId: string;
  customerId: string;
  vehicleId: string;
  canEdit: boolean;
  copyCount: number;
}) {
  const t = useTranslations("orders");
  const remaining = Math.max(0, MAX_FILES - copyCount);
  const { pending, atLimit, openPicker, fileInput } = usePaperUpload({
    serviceOrderId,
    customerId,
    vehicleId,
    canEdit,
    remaining,
  });

  if (!canEdit || atLimit) return null;

  return (
    <div className="shrink-0 self-center sm:self-start">
      {fileInput}
      <Button
        type="button"
        size="md"
        variant={copyCount > 0 ? "secondary" : "default"}
        loading={pending}
        onClick={openPicker}
      >
        <Upload className="size-4" aria-hidden />
        {pending ? t("paperUploading") : t("paperUpload")}
      </Button>
    </div>
  );
}

export function PaperJobCardPanel({
  serviceOrderId,
  customerId,
  vehicleId,
  canEdit,
  copies,
  embedded = false,
}: Props) {
  const t = useTranslations("orders");
  const router = useRouter();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [, startTransitionRemove] = useTransition();
  const remaining = Math.max(0, MAX_FILES - copies.length);
  const { pending, atLimit, openPicker, fileInput } = usePaperUpload({
    serviceOrderId,
    customerId,
    vehicleId,
    canEdit,
    remaining,
  });
  const removeBusy = removingId != null;
  const busy = pending || removeBusy;
  const lightboxItems: LiveMediaItem[] = useMemo(
    () =>
      copies
        .filter(
          (copy) =>
            Boolean(copy.url) && isImageContentType(copy.contentType),
        )
        .map((copy, index) => ({
          id: copy.id,
          kind: "PHOTO" as const,
          url: copy.url as string,
          itemLabel:
            copy.fileName ?? t("paperPageLabel", { page: index + 1 }),
        })),
    [copies, t],
  );

  function onRemove(paperCopyId: string) {
    if (removingId != null) return;
    setRemovingId(paperCopyId);
    startTransitionRemove(async () => {
      try {
        const result = await removePaperCopyAction({
          serviceOrderId,
          paperCopyId,
          customerId,
          vehicleId,
        });
        if (!result.ok) {
          toast.error(result.message ?? t("paperUploadFailed"));
          return;
        }
        toast.success(result.message ?? t("paperRemoved"));
        setViewerIndex(null);
        router.refresh();
      } finally {
        setRemovingId(null);
      }
    });
  }

  const uploadButton =
    canEdit && !atLimit && !embedded ? (
      <Button
        type="button"
        size="md"
        variant={copies.length > 0 ? "secondary" : "default"}
        loading={pending}
        onClick={openPicker}
      >
        <Upload className="size-4" aria-hidden />
        {pending ? t("paperUploading") : t("paperUpload")}
      </Button>
    ) : null;

  return (
    <div
      className={cn(
        "w-full space-y-4",
        !embedded && "rounded-xl border border-border bg-card p-4 sm:p-5",
      )}
    >
      {!embedded ? fileInput : null}

      {!embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 text-sm text-[#5c6b7e]">{t("paperHint")}</p>
          {uploadButton}
        </div>
      ) : null}

      {copies.length === 0 ? (
        canEdit && !atLimit ? (
          <button
            type="button"
            disabled={busy}
            onClick={openPicker}
            className={cn(
              "flex min-h-56 w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[#d7deea] bg-[#f8fafc] px-4 py-10 text-center transition-colors",
              "hover:border-[#1f5eff]/50 hover:bg-[#e8efff]/40",
              busy && "opacity-60",
            )}
          >
            {embedded ? fileInput : null}
            <span className="flex size-16 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
              <ImageIcon className="size-8" aria-hidden />
            </span>
            <span className="text-[15px] font-semibold text-[#152238]">
              {pending ? t("paperUploading") : t("paperEmptyAction")}
            </span>
            <span className="max-w-sm text-sm text-[#5c6b7e]">
              {t("paperEmptyFormats")}
            </span>
          </button>
        ) : (
          <p className="rounded-2xl border border-dashed border-[#d7deea] bg-[#f8fafc] px-4 py-10 text-center text-sm text-[#5c6b7e]">
            {t("paperEmpty")}
          </p>
        )
      ) : (
        <>
          {embedded ? fileInput : null}
          <ul className="flex flex-wrap gap-2">
            {copies.map((copy, index) => {
              const isImage = Boolean(
                copy.url && isImageContentType(copy.contentType),
              );
              const galleryIndex = lightboxItems.findIndex(
                (item) => item.id === copy.id,
              );
              const label =
                copy.fileName ?? t("paperPageLabel", { page: index + 1 });
              return (
                <li
                  key={copy.id}
                  className={cn(
                    "relative size-36 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-slate-50 sm:size-44",
                    removingId === copy.id && "opacity-50",
                  )}
                >
                  {isImage && copy.url ? (
                    <button
                      type="button"
                      className="absolute inset-0 block size-full cursor-pointer"
                      onClick={() => {
                        if (galleryIndex >= 0) setViewerIndex(galleryIndex);
                      }}
                      aria-label={label}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={copy.url}
                        alt={label}
                        className="size-full object-cover"
                      />
                    </button>
                  ) : (
                    <a
                      href={copy.url ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="absolute inset-0 flex size-full cursor-pointer flex-col items-center justify-center gap-1 px-1.5 text-center"
                      aria-label={label}
                    >
                      <FileText className="size-6 text-slate-400" aria-hidden />
                      <span className="max-w-full truncate text-[10px] font-medium text-slate-600">
                        {t("paperPageLabel", { page: index + 1 })}
                      </span>
                    </a>
                  )}

                  {canEdit ? (
                    <button
                      type="button"
                      disabled={busy}
                      aria-busy={removingId === copy.id}
                      aria-label={t("paperRemove")}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onRemove(copy.id);
                      }}
                      className={cn(
                        "absolute top-1 right-1 z-10 flex size-6 items-center justify-center rounded-full bg-slate-900/80 text-white",
                        "disabled:pointer-events-none disabled:opacity-60",
                      )}
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {canEdit && atLimit ? (
        <p className="text-sm text-[#5c6b7e]">{t("paperLimitHint")}</p>
      ) : null}

      {viewerIndex != null && lightboxItems[viewerIndex] ? (
        <LiveMediaLightbox
          items={lightboxItems}
          activeIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onIndexChange={setViewerIndex}
        />
      ) : null}
    </div>
  );
}
