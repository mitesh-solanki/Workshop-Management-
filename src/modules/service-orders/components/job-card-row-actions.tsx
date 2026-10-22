"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { deleteServiceOrderAction } from "@/app/actions/service-orders";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

type Props = {
  orderId: string;
  customerId: string;
  label: string;
  canWrite: boolean;
  /** On the job-card hub, only show delete (view/edit are redundant). */
  mode?: "row" | "delete-only";
  /** Where to go after a successful delete. Defaults to staying put + refresh. */
  redirectTo?: string;
};

export function JobCardRowActions({
  orderId,
  customerId,
  label,
  canWrite,
  mode = "row",
  redirectTo,
}: Props) {
  const t = useTranslations("orders");
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onConfirmDelete() {
    startTransition(async () => {
      const result = await deleteServiceOrderAction(orderId, customerId);
      if (!result.ok) {
        toast.error(result.message ?? t("errors.deleteFailed"));
        return;
      }
      toast.success(result.message ?? t("deleted"));
      setDeleteOpen(false);
      if (redirectTo) {
        router.push(redirectTo);
        return;
      }
      router.refresh();
    });
  }

  if (mode === "delete-only" && !canWrite) {
    return null;
  }

  return (
    <>
      <div
        className="flex items-center gap-1.5"
        data-row-stop
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        {mode === "row" ? (
          <>
            <Button asChild variant="outline" size="icon-sm">
              <Link href={`/orders/${orderId}`} aria-label={t("view")}>
                <Eye className="size-4" aria-hidden />
              </Link>
            </Button>
            {canWrite ? (
              <Button asChild variant="outline" size="icon-sm">
                <Link
                  href={`/orders/${orderId}?section=details`}
                  aria-label={t("edit")}
                >
                  <Pencil className="size-4" aria-hidden />
                </Link>
              </Button>
            ) : null}
          </>
        ) : null}
        {canWrite ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={pending}
              className="text-danger hover:bg-danger/5 hover:text-danger"
              aria-label={t("delete")}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </>
        ) : null}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open && !pending) setDeleteOpen(false);
        }}
        title={t("deleteTitle")}
        description={t("deleteConfirm", { label })}
        confirmLabel={t("delete")}
        variant="danger"
        loading={pending && deleteOpen}
        onConfirm={onConfirmDelete}
      />
    </>
  );
}
