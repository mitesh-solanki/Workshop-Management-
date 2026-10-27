"use client";

import type { ReactElement } from "react";
import { XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** Confirm button label. Defaults to common.confirm. */
  confirmLabel?: string;
  /** Cancel button label. Defaults to common.cancel. */
  cancelLabel?: string;
  /** Use danger styling for destructive actions. */
  variant?: "default" | "danger";
  loading?: boolean;
  onConfirm: () => void;
  /**
   * Optional trigger. Prefer this over a separate button that only sets
   * `open` — a plain outside click races with Radix and can close instantly.
   */
  trigger?: ReactElement;
};

/**
 * Shared confirm modal built on shadcn Alert Dialog.
 * Use instead of window.confirm for destructive or irreversible actions.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = "default",
  loading = false,
  onConfirm,
  trigger,
}: ConfirmDialogProps) {
  const t = useTranslations("common");

  function close() {
    if (loading) return;
    onOpenChange(false);
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (loading && !next) return;
        onOpenChange(next);
      }}
    >
      {trigger ? (
        <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      ) : null}
      <AlertDialogContent className="z-10050 gap-5 sm:max-w-md">
        <button
          type="button"
          onClick={close}
          disabled={loading}
          className="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
          aria-label={t("close")}
        >
          <XIcon className="size-4" aria-hidden />
        </button>

        <AlertDialogHeader className="pr-8 text-left">
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="!flex-row !flex-nowrap justify-end gap-2">
          <AlertDialogCancel
            className="m-0 min-w-24 flex-1 sm:flex-none"
            disabled={loading}
          >
            {cancelLabel ?? t("cancel")}
          </AlertDialogCancel>
          <Button
            type="button"
            variant={variant === "danger" ? "danger" : "primary"}
            size="md"
            className="min-w-24 flex-1 sm:flex-none"
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel ?? t("confirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
