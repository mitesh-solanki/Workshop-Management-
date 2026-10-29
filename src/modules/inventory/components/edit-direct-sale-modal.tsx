"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import {
  updateDirectSaleModalAction,
  type InventoryActionState,
} from "@/app/actions/inventory";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { toastStockError } from "@/components/ui/toast-stock-error";
import {
  DirectSaleForm,
  type DirectSaleCustomerOption,
  type DirectSalePartOption,
} from "@/modules/inventory/components/direct-sale-form";
import type { DirectSaleTableRow } from "@/modules/inventory/components/direct-sales-table";

const initial: InventoryActionState = { ok: false };

type Props = {
  sale: DirectSaleTableRow;
  parts: DirectSalePartOption[];
  customers: DirectSaleCustomerOption[];
  trigger?: React.ReactNode;
};

export function EditDirectSaleModal({
  sale,
  parts,
  customers,
  trigger,
}: Props) {
  const t = useTranslations("inventory");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    updateDirectSaleModalAction,
    initial,
  );
  const handled = useRef<string | null>(null);
  const formId = `edit-direct-sale-${sale.id}`;

  const partsForEdit = useMemo(() => {
    const soldByPart = new Map<string, number>();
    for (const line of sale.lines) {
      soldByPart.set(
        line.part.id,
        (soldByPart.get(line.part.id) ?? 0) + line.quantity,
      );
    }
    return parts.map((part) => ({
      ...part,
      quantityOnHand: part.quantityOnHand + (soldByPart.get(part.id) ?? 0),
    }));
  }, [parts, sale.lines]);

  useEffect(() => {
    if (!state.message || state.message === handled.current) return;
    handled.current = state.message;

    if (state.ok && state.saleId) {
      toast.success(state.message);
      router.refresh();
      const id = window.setTimeout(() => setOpen(false), 0);
      return () => window.clearTimeout(id);
    }

    toastStockError(state.message, {
      stockPartId: state.stockPartId,
      viewStockLabel: t("errors.viewStock"),
    });
  }, [state, router, t]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) handled.current = null;
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={t("editSale")}
          >
            <Pencil className="size-4" aria-hidden />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border px-5 py-4 text-left sm:px-6">
          <DialogTitle>{t("editSaleTitle")}</DialogTitle>
          <DialogDescription>{t("editSaleSubtitle")}</DialogDescription>
        </DialogHeader>

        <DialogBody className="bg-background px-5 py-5 sm:px-6">
          <DirectSaleForm
            key={`${sale.id}-${open ? "open" : "closed"}`}
            formId={formId}
            parts={partsForEdit}
            customers={customers}
            formAction={formAction}
            pending={pending}
            hideSubmit
            submitLabel={t("saveSale")}
            defaultValues={{
              customerId: sale.customer?.id ?? "",
              walkInName: sale.walkInName ?? "",
              notes: sale.notes ?? "",
              lines: sale.lines.map((line) => ({
                partId: line.part.id,
                quantity: line.quantity,
                unitPricePaise: line.unitPricePaise,
              })),
            }}
          />
          <input type="hidden" form={formId} name="saleId" value={sale.id} />
        </DialogBody>

        <DialogFooter className="gap-2 border-t border-border bg-muted/30 px-5 py-4 sm:justify-end sm:px-6">
          <DialogClose asChild>
            <Button type="button" variant="secondary" size="md">
              {t("cancel")}
            </Button>
          </DialogClose>
          <Button
            type="submit"
            form={formId}
            size="md"
            loading={pending}
            disabled={partsForEdit.length === 0}
          >
            {pending ? t("saving") : t("saveSale")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
