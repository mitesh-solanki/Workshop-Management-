"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ShoppingCart, Trash2 } from "lucide-react";
import { cancelPartsRequestAction } from "@/app/actions/purchases";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/components/ui/toast";
import {
  CreatePurchaseOrderModal,
  type OpenPartsRequestOption,
} from "@/modules/purchases/components/create-purchase-order-modal";

type Props = {
  request: {
    id: string;
    status: string;
    quantity: number;
    part: { id: string; name: string; sku: string; unit: string };
    purchaseOrder: { id: string; number: string } | null;
  };
  vendors: { id: string; name: string }[];
  openRequests: OpenPartsRequestOption[];
};

export function PartsRequestRowActions({
  request,
  vendors,
  openRequests,
}: Props) {
  const t = useTranslations("partsRequests");
  const router = useRouter();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const isOpen = request.status === "OPEN";
  const createOrderDisabledReason =
    request.status === "CANCELLED"
      ? t("createOrderDisabledCancelled")
      : t("createOrderDisabledOrdered");
  const blockedReason =
    request.status === "CANCELLED"
      ? t("deleteDisabledCancelled")
      : t("deleteDisabledOrdered");

  function openCancelOrBlocked(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (isOpen) {
      setCancelOpen(true);
      return;
    }
    setBlockedOpen(true);
  }

  function onConfirmCancel() {
    startTransition(async () => {
      const result = await cancelPartsRequestAction(request.id);
      if (!result.ok) {
        toast.error(result.message ?? t("error"));
        return;
      }
      toast.success(result.message ?? t("cancelled"));
      setCancelOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div
        className="inline-flex items-center justify-end gap-1.5"
        data-row-stop
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        {isOpen ? (
          <CreatePurchaseOrderModal
            vendors={vendors}
            openRequests={openRequests}
            preselectedRequestIds={[request.id]}
            stayAndRefresh
            size="md"
            trigger={
              <Button
                type="button"
                variant="outline"
                size="md"
                className="min-h-11 gap-1.5"
                aria-label={t("createOrder")}
              >
                <ShoppingCart className="size-4" aria-hidden />
                <span className="hidden sm:inline">{t("createOrder")}</span>
              </Button>
            }
          />
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  disabled
                  className="min-h-11 gap-1.5"
                  aria-label={t("createOrder")}
                >
                  <ShoppingCart className="size-4" aria-hidden />
                  <span className="hidden sm:inline">{t("createOrder")}</span>
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-pretty">
              {createOrderDisabledReason}
            </TooltipContent>
          </Tooltip>
        )}

        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={pending}
          className={
            isOpen
              ? "text-danger hover:bg-danger/5 hover:text-danger"
              : "text-danger opacity-60"
          }
          aria-label={isOpen ? t("cancelRequest") : blockedReason}
          onClick={openCancelOrBlocked}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>

      <Dialog
        open={cancelOpen}
        onOpenChange={(next) => {
          if (pending) return;
          setCancelOpen(next);
        }}
      >
        <DialogContent className="gap-0 p-0 sm:max-w-md">
          <DialogHeader className="border-b border-border px-5 py-4 text-left">
            <DialogTitle>{t("cancelTitle")}</DialogTitle>
            <DialogDescription>
              {t("cancelConfirm", { name: request.part.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 px-5 py-4 sm:justify-end">
            <DialogClose asChild>
              <Button type="button" variant="secondary" size="md" disabled={pending}>
                {t("cancel")}
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="danger"
              size="md"
              loading={pending}
              onClick={onConfirmCancel}
            >
              {pending ? t("saving") : t("cancelRequest")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={blockedOpen}
        onOpenChange={setBlockedOpen}
      >
        <DialogContent className="gap-0 p-0 sm:max-w-md">
          <DialogHeader className="border-b border-border px-5 py-4 text-left">
            <DialogTitle>{t("cannotCancelTitle")}</DialogTitle>
            <DialogDescription>{blockedReason}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 px-5 py-4 sm:justify-end">
            {request.status === "ORDERED" ? (
              <Button asChild variant="outline" size="md">
                <Link href="/purchase-returns">{t("goToReturns")}</Link>
              </Button>
            ) : null}
            <DialogClose asChild>
              <Button type="button" variant="secondary" size="md">
                {t("cancel")}
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
