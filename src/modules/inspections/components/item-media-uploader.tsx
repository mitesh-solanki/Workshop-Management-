"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { compressImageFile } from "@/lib/compress-image";
import {
  confirmMediaUploadAction,
  removeMediaAction,
  requestMediaUploadUrlAction,
} from "@/app/actions/inspections";

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
};

export function ItemMediaUploader({ orderId, itemId, media, canEdit }: Props) {
  const t = useTranslations("inspections");
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

  return (
    <div className="space-y-3">
      {media.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {media.map((m) => (
            <li
              key={m.id}
              className="relative overflow-hidden rounded-md border bg-secondary/40"
            >
              {m.kind === "PHOTO" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.url}
                  alt=""
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <video
                  src={m.url}
                  controls
                  className="aspect-square w-full object-cover"
                  preload="metadata"
                />
              )}
              {canEdit && (
                <button
                  type="button"
                  disabled={pending}
                  className="absolute bottom-1 right-1 min-h-10 rounded-md bg-background/90 px-2 text-xs font-medium"
                  onClick={() =>
                    startTransition(async () => {
                      setError(null);
                      const result = await removeMediaAction(m.id, orderId);
                      if (!result.ok) {
                        setError(result.message ?? t("uploadFailed"));
                      }
                    })
                  }
                >
                  {t("removeMedia")}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center rounded-md border px-4 text-base font-medium">
            {pending ? t("uploading") : t("addPhoto")}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              disabled={pending}
              onChange={(e) => onPick(e, "PHOTO")}
            />
          </label>
          <label className="inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center rounded-md border px-4 text-base font-medium">
            {pending ? t("uploading") : t("addVideo")}
            <input
              type="file"
              accept="video/*"
              capture="environment"
              className="sr-only"
              disabled={pending}
              onChange={(e) => onPick(e, "VIDEO")}
            />
          </label>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive" role="status">
          {error}
        </p>
      )}
    </div>
  );
}
