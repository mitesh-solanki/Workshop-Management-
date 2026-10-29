"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";

type Props = {
  id?: string;
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
  /** Existing saved card preview (invoice / list). */
  existingUrl?: string | null;
  existingFileName?: string | null;
  existingContentType?: string | null;
  required?: boolean;
  disabled?: boolean;
  changeLabel?: string;
  uploadLabel?: string;
  replaceLabel?: string;
};

function isImageFile(file: File) {
  return file.type.startsWith("image/");
}

function looksLikeImage(
  url?: string | null,
  fileName?: string | null,
  contentType?: string | null,
) {
  if (contentType?.startsWith("image/")) return true;
  const source = `${fileName ?? ""} ${url ?? ""}`.toLowerCase();
  return (
    /\.(jpe?g|png|webp|gif)(\?|$)/i.test(source) || source.includes("image/")
  );
}

export function WarrantyCardPhotoField({
  id: idProp,
  label,
  file,
  onChange,
  existingUrl,
  existingFileName,
  existingContentType,
  required,
  disabled,
  changeLabel,
  uploadLabel,
  replaceLabel,
}: Props) {
  const t = useTranslations("warranties");
  const autoId = useId();
  const id = idProp ?? autoId;
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file || !isImageFile(file)) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const showExisting = !file && Boolean(existingUrl);
  const buttonLabel = file
    ? (changeLabel ?? t("changePhoto"))
    : existingUrl
      ? (replaceLabel ?? t("replacePhoto"))
      : (uploadLabel ?? t("uploadPhoto"));

  function clearFile() {
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const removeButtonClassName =
    "absolute -top-1.5 -right-1.5 z-10 flex size-6 min-h-6 min-w-6 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm sm:-top-2 sm:-right-2";

  return (
    <FormField id={id} label={label}>
      <div className="flex flex-col items-start gap-2">
        {file ? (
          <div className="relative mt-2 mr-2 h-28 w-full max-w-[11rem] shrink-0">
            <div className="size-full overflow-hidden rounded-md border border-slate-200 bg-slate-50">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt={file.name}
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center px-2 text-center text-caption leading-tight text-slate-600">
                  {file.name}
                </div>
              )}
            </div>
            <button
              type="button"
              disabled={disabled}
              aria-label={t("clearPhoto")}
              className={removeButtonClassName}
              onClick={clearFile}
            >
              <X className="size-3" aria-hidden />
            </button>
          </div>
        ) : showExisting ? (
          <div className="relative mt-2 mr-2 h-28 w-full max-w-[11rem] shrink-0">
            <a
              href={existingUrl ?? undefined}
              target="_blank"
              rel="noreferrer"
              className="block size-full overflow-hidden rounded-md border border-slate-200 bg-slate-50"
              title={t("viewCard")}
            >
              {looksLikeImage(
                existingUrl,
                existingFileName,
                existingContentType,
              ) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={existingUrl ?? ""}
                  alt={existingFileName ?? t("cardPhoto")}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center px-2 text-center text-caption leading-tight text-slate-600">
                  {existingFileName ?? t("viewCard")}
                </span>
              )}
            </a>
            <button
              type="button"
              disabled={disabled}
              aria-label={t("clearPhoto")}
              className={removeButtonClassName}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                clearFile();
              }}
            >
              <X className="size-3" aria-hidden />
            </button>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            required={required && !file && !existingUrl}
            disabled={disabled}
            onChange={(event) => {
              onChange(event.target.files?.[0] ?? null);
            }}
          />
          <Button
            type="button"
            size="md"
            variant="secondary"
            disabled={disabled}
            className="h-11 min-h-11"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-4" aria-hidden />
            {buttonLabel}
          </Button>
        </div>
      </div>
    </FormField>
  );
}
