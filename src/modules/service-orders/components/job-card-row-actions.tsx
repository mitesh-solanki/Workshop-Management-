"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Eye, Trash2 } from "lucide-react";
import { deleteServiceOrderAction } from "@/app/actions/service-orders";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

type Props = {
  orderId: string;
  customerId: string;
  label: string;
  canWrite: boolean;
  /** Owner / manager only — technicians never see delete. */
  canDelete?: boolean;
  /** Completed cards are view-only (no edit). */
  status?: string;
  /** On the job-card hub, only show delete (view/edit are redundant). */
  mode?: "row" | "delete-only" | "view-delete";
  /** Where to go after a successful delete. Defaults to staying put + refresh. */
  redirectTo?: string;
};

export function JobCardRowActions({
  orderId,
  customerId,
  label,
  canWrite,
  canDelete = false,
  status,
  mode = "row",
  redirectTo,
}: Props) {
  const t = useTranslations("orders");
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const showView = mode === "row" || mode === "view-delete";
  const showDelete = canDelete;
  const isCompleted = status === "COMPLETED";
  /** One eye control: open details for work, or read-only when completed. */
  const viewHref =
    mode === "row" && canWrite && !isCompleted
      ? `/orders/${orderId}?section=details`
      : `/orders/${orderId}`;
  const viewLabel =
    mode === "row" && canWrite && !isCompleted ? t("edit") : t("view");

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

  if (mode === "delete-only" && !showDelete) {
    return null;
  }

  if (!showView && !showDelete) {
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
        {showView ? (
          <Button asChild variant="outline" size="icon-sm">
            <Link href={viewHref} aria-label={viewLabel}>
              <Eye className="size-4" aria-hidden />
            </Link>
          </Button>
        ) : null}
        {showDelete ? (
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
        ) : null}
      </div>

      {showDelete ? (
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
      ) : null}
    </>
  );
}
