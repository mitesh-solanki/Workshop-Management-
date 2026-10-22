"use client";

import { useActionState, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  stockAdjustAction,
  stockInAction,
  stockOutAction,
  type InventoryActionState,
} from "@/app/actions/inventory";

const initial: InventoryActionState = { ok: false };

const inputClass =
  "min-h-12 w-full rounded-md border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring";

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
    <form action={formAction} className="flex flex-col gap-3 rounded-md border p-4">
      <h3 className="text-sm font-semibold">{t("stockIn")}</h3>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="stock-in-qty" className="text-sm font-medium">
          {t("quantity")}
        </label>
        <input
          id="stock-in-qty"
          name="quantity"
          type="number"
          inputMode="numeric"
          min={1}
          defaultValue={1}
          required
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="stock-in-note" className="text-sm font-medium">
          {t("note")}
        </label>
        <input id="stock-in-note" name="note" maxLength={500} className={inputClass} />
      </div>
      <StatusMessage state={state} okKey="stockInOk" />
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-md border px-4 text-base font-medium disabled:opacity-60"
      >
        {pending ? t("saving") : t("recordIn")}
      </button>
    </form>
  );
}

export function StockOutForm({ partId }: Props) {
  const t = useTranslations("inventory");
  const bound = useMemo(() => stockOutAction.bind(null, partId), [partId]);
  const [state, formAction, pending] = useActionState(bound, initial);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-md border p-4">
      <h3 className="text-sm font-semibold">{t("stockOut")}</h3>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="stock-out-qty" className="text-sm font-medium">
          {t("quantity")}
        </label>
        <input
          id="stock-out-qty"
          name="quantity"
          type="number"
          inputMode="numeric"
          min={1}
          defaultValue={1}
          required
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="stock-out-note" className="text-sm font-medium">
          {t("note")}
        </label>
        <input id="stock-out-note" name="note" maxLength={500} className={inputClass} />
      </div>
      <StatusMessage state={state} okKey="stockOutOk" />
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-md border px-4 text-base font-medium disabled:opacity-60"
      >
        {pending ? t("saving") : t("recordOut")}
      </button>
    </form>
  );
}

export function StockAdjustForm({ partId }: Props) {
  const t = useTranslations("inventory");
  const bound = useMemo(() => stockAdjustAction.bind(null, partId), [partId]);
  const [state, formAction, pending] = useActionState(bound, initial);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-md border p-4">
      <h3 className="text-sm font-semibold">{t("stockAdjust")}</h3>
      <p className="text-xs text-muted-foreground">{t("stockAdjustHint")}</p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="stock-adj-qty" className="text-sm font-medium">
          {t("quantityChange")}
        </label>
        <input
          id="stock-adj-qty"
          name="quantityChange"
          type="number"
          inputMode="numeric"
          required
          className={inputClass}
          placeholder="+5 or -2"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="stock-adj-note" className="text-sm font-medium">
          {t("note")}
        </label>
        <input id="stock-adj-note" name="note" maxLength={500} className={inputClass} />
      </div>
      <StatusMessage state={state} okKey="stockAdjustOk" />
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-md border px-4 text-base font-medium disabled:opacity-60"
      >
        {pending ? t("saving") : t("recordAdjust")}
      </button>
    </form>
  );
}
