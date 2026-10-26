"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import {
  createDirectSaleModalAction,
  type InventoryActionState,
} from "@/app/actions/inventory";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import {
  DirectSaleForm,
  type DirectSaleCustomerOption,
  type DirectSalePartOption,
} from "@/modules/inventory/components/direct-sale-form";

const initial: InventoryActionState = { ok: false };

type Props = {
  parts: DirectSalePartOption[];
  customers: DirectSaleCustomerOption[];
  trigger?: React.ReactNode;
  size?: "sm" | "md";
};

export function CreateDirectSaleModal({
  parts,
  customers,
  trigger,
  size = "md",
}: Props) {
  const t = useTranslations("inventory");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    createDirectSaleModalAction,
    initial,
  );
  const handled = useRef<string | null>(null);
  const formId = "create-direct-sale-form";

  useEffect(() => {
    if (!state.message || state.message === handled.current) return;
    handled.current = state.message;

    if (state.ok && state.saleId) {
      toast.success(state.message);
      router.refresh();
      const id = window.setTimeout(() => setOpen(false), 0);
      return () => window.clearTimeout(id);
    }

    toast.error(state.message);
  }, [state, router]);

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
          <Button type="button" size={size}>
            <Plus className="size-4" aria-hidden />
            {t("newSale")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border px-5 py-4 text-left sm:px-6">
          <DialogTitle>{t("newSaleTitle")}</DialogTitle>
          <DialogDescription>{t("newSaleSubtitle")}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[min(75vh,36rem)] overflow-y-auto bg-background px-5 py-5 sm:px-6">
          <DirectSaleForm
            formId={formId}
            parts={parts}
            customers={customers}
            formAction={formAction}
            pending={pending}
            hideSubmit
          />
        </div>

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
            disabled={parts.length === 0}
          >
            {pending ? t("saving") : t("completeSale")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
