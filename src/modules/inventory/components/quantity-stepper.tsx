"use client";

import { useId, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

type Props = {
  id?: string;
  name: string;
  label: string;
  defaultValue?: number;
  min?: number;
  step?: number;
  /** Allow negative values (stock adjust). */
  allowNegative?: boolean;
  className?: string;
  hint?: string;
  /** Hide the visible label (still used for aria). */
  hideLabel?: boolean;
  /** Compact single border-box for table / tight rows. */
  compact?: boolean;
  /** Called whenever the quantity changes (stepper or typed). */
  onValueChange?: (value: number) => void;
};

/**
 * Quantity as one border box: − | value | +
 */
export function QuantityStepper({
  id: idProp,
  name,
  label,
  defaultValue = 1,
  min,
  step = 1,
  allowNegative = false,
  className,
  hint,
  hideLabel = false,
  compact = false,
  onValueChange,
}: Props) {
  const t = useTranslations("inventory");
  const autoId = useId();
  const id = idProp ?? autoId;
  const [value, setValue] = useState(defaultValue);

  const resolvedMin = min ?? (allowNegative ? undefined : 1);

  function clamp(n: number): number {
    if (resolvedMin !== undefined && n < resolvedMin) return resolvedMin;
    return n;
  }

  function commit(next: number) {
    setValue(next);
    if (Number.isFinite(next)) onValueChange?.(next);
  }

  function bump(delta: number) {
    setValue((prev) => {
      const next = clamp(prev + delta);
      if (Number.isFinite(next)) onValueChange?.(next);
      return next;
    });
  }

  function onInputChange(raw: string) {
    if (raw === "" || raw === "-") {
      setValue(Number.NaN);
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    commit(n);
  }

  function onBlur() {
    if (!Number.isFinite(value)) {
      commit(clamp(defaultValue));
      return;
    }
    commit(clamp(value));
  }

  const display = Number.isFinite(value) ? String(value) : "";
  const submitValue = Number.isFinite(value) ? value : defaultValue;

  const height = compact ? "h-9" : "h-11";
  const sideW = compact ? "w-8" : "w-10";
  const iconSize = compact ? "size-3.5" : "size-4";
  const sideBtnClass = cn(
    "inline-flex shrink-0 items-center justify-center bg-slate-100 text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700 active:bg-blue-100",
    sideW,
    height,
  );

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {hideLabel ? null : (
        <label htmlFor={id} className="text-[13px] font-semibold text-slate-700">
          {label}
        </label>
      )}
      <div
        className={cn(
          "inline-flex max-w-full items-stretch overflow-hidden rounded-lg border border-slate-300 bg-white shadow-xs",
          compact ? "w-[7.5rem]" : "w-[9.5rem]",
          height,
        )}
      >
        <button
          type="button"
          className={sideBtnClass}
          aria-label={t("decreaseQty")}
          onClick={() => bump(-step)}
        >
          <Minus className={iconSize} aria-hidden strokeWidth={2.5} />
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          value={display}
          min={resolvedMin}
          step={step}
          onChange={(e) => onInputChange(e.target.value)}
          onBlur={onBlur}
          className={cn(
            "min-w-0 flex-1 border-0 bg-white px-1 text-center text-[14px] font-semibold tabular-nums text-slate-800 outline-none focus-visible:bg-slate-50",
            "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
            height,
          )}
          aria-label={label}
        />
        <button
          type="button"
          className={sideBtnClass}
          aria-label={t("increaseQty")}
          onClick={() => bump(step)}
        >
          <Plus className={iconSize} aria-hidden strokeWidth={2.5} />
        </button>
      </div>
      <input type="hidden" name={name} value={submitValue} />
      {hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
