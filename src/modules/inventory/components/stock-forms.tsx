"use client";

import { useActionState, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  stockAdjustAction,
  stockInAction,
  stockOutAction,
  type InventoryActionState,
} from "@/app/actions/inventory";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { QuantityStepper } from "@/modules/inventory/components/quantity-stepper";

const initial: InventoryActionState = { ok: false };

type Props = { partId: string };

function StatusMessage({
  state,
  okKey,
}: {
  state: InventoryActionState;
  okKey: "stockInOk" | "stockOutOk" | "stockAdjustOk";
}) {
  const t = useTranslations("inventory");
  if (!state.message) {
    return null;
  }
  return (
    <p
      className={
        state.ok ? "text-sm text-foreground" : "text-sm text-destructive"
      }
      role="status"
    >
      {state.ok ? t(okKey) : state.message}
    </p>
  );
}

export function StockInForm({ partId }: Props) {
  const t = useTranslations("inventory");
  const bound = useMemo(() => stockInAction.bind(null, partId), [partId]);
  const [state, formAction, pending] = useActionState(bound, initial);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-xs"
    >
      <h3 className="text-sm font-semibold text-foreground">{t("stockIn")}</h3>
      <QuantityStepper
        id="stock-in-qty"
        name="quantity"
        label={t("quantity")}
        defaultValue={1}
        min={1}
      />
      <FormField id="stock-in-note" label={t("note")}>
        <Input
          id="stock-in-note"
          name="note"
          maxLength={500}
          className="h-11 min-h-11"
        />
      </FormField>
      <StatusMessage state={state} okKey="stockInOk" />
      <Button type="submit" size="md" loading={pending} className="w-full">
        {pending ? t("saving") : t("recordIn")}
      </Button>
    </form>
  );
}

export function StockOutForm({ partId }: Props) {
  const t = useTranslations("inventory");
  const bound = useMemo(() => stockOutAction.bind(null, partId), [partId]);
  const [state, formAction, pending] = useActionState(bound, initial);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-xs"
    >
      <h3 className="text-sm font-semibold text-foreground">{t("stockOut")}</h3>
      <QuantityStepper
        id="stock-out-qty"
        name="quantity"
        label={t("quantity")}
        defaultValue={1}
        min={1}
      />
      <FormField id="stock-out-note" label={t("note")}>
        <Input
          id="stock-out-note"
          name="note"
          maxLength={500}
          className="h-11 min-h-11"
        />
      </FormField>
      <StatusMessage state={state} okKey="stockOutOk" />
      <Button type="submit" size="md" loading={pending} className="w-full">
        {pending ? t("saving") : t("recordOut")}
      </Button>
    </form>
  );
}

export function StockAdjustForm({ partId }: Props) {
  const t = useTranslations("inventory");
  const bound = useMemo(() => stockAdjustAction.bind(null, partId), [partId]);
  const [state, formAction, pending] = useActionState(bound, initial);
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [amount, setAmount] = useState(1);

  const quantityChange = direction === "in" ? amount : -amount;

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-xs"
    >
      <h3 className="text-sm font-semibold text-foreground">
        {t("stockAdjust")}
      </h3>
      <p className="text-xs text-muted-foreground">{t("stockAdjustHint")}</p>

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={direction === "in" ? "default" : "outline"}
          size="md"
          className="min-h-11"
          onClick={() => setDirection("in")}
        >
          {t("adjustIncrease")}
        </Button>
        <Button
          type="button"
          variant={direction === "out" ? "default" : "outline"}
          size="md"
          className="min-h-11"
          onClick={() => setDirection("out")}
        >
          {t("adjustDecrease")}
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="stock-adj-qty"
          className="text-sm font-medium text-foreground"
        >
          {t("quantity")}
        </label>
        <div className="flex items-stretch gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 shrink-0"
            aria-label={t("decreaseQty")}
            disabled={amount <= 1}
            onClick={() => setAmount((n) => Math.max(1, n - 1))}
          >
            <Minus className="size-4" aria-hidden />
          </Button>
          <input
            id="stock-adj-qty"
            type="number"
            inputMode="numeric"
            min={1}
            value={amount}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isFinite(n)) return;
              setAmount(Math.max(1, Math.trunc(n)));
            }}
            className="h-11 min-h-11 w-full rounded-md border border-input bg-background px-3 text-center text-lg font-semibold tabular-nums outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 shrink-0"
            aria-label={t("increaseQty")}
            onClick={() => setAmount((n) => n + 1)}
          >
            <Plus className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
      <input type="hidden" name="quantityChange" value={quantityChange} />

      <FormField id="stock-adj-note" label={t("note")}>
        <Input
          id="stock-adj-note"
          name="note"
          maxLength={500}
          className="h-11 min-h-11"
        />
      </FormField>
      <StatusMessage state={state} okKey="stockAdjustOk" />
      <Button type="submit" size="md" loading={pending} className="w-full">
        {pending ? t("saving") : t("recordAdjust")}
      </Button>
    </form>
  );
}
