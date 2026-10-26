"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Camera, Film, X } from "lucide-react";
import { compressImageFile } from "@/lib/compress-image";
import {
  confirmMediaUploadAction,
  removeMediaAction,
  requestMediaUploadUrlAction,
} from "@/app/actions/inspections";
import { cn } from "@/lib/utils";

type MediaRow = {
  id: string;
  kind: "PHOTO" | "VIDEO";
  url: string;
  contentType: string;
};

type Props = {
  orderId: string;
  itemId: string;
  media: MediaRow[];
  canEdit: boolean;
  /** Tighter controls for checklist rows. */
  compact?: boolean;
  /**
   * Single blue “Proof” control that accepts photo or video.
   * When set, the split Add photo / Add video buttons are hidden.
   */
  proofButton?: boolean;
  /** When false, thumbnails are not rendered (use a second instance for gallery). */
  showGallery?: boolean;
  /** When false, upload controls are hidden (gallery / read-only strip). */
  showControls?: boolean;
  /** e.g. Save — sits on the right of the photo/video row. */
  trailingActions?: ReactNode;
};

export function ItemMediaUploader({
  orderId,
  itemId,
  media,
  canEdit,
  compact = false,
  proofButton = false,
  showGallery = true,
  showControls = true,
  trailingActions,
}: Props) {
  const t = useTranslations("inspections");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const proofInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function uploadFile(file: File, kind: "PHOTO" | "VIDEO") {
    setError(null);
    try {
      let blob: Blob = file;
      let contentType = file.type || "application/octet-stream";

      if (kind === "PHOTO") {
        const compressed = await compressImageFile(file);
        blob = compressed.blob;
        contentType = compressed.contentType;
      }

      const signed = await requestMediaUploadUrlAction({
        inspectionItemId: itemId,
        kind,
        contentType,
        byteSize: blob.size,
      });

      const put = await fetch(signed.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: blob,
      });
      if (!put.ok) {
        throw new Error(t("uploadFailed"));
      }

      await confirmMediaUploadAction({
        inspectionItemId: itemId,
        kind,
        storageKey: signed.storageKey,
        contentType,
        byteSize: blob.size,
        orderId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("uploadFailed"));
    }
  }

  function onPick(
    event: React.ChangeEvent<HTMLInputElement>,
    kind: "PHOTO" | "VIDEO",
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    startTransition(() => {
      void uploadFile(file, kind);
    });
  }

  function onProofPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    const kind: "PHOTO" | "VIDEO" = file.type.startsWith("video/")
      ? "VIDEO"
      : "PHOTO";
    startTransition(() => {
      void uploadFile(file, kind);
    });
  }

  const controlsVisible = showControls && (canEdit || trailingActions);
  const galleryVisible = showGallery && media.length > 0;

  if (!galleryVisible && !controlsVisible && !error) {
    return null;
  }

  return (
    <div className={cn("space-y-1.5", compact && "sm:contents")}>
      {canEdit && showControls ? (
        <>
          {proofButton ? (
            <input
              ref={proofInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              disabled={pending}
              onChange={onProofPick}
            />
          ) : (
            <>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                disabled={pending}
                onChange={(e) => onPick(e, "PHOTO")}
              />
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                disabled={pending}
                onChange={(e) => onPick(e, "VIDEO")}
              />
            </>
          )}
        </>
      ) : null}

      {galleryVisible ? (
        <ul
          className={cn(
            "flex flex-wrap gap-1.5",
            compact && "order-last w-full basis-full",
          )}
        >
          {media.map((m) => (
            <li
              key={m.id}
              className="relative size-16 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50 sm:size-20"
            >
              {m.kind === "PHOTO" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt="" className="size-full object-cover" />
              ) : (
                <video
                  src={m.url}
                  className="size-full object-cover"
                  preload="metadata"
                  muted
                />
              )}
              {canEdit ? (
                <button
                  type="button"
                  disabled={pending}
                  aria-label={t("removeMedia")}
                  className="absolute top-0.5 right-0.5 flex size-5 items-center justify-center rounded-full bg-slate-900/80 text-white"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    startTransition(async () => {
                      setError(null);
                      const result = await removeMediaAction(m.id, orderId);
                      if (!result.ok) {
                        setError(result.message ?? t("uploadFailed"));
                      }
                    });
                  }}
                >
                  <X className="size-3" aria-hidden />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {controlsVisible ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {canEdit && showControls && proofButton ? (
            <button
              type="button"
              disabled={pending}
              title={t("proofMediaHint")}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-xs font-bold text-white hover:bg-blue-700",
                pending && "opacity-60",
              )}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                proofInputRef.current?.click();
              }}
            >
              <Camera className="size-3.5 shrink-0" aria-hidden />
              {pending ? t("saving") : t("proofMedia")}
            </button>
          ) : null}
          {canEdit && showControls && !proofButton ? (
            <>
              <button
                type="button"
                disabled={pending}
                title={t("addPhoto")}
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50",
                  pending && "opacity-60",
                )}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  photoInputRef.current?.click();
                }}
              >
                <Camera className="size-3.5 shrink-0" aria-hidden />
                {t("addPhoto")}
              </button>
              <button
                type="button"
                disabled={pending}
                title={t("addVideo")}
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50",
                  pending && "opacity-60",
                )}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  videoInputRef.current?.click();
                }}
              >
                <Film className="size-3.5 shrink-0" aria-hidden />
                {t("addVideo")}
              </button>
            </>
          ) : null}
          {trailingActions ? (
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {trailingActions}
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="text-xs text-red-600" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}
