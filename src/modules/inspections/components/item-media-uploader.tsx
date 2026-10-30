"use client";

import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Camera, Film, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { compressImageFile } from "@/lib/compress-image";
import { uploadBlobToStorageTarget } from "@/lib/client-storage-upload";
import {
  confirmMediaUploadAction,
  removeMediaAction,
  requestMediaUploadUrlAction,
} from "@/app/actions/inspections";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type MediaRow = {
  id: string;
  kind: "PHOTO" | "VIDEO";
  url: string;
  contentType: string;
};

type Props = {
  inspectionId: string;
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
  /** Keep parent draft media in sync after upload/remove (client forms). */
  onMediaChange?: (media: MediaRow[]) => void;
};

export function ItemMediaUploader({
  inspectionId,
  itemId,
  media,
  canEdit,
  compact = false,
  proofButton = false,
  showGallery = true,
  showControls = true,
  trailingActions,
  onMediaChange,
}: Props) {
  const t = useTranslations("inspections");
  const router = useRouter();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const proofInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  /** Hide thumbnails immediately on remove — don't wait for router.refresh(). */
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const busy = uploading || removingId != null;
  const visibleMedia = media.filter((m) => !removedIds.includes(m.id));

  async function uploadFile(file: File, kind: "PHOTO" | "VIDEO") {
    setError(null);
    setUploading(true);

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

      const uploaded = await uploadBlobToStorageTarget({
        target: signed,
        blob,
        contentType,
      });

      const created = await confirmMediaUploadAction({
        inspectionItemId: itemId,
        kind,
        storageKey: uploaded.storageKey,
        contentType,
        byteSize: blob.size,
        inspectionId,
      });

      const nextMedia: MediaRow[] = [
        ...media.filter((row) => !removedIds.includes(row.id)),
        {
          id: created.id,
          kind: created.kind,
          url: created.url,
          contentType: created.contentType,
        },
      ];
      onMediaChange?.(nextMedia);
      toast.success(t("mediaUploaded"));
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("uploadFailed");
      setError(message);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }

  function onPick(
    event: React.ChangeEvent<HTMLInputElement>,
    kind: "PHOTO" | "VIDEO",
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy) {
      return;
    }
    void uploadFile(file, kind);
  }

  function onProofPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy) {
      return;
    }
    const kind: "PHOTO" | "VIDEO" = file.type.startsWith("video/")
      ? "VIDEO"
      : "PHOTO";
    void uploadFile(file, kind);
  }

  async function onRemove(mediaId: string) {
    setError(null);
    setRemovingId(mediaId);
    try {
      const result = await removeMediaAction(mediaId, inspectionId);
      if (!result.ok) {
        const message = result.message ?? t("uploadFailed");
        setError(message);
        toast.error(message);
        return;
      }
      setRemovedIds((prev) =>
        prev.includes(mediaId) ? prev : [...prev, mediaId],
      );
      onMediaChange?.(
        media.filter(
          (row) => row.id !== mediaId && !removedIds.includes(row.id),
        ),
      );
      toast.success(t("mediaRemoved"));
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("uploadFailed");
      setError(message);
      toast.error(message);
    } finally {
      setRemovingId(null);
    }
  }

  const controlsVisible = showControls && (canEdit || trailingActions);
  const galleryVisible = showGallery && visibleMedia.length > 0;

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
              disabled={busy}
              onChange={onProofPick}
            />
          ) : (
            <>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                disabled={busy}
                onChange={(e) => onPick(e, "PHOTO")}
              />
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                disabled={busy}
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
          {visibleMedia.map((m) => (
            <li
              key={m.id}
              className={cn(
                "relative size-16 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50 sm:size-20",
                removingId === m.id && "opacity-50",
              )}
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
              {removingId === m.id ? (
                <span className="absolute inset-0 flex items-center justify-center bg-slate-900/45">
                  <Loader2
                    className="size-5 animate-spin text-white"
                    aria-hidden
                  />
                </span>
              ) : null}
              {canEdit ? (
                <button
                  type="button"
                  disabled={busy}
                  aria-label={t("removeMedia")}
                  className="absolute top-0.5 right-0.5 flex size-5 items-center justify-center rounded-full bg-slate-900/80 text-white disabled:opacity-60"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void onRemove(m.id);
                  }}
                >
                  {removingId === m.id ? (
                    <Loader2 className="size-3 animate-spin" aria-hidden />
                  ) : (
                    <X className="size-3" aria-hidden />
                  )}
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
              disabled={busy}
              title={t("proofMediaHint")}
              aria-busy={uploading}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-xs font-bold text-white hover:bg-blue-700",
                busy && "opacity-60",
              )}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (!busy) proofInputRef.current?.click();
              }}
            >
              {uploading ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
              ) : (
                <Camera className="size-3.5 shrink-0" aria-hidden />
              )}
              {uploading ? t("uploading") : t("proofMedia")}
            </button>
          ) : null}
          {canEdit && showControls && !proofButton ? (
            <>
              <button
                type="button"
                disabled={busy}
                title={t("addPhoto")}
                aria-busy={uploading}
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50",
                  busy && "opacity-60",
                )}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (!busy) photoInputRef.current?.click();
                }}
              >
                {uploading ? (
                  <Loader2
                    className="size-3.5 shrink-0 animate-spin"
                    aria-hidden
                  />
                ) : (
                  <Camera className="size-3.5 shrink-0" aria-hidden />
                )}
                {uploading ? t("uploading") : t("addPhoto")}
              </button>
              <button
                type="button"
                disabled={busy}
                title={t("addVideo")}
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50",
                  busy && "opacity-60",
                )}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (!busy) videoInputRef.current?.click();
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
