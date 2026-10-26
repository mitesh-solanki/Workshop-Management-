"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ExternalLink, FileText, Trash2, Upload } from "lucide-react";
import { removeVendorBillAttachmentAction } from "@/app/actions/purchases";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { uploadVendorBillAttachmentFile } from "@/modules/purchases/components/upload-vendor-bill-attachment";

type AttachmentInfo = {
  url: string | null;
  contentType: string | null;
  fileName: string | null;
};

type Props = {
  vendorBillId: string;
  canEdit: boolean;
  attachment: AttachmentInfo | null;
  embedded?: boolean;
  hideActions?: boolean;
};

function isImageContentType(contentType: string | null) {
  return Boolean(contentType?.toLowerCase().startsWith("image/"));
}

export function VendorBillAttachmentActions({
  vendorBillId,
  canEdit,
  hasAttachment,
}: {
  vendorBillId: string;
  canEdit: boolean;
  hasAttachment: boolean;
}) {
  const t = useTranslations("vendorBills");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  if (!canEdit) return null;

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    startTransition(async () => {
      try {
        const result = await uploadVendorBillAttachmentFile({
          vendorBillId,
          file,
          uploadFailedMessage: t("uploadFailed"),
        });
        toast.success(result.message ?? t("attachmentUploaded"));
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : t("uploadFailed");
        toast.error(message);
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        disabled={pending}
        onChange={onPick}
      />
      <Button
        type="button"
        size="md"
        variant={hasAttachment ? "secondary" : "default"}
        loading={pending}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="size-4" aria-hidden />
        {pending
          ? t("uploading")
          : hasAttachment
            ? t("replaceAttachment")
            : t("uploadAttachment")}
      </Button>
      {hasAttachment ? (
        <Button
          type="button"
          size="md"
          variant="secondary"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const result =
                await removeVendorBillAttachmentAction(vendorBillId);
              if (!result.ok) {
                toast.error(result.message ?? t("uploadFailed"));
                return;
              }
              toast.success(result.message ?? t("attachmentRemoved"));
              router.refresh();
            });
          }}
        >
          <Trash2 className="size-4" aria-hidden />
          {t("removeAttachment")}
        </Button>
      ) : null}
    </div>
  );
}

export function VendorBillAttachment({
  vendorBillId,
  canEdit,
  attachment,
  embedded = false,
  hideActions = false,
}: Props) {
  const t = useTranslations("vendorBills");
  const hasAttachment = Boolean(attachment?.url || attachment?.fileName);

  const actions =
    !hideActions && canEdit ? (
      <VendorBillAttachmentActions
        vendorBillId={vendorBillId}
        canEdit={canEdit}
        hasAttachment={hasAttachment}
      />
    ) : null;

  return (
    <section
      className={
        embedded
          ? "space-y-3"
          : "space-y-3 rounded-xl border border-border bg-card p-4 sm:p-5"
      }
    >
      {!embedded ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-section-title text-foreground">
              {t("attachmentTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("attachmentHint")}
            </p>
          </div>
          {actions}
        </div>
      ) : null}

      {hasAttachment && attachment ? (
        <div className="space-y-3">
          {attachment.url && isImageContentType(attachment.contentType) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={attachment.url}
              alt={attachment.fileName ?? t("attachmentTitle")}
              className="max-h-80 w-full rounded-lg border border-border object-contain bg-muted/30"
            />
          ) : (
            <div className="flex min-h-14 items-center gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
              <FileText className="size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">
                  {attachment.fileName ?? t("attachmentUntitled")}
                </p>
                <p className="text-caption text-muted-foreground">
                  {attachment.contentType ?? t("attachmentFile")}
                </p>
              </div>
            </div>
          )}
          {attachment.url ? (
            <a
              href={attachment.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-blue-700 hover:underline"
            >
              <ExternalLink className="size-4" aria-hidden />
              {t("openAttachment")}
            </a>
          ) : (
            <p className="text-sm text-amber-800" role="status">
              {t("errors.storageNotConfigured")}
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("attachmentEmpty")}</p>
      )}
    </section>
  );
}
