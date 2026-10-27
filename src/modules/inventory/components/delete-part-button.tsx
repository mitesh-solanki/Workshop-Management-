"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { deletePartAction } from "@/app/actions/inventory";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

type Props = {
  partId: string;
  partName: string;
  /** When true, navigate to the list after a successful delete. */
  redirectToList?: boolean;
  size?: "icon" | "icon-sm" | "md";
  variant?: "outline" | "danger";
  showLabel?: boolean;
};

export function DeletePartButton({
  partId,
  partName,
  redirectToList = false,
  size = "icon-sm",
  variant = "outline",
  showLabel = false,
}: Props) {
  const t = useTranslations("inventory");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    startTransition(async () => {
      const result = await deletePartAction(partId);
      if (!result.ok) {
        toast.error(result.message ?? t("error"));
        return;
      }
      toast.success(result.message ?? t("deleted"));
      setOpen(false);
      if (redirectToList) {
        router.push("/inventory");
        router.refresh();
        return;
      }
      router.refresh();
    });
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (pending && !next) return;
        setOpen(next);
      }}
      title={t("deleteTitle")}
      description={t("deleteConfirm", { name: partName })}
      confirmLabel={t("delete")}
      variant="danger"
      loading={pending && open}
      onConfirm={onConfirm}
      trigger={
        <Button
          type="button"
          variant={variant}
          size={size}
          disabled={pending}
          className={
            variant === "outline"
              ? "text-danger hover:bg-danger/5 hover:text-danger"
              : undefined
          }
          aria-label={t("delete")}
        >
          <Trash2 className="size-4" aria-hidden />
          {showLabel ? t("delete") : null}
        </Button>
      }
    />
  );
}
