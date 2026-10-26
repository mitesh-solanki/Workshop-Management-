"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, PackageMinus, PackagePlus, Plus, Scale } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  stockAdjustAction,
  stockInAction,
  stockOutAction,
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
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { QuantityStepper } from "@/modules/inventory/components/quantity-stepper";

const initial: InventoryActionState = { ok: false };

type StockDialogProps = {
  partId: string;
  unitLabel: string;
  onHand: number;
};

export function AddStockDialog({ partId, unitLabel }: StockDialogProps) {
  const t = useTranslations("inventory");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const bound = useMemo(() => stockInAction.bind(null, partId), [partId]);
  const [state, formAction, pending] = useActionState(bound, initial);
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!state.message || state.message === handled.current) return;
    handled.current = state.message;
    if (state.ok) {
      toast.success(t("stockInOk"));
      router.refresh();
      const id = window.setTimeout(() => setOpen(false), 0);
      return () => window.clearTimeout(id);
    }
    toast.error(state.message);
  }, [state, t, router]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) handled.current = null;
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="md" className="min-h-11">
          <PackagePlus className="size-4" aria-hidden />
          {t("addStock")}
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle>{t("addStockTitle")}</DialogTitle>
          <DialogDescription>{t("addStockHint")}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4 px-5 py-4">
          <QuantityStepper
            id="stock-in-qty"
            name="quantity"
            label={`${t("quantity")} (${unitLabel})`}
            defaultValue={1}
            min={1}
          />
          <FormField id="stock-in-note" label={t("note")}>
            <Textarea
              id="stock-in-note"
              name="note"
              rows={3}
              maxLength={500}
              placeholder={t("stockNotePlaceholder")}
            />
          </FormField>
          <DialogFooter className="gap-2 border-t border-border px-0 pt-4 sm:justify-end">
            <DialogClose asChild>
              <Button type="button" variant="secondary" size="md">
                {t("cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" size="md" loading={pending}>
              {pending ? t("saving") : t("recordIn")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RemoveStockDialog({
  partId,
  unitLabel,
  onHand,
}: StockDialogProps) {
  const t = useTranslations("inventory");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const bound = useMemo(() => stockOutAction.bind(null, partId), [partId]);
  const [state, formAction, pending] = useActionState(bound, initial);
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!state.message || state.message === handled.current) return;
    handled.current = state.message;
    if (state.ok) {
      toast.success(t("stockOutOk"));
      router.refresh();
      const id = window.setTimeout(() => setOpen(false), 0);
      return () => window.clearTimeout(id);
    }
    toast.error(state.message);
  }, [state, t, router]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) handled.current = null;
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="md"
          className="min-h-11"
          disabled={onHand <= 0}
        >
          <PackageMinus className="size-4" aria-hidden />
          {t("removeStock")}
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle>{t("removeStockTitle")}</DialogTitle>
          <DialogDescription>
            {t("removeStockHint", {
              count: onHand,
              unit: unitLabel,
            })}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4 px-5 py-4">
          <QuantityStepper
            id="stock-out-qty"
            name="quantity"
            label={`${t("quantity")} (${unitLabel})`}
            defaultValue={1}
            min={1}
          />
          <FormField id="stock-out-note" label={t("note")}>
            <Textarea
              id="stock-out-note"
              name="note"
              rows={3}
              maxLength={500}
              placeholder={t("stockNotePlaceholder")}
            />
          </FormField>
          <DialogFooter className="gap-2 border-t border-border px-0 pt-4 sm:justify-end">
            <DialogClose asChild>
              <Button type="button" variant="secondary" size="md">
                {t("cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" size="md" loading={pending}>
              {pending ? t("saving") : t("recordOut")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CorrectStockDialog({
  partId,
  unitLabel,
  onHand,
}: StockDialogProps) {
  const t = useTranslations("inventory");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [counted, setCounted] = useState(onHand);
  const bound = useMemo(() => stockAdjustAction.bind(null, partId), [partId]);
  const [state, formAction, pending] = useActionState(bound, initial);
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!state.message || state.message === handled.current) return;
    handled.current = state.message;
    if (state.ok) {
      toast.success(t("stockAdjustOk"));
      router.refresh();
      const id = window.setTimeout(() => setOpen(false), 0);
      return () => window.clearTimeout(id);
    }
    toast.error(state.message);
  }, [state, t, router]);

  const quantityChange = counted - onHand;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          handled.current = null;
          setCounted(onHand);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="md" className="min-h-11">
          <Scale className="size-4" aria-hidden />
          {t("correctStock")}
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle>{t("correctStockTitle")}</DialogTitle>
          <DialogDescription>
            {t("correctStockHint", {
              count: onHand,
              unit: unitLabel,
            })}
          </DialogDescription>
        </DialogHeader>
        <form
          action={(formData) => {
            if (quantityChange === 0) {
              toast.error(t("stockCorrectUnchanged"));
              return;
            }
            formAction(formData);
          }}
          className="flex flex-col gap-4 px-5 py-4"
        >
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="stock-correct-qty"
              className="text-sm font-medium text-foreground"
            >
              {t("countedQuantity")} ({unitLabel})
            </label>
            <div className="flex items-stretch gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 shrink-0"
                aria-label={t("decreaseQty")}
                disabled={counted <= 0}
                onClick={() => setCounted((n) => Math.max(0, n - 1))}
              >
                <Minus className="size-4" aria-hidden />
              </Button>
              <input
                id="stock-correct-qty"
                type="number"
                inputMode="numeric"
                min={0}
                value={counted}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n)) return;
                  setCounted(Math.max(0, Math.trunc(n)));
                }}
                className="h-11 min-h-11 w-full rounded-md border border-input bg-background px-3 text-center text-lg font-semibold tabular-nums outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 shrink-0"
                aria-label={t("increaseQty")}
                onClick={() => setCounted((n) => n + 1)}
              >
                <Plus className="size-4" aria-hidden />
              </Button>
            </div>
            {quantityChange !== 0 ? (
              <p className="text-caption text-slate-600">
                {quantityChange > 0
                  ? t("correctDeltaUp", {
                      count: quantityChange,
                      unit: unitLabel,
                    })
                  : t("correctDeltaDown", {
                      count: Math.abs(quantityChange),
                      unit: unitLabel,
                    })}
              </p>
            ) : (
              <p className="text-caption text-slate-500">{t("correctDeltaSame")}</p>
            )}
          </div>
          <input type="hidden" name="quantityChange" value={quantityChange} />
          <FormField id="stock-correct-note" label={t("note")}>
            <Textarea
              id="stock-correct-note"
              name="note"
              rows={3}
              maxLength={500}
              placeholder={t("correctStockNotePlaceholder")}
            />
          </FormField>
          <DialogFooter className="gap-2 border-t border-border px-0 pt-4 sm:justify-end">
            <DialogClose asChild>
              <Button type="button" variant="secondary" size="md">
                {t("cancel")}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              size="md"
              loading={pending}
              disabled={quantityChange === 0}
            >
              {pending ? t("saving") : t("recordAdjust")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
