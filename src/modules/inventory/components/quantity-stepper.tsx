"use client";

import { useId, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
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
};

/**
 * Quantity field with − / + steppers and a large typed input (phone-friendly).
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

  function bump(delta: number) {
    setValue((prev) => clamp(prev + delta));
  }

  function onInputChange(raw: string) {
    if (raw === "" || raw === "-") {
      // Keep empty while typing; form still needs a value on submit via hidden.
      setValue(Number.NaN);
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    setValue(n);
  }

  function onBlur() {
    if (!Number.isFinite(value)) {
      setValue(clamp(defaultValue));
      return;
    }
    setValue(clamp(value));
  }

  const display = Number.isFinite(value) ? String(value) : "";
  const submitValue = Number.isFinite(value) ? value : defaultValue;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="flex items-stretch gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 shrink-0"
          aria-label={t("decreaseQty")}
          onClick={() => bump(-step)}
          disabled={
            resolvedMin !== undefined &&
            Number.isFinite(value) &&
            value <= resolvedMin
          }
        >
          <Minus className="size-4" aria-hidden />
        </Button>
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
            "h-11 min-h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-center text-lg font-semibold tabular-nums outline-none",
            "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30",
          )}
          aria-label={label}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 shrink-0"
          aria-label={t("increaseQty")}
          onClick={() => bump(step)}
        >
          <Plus className="size-4" aria-hidden />
        </Button>
      </div>
      {/* Controlled input is not named — submit via hidden so FormData is correct. */}
      <input type="hidden" name={name} value={submitValue} />
      {hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
