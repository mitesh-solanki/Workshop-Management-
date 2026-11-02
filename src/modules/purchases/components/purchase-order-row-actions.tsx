"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { cancelPurchaseOrderAction } from "@/app/actions/purchases";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  purchaseOrderIsEditable,
} from "@/modules/purchases/po-status";
import type { PurchaseOrderStatus } from "@prisma/client";

type Props = {
  order: {
    id: string;
    number: string;
    status: string;
    lines: { quantityReceived: number }[];
  };
};

export function PurchaseOrderRowActions({ order }: Props) {
  const t = useTranslations("purchaseOrders");
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const status = order.status as PurchaseOrderStatus;
  const noReceipts = order.lines.every((line) => line.quantityReceived === 0);
  const canEdit = purchaseOrderIsEditable(status) && noReceipts;
  const canDelete =
    (status === "OPEN" || status === "PENDING") && noReceipts;

  function onConfirmDelete() {
    startTransition(async () => {
      const result = await cancelPurchaseOrderAction(order.id);
      if (!result.ok) {
        toast.error(result.message ?? t("error"));
        return;
      }
      toast.success(result.message ?? t("cancelled"));
      setDeleteOpen(false);
      router.refresh();
    });
  }

  return (
    <div
      className="flex items-center gap-1.5"
      data-row-stop
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <Button asChild variant="outline" size="icon">
        <Link
          href={`/purchase-orders/${order.id}`}
          aria-label={t("view")}
        >
          <Eye className="size-4" aria-hidden />
        </Link>
      </Button>
      {canEdit ? (
        <Button asChild variant="outline" size="icon">
          <Link
            href={`/purchase-orders/${order.id}/edit`}
            aria-label={t("edit")}
          >
            <Pencil className="size-4" aria-hidden />
          </Link>
        </Button>
      ) : null}
      {canDelete ? (
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={(next) => {
            if (pending && !next) return;
            setDeleteOpen(next);
          }}
          title={t("cancelOrderTitle")}
          description={t("cancelOrderConfirm", { number: order.number })}
          confirmLabel={t("delete")}
          variant="danger"
          loading={pending && deleteOpen}
          onConfirm={onConfirmDelete}
          trigger={
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={pending}
              className="text-danger hover:bg-danger/5 hover:text-danger"
              aria-label={t("delete")}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          }
        />
      ) : null}
    </div>
  );
}
