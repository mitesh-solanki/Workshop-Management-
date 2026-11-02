"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import {
  cancelPurchaseOrderAction,
  markPurchaseOrderOrderedAction,
} from "@/app/actions/purchases";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormSelect } from "@/components/ui/form-select";
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
import { FormField } from "@/components/ui/form-field";
import { toast } from "@/components/ui/toast";
import { ReceiveGoodsModal } from "@/modules/purchases/components/receive-goods-modal";
import {
  purchaseOrderCanReceive,
  purchaseOrderIsEditable,
} from "@/modules/purchases/po-status";
import type { PurchaseOrderStatus } from "@prisma/client";

type Line = {
  id: string;
  quantityOrdered: number;
  quantityReceived: number;
  part: { id: string; name: string; sku: string; unit: string };
};

type Props = {
  purchaseOrder: {
    id: string;
    number: string;
    status: PurchaseOrderStatus | string;
    vendorId: string | null;
    lines: Line[];
  };
  vendors: { id: string; name: string }[];
};

export function PurchaseOrderDetailActions({
  purchaseOrder: po,
  vendors,
}: Props) {
  const t = useTranslations("purchaseOrders");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [markOpen, setMarkOpen] = useState(false);
  const [vendorId, setVendorId] = useState(po.vendorId ?? "");
  const [cancelOpen, setCancelOpen] = useState(false);

  const status = po.status as PurchaseOrderStatus;
  const canEdit =
    purchaseOrderIsEditable(status) &&
    po.lines.every((line) => line.quantityReceived === 0);
  const canReceive = purchaseOrderCanReceive(status) && Boolean(po.vendorId);
  const canMarkOrdered = status === "OPEN";
  const canCancel =
    (status === "OPEN" || status === "PENDING") &&
    po.lines.every((line) => line.quantityReceived === 0);

  function handleMarkOrdered() {
    startTransition(async () => {
      const result = await markPurchaseOrderOrderedAction(
        po.id,
        vendorId || undefined,
      );
      if (result.ok) {
        toast.success(result.message ?? t("markedOrdered"));
        setMarkOpen(false);
        router.refresh();
        return;
      }
      toast.error(result.message ?? t("error"));
    });
  }

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelPurchaseOrderAction(po.id);
      if (result.ok) {
        toast.success(result.message ?? t("cancelled"));
        setCancelOpen(false);
        router.refresh();
        return;
      }
      toast.error(result.message ?? t("error"));
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canEdit ? (
        <Button asChild variant="outline" size="md">
          <Link href={`/purchase-orders/${po.id}/edit`}>
            <Pencil className="size-4" aria-hidden />
            {t("edit")}
          </Link>
        </Button>
      ) : null}

      {canMarkOrdered ? (
        <>
          <Button
            type="button"
            size="md"
            disabled={pending}
            onClick={() => {
              setVendorId(po.vendorId ?? "");
              setMarkOpen(true);
            }}
          >
            {t("markOrdered")}
          </Button>
          <Dialog open={markOpen} onOpenChange={setMarkOpen}>
            <DialogContent className="gap-0 p-0 sm:max-w-md">
              <DialogHeader className="border-b border-border px-5 py-4 text-left">
                <DialogTitle>{t("markOrderedTitle")}</DialogTitle>
                <DialogDescription>
                  {t("markOrderedSubtitle")}
                </DialogDescription>
              </DialogHeader>
              <DialogBody className="px-5 py-4">
                <FormField id="mark-ordered-vendor" label={t("vendor")}>
                  <FormSelect
                    id="mark-ordered-vendor"
                    value={vendorId}
                    onValueChange={setVendorId}
                    placeholder={t("vendorPlaceholder")}
                    triggerClassName="h-11 min-h-11"
                    options={vendors.map((vendor) => ({
                      value: vendor.id,
                      label: vendor.name,
                    }))}
                  />
                </FormField>
              </DialogBody>
              <DialogFooter className="gap-2 border-t border-border px-5 py-4 sm:justify-end">
                <DialogClose asChild>
                  <Button type="button" variant="secondary" size="md">
                    {t("cancel")}
                  </Button>
                </DialogClose>
                <Button
                  type="button"
                  size="md"
                  loading={pending}
                  disabled={!vendorId}
                  onClick={handleMarkOrdered}
                >
                  {t("markOrdered")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : null}

      {canReceive ? (
        <ReceiveGoodsModal
          purchaseOrderId={po.id}
          poNumber={po.number}
          lines={po.lines}
        />
      ) : null}

      {canCancel ? (
        <ConfirmDialog
          open={cancelOpen}
          onOpenChange={(next) => {
            if (pending && !next) return;
            setCancelOpen(next);
          }}
          title={t("cancelOrderTitle")}
          description={t("cancelOrderConfirm", { number: po.number })}
          confirmLabel={t("cancelOrder")}
          variant="danger"
          loading={pending && cancelOpen}
          onConfirm={handleCancel}
          trigger={
            <Button type="button" variant="outline" size="md" disabled={pending}>
              {t("cancelOrder")}
            </Button>
          }
        />
      ) : null}
    </div>
  );
}
