"use client";

import { useTranslations } from "next-intl";
import {
  isZeroRupeesInput,
  paiseToRupeesInput,
  sanitizeRupeesTyping,
  type Paise,
} from "@/lib/money";
import { cn } from "@/lib/utils";

const inputClass =
  "min-h-12 w-full rounded-md border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Props = {
  id?: string;
  name?: string;
  /** Existing amount in paise; 0 / omitted → empty field (no sticky leading zero). */
  defaultPaise?: Paise;
  label?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
};

/**
 * Shared rupee price field for labour/parts forms.
 * Starts empty (placeholder 0). Focus selects a lone zero so typing replaces it.
 */
export function RupeePriceInput({
  id = "unitPriceRupees",
  name = "unitPriceRupees",
  defaultPaise = 0,
  label,
  hint,
  required = true,
  disabled,
  className,
  inputClassName,
}: Props) {
  const t = useTranslations("common");
  const resolvedLabel = label ?? t("unitPrice");
  const resolvedHint = hint ?? t("unitPriceHint");

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {resolvedLabel}
      </label>
      <input
        id={id}
        name={name}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        pattern="^\d+(\.\d{1,2})?$"
        title={resolvedHint}
        defaultValue={paiseToRupeesInput(defaultPaise)}
        required={required}
        disabled={disabled}
        className={cn(inputClass, inputClassName)}
        onFocus={(event) => {
          if (isZeroRupeesInput(event.currentTarget.value)) {
            event.currentTarget.select();
          }
        }}
        onBeforeInput={(event) => {
          const native = event.nativeEvent as InputEvent;
          const data = native.data;
          if (data == null || data === "") {
            return;
          }
          if (!/^[\d.]+$/.test(data)) {
            event.preventDefault();
          }
        }}
        onInput={(event) => {
          const el = event.currentTarget;
          const next = sanitizeRupeesTyping(el.value);
          if (el.value !== next) {
            el.value = next;
          }
        }}
        onBlur={(event) => {
          const value = event.currentTarget.value.trim();
          if (isZeroRupeesInput(value)) {
            event.currentTarget.value = "";
            return;
          }
          // Drop a leading zero before digits (e.g. 0260 → 260) while keeping 0.50
          if (/^0\d/.test(value)) {
            event.currentTarget.value = value.replace(/^0+(?=\d)/, "");
          }
        }}
      />
      <p className="text-xs text-muted-foreground">{resolvedHint}</p>
    </div>
  );
}
