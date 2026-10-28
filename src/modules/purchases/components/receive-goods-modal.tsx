"use client";

import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PackageCheck } from "lucide-react";
import {
  receiveGoodsModalAction,
  type PurchasesActionState,
} from "@/app/actions/purchases";
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
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { QuantityStepper } from "@/modules/inventory/components/quantity-stepper";

const initial: PurchasesActionState = { ok: false };

export type ReceiveGoodsLine = {
  id: string;
  quantityOrdered: number;
  quantityReceived: number;
  part: { id: string; name: string; sku: string; unit: string };
};

type Props = {
  purchaseOrderId: string;
  poNumber: string;
  lines: ReceiveGoodsLine[];
  trigger?: React.ReactNode;
};

export function ReceiveGoodsModal({
  purchaseOrderId,
  poNumber,
  lines,
  trigger,
}: Props) {
  const t = useTranslations("purchaseOrders");
  const router = useRouter();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const boundReceive = useMemo(
    () => receiveGoodsModalAction.bind(null, purchaseOrderId),
    [purchaseOrderId],
  );
  const [state, formAction, pending] = useActionState(boundReceive, initial);
  const handled = useRef<string | null>(null);

  const receivable = lines.filter(
    (line) => line.quantityOrdered - line.quantityReceived > 0,
  );

  useEffect(() => {
    if (!state.message || state.message === handled.current) return;
    handled.current = state.message;

    if (state.ok) {
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
        if (next) {
          handled.current = null;
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" size="md" className="min-h-11 gap-1.5">
            <PackageCheck className="size-4" aria-hidden />
            {t("receiveGoods")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-5 py-4 text-left sm:px-6">
          <DialogTitle>{t("receiveTitle")}</DialogTitle>
          <DialogDescription>
            {poNumber} — {t("receiveSubtitle")}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="px-5 py-5 sm:px-6">
          <form
            id={formId}
            key={open ? "recv-open" : "recv-closed"}
            action={formAction}
            className="flex flex-col gap-4"
          >
            {receivable.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("nothingToReceive")}
              </p>
            ) : (
              <>
                <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5 text-sm text-blue-900">
                  {t("receivePartialTip")}
                </p>
                <ul className="space-y-3">
                  {receivable.map((line) => {
                    const remaining =
                      line.quantityOrdered - line.quantityReceived;
                    return (
                      <li
                        key={line.id}
                        className="space-y-3 overflow-hidden rounded-xl border border-border bg-card shadow-xs"
                      >
                        <input type="hidden" name="lineId" value={line.id} />
                        <div className="border-b border-border bg-muted/40 px-4 py-3">
                          <p className="font-semibold text-foreground">
                            {line.part.name}
                          </p>
                          <p className="text-caption text-muted-foreground">
                            {line.part.sku} ·{" "}
                            {t("alreadyReceived", {
                              received: line.quantityReceived,
                              ordered: line.quantityOrdered,
                              unit: line.part.unit,
                            })}
                          </p>
                        </div>
                        <div className="px-4 pb-4">
                          <QuantityStepper
                            id={`recv-qty-${line.id}`}
                            name="quantity"
                            label={t("receiveQuantity")}
                            defaultValue={remaining}
                            min={0}
                            hint={t("remaining", { count: remaining })}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

            <FormField id="modal-recv-notes" label={t("notes")}>
              <Textarea
                id="modal-recv-notes"
                name="notes"
                rows={2}
                placeholder={t("receiveNotesPlaceholder")}
                className="min-h-18 resize-y"
              />
            </FormField>
          </form>
        </DialogBody>
        <DialogFooter className="gap-2 border-t border-border bg-background px-5 py-4 sm:justify-end sm:px-6">
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
            disabled={receivable.length === 0}
          >
            {pending ? t("saving") : t("confirmReceive")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
