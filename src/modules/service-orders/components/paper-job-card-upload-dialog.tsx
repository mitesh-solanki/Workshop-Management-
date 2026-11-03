"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ImageIcon, Upload } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { uploadPaperJobCardFiles } from "@/modules/service-orders/components/upload-paper-job-card";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceOrderId: string;
  customerId: string;
  vehicleId?: string;
  label: string;
};

const MAX_FILES = 5;

export function PaperJobCardUploadDialog({
  open,
  onOpenChange,
  serviceOrderId,
  customerId,
  vehicleId,
  label,
}: Props) {
  const t = useTranslations("orders");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const pickingFileRef = useRef(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) {
      pickingFileRef.current = false;
      return;
    }
    function onWindowFocus() {
      pickingFileRef.current = false;
    }
    window.addEventListener("focus", onWindowFocus);
    return () => window.removeEventListener("focus", onWindowFocus);
  }, [open]);

  function openFilePicker() {
    pickingFileRef.current = true;
    inputRef.current?.click();
  }

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    pickingFileRef.current = false;
    if (selected.length === 0) return;
    const files = selected.slice(0, MAX_FILES);
    startTransition(async () => {
      try {
        const result = await uploadPaperJobCardFiles({
          serviceOrderId,
          files,
          uploadFailedMessage: t("paperUploadFailed"),
          customerId,
          vehicleId,
          maxFiles: MAX_FILES,
        });
        toast.success(
          result.uploaded > 1
            ? t("paperUploadedMany", { count: result.uploaded })
            : (result.message ?? t("paperUploaded")),
        );
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : t("paperUploadFailed");
        toast.error(message);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && (pending || pickingFileRef.current)) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="gap-0 p-0 sm:max-w-md"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onFocusOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => {
          if (pickingFileRef.current || pending) {
            event.preventDefault();
          }
        }}
        onPointerDownOutside={(event) => {
          if (pickingFileRef.current || pending) {
            event.preventDefault();
          }
        }}
      >
        <DialogHeader className="border-b border-border px-5 py-4 pr-12 text-left">
          <DialogTitle>{t("paperUploadTitle")}</DialogTitle>
          <DialogDescription>
            {t("paperUploadDescription", { label })}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4 px-5 py-4">
          <p className="text-sm text-muted-foreground">{t("paperHint")}</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            multiple
            className="hidden"
            disabled={pending}
            onChange={onPick}
          />
          <button
            type="button"
            disabled={pending}
            onClick={openFilePicker}
            className={cn(
              "flex min-h-44 w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/70 px-5 py-8 text-center transition-colors",
              "hover:border-blue-400 hover:bg-blue-50/40",
              pending && "opacity-60",
            )}
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
              <ImageIcon className="size-7" aria-hidden />
            </span>
            <span className="space-y-1">
              <span className="block text-[15px] font-semibold text-slate-800">
                {pending ? t("paperUploading") : t("paperEmptyAction")}
              </span>
              <span className="block text-sm text-slate-500">
                {t("paperEmptyFormats")}
              </span>
            </span>
          </button>
        </DialogBody>

        <DialogFooter className="gap-2 border-t border-border bg-background px-5 py-4 sm:justify-end">
          <DialogClose asChild>
            <Button
              type="button"
              variant="secondary"
              size="md"
              disabled={pending}
            >
              {t("cancelEdit")}
            </Button>
          </DialogClose>
          <Button
            type="button"
            size="md"
            loading={pending}
            onClick={openFilePicker}
          >
            <Upload className="size-4" aria-hidden />
            {pending ? t("paperUploading") : t("paperUpload")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
