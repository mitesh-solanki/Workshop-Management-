"use client";

import { useTranslations } from "next-intl";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import {
  isZeroRupeesInput,
  paiseToRupeesInput,
  sanitizeRupeesTyping,
  toPaise,
  type Paise,
} from "@/lib/money";
import { cn } from "@/lib/utils";

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

function safeDefaultPaise(value: unknown): Paise {
  try {
    return toPaise(value ?? 0, "defaultPaise");
  } catch {
    return 0;
  }
}

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
  const initialPaise = safeDefaultPaise(defaultPaise);

  return (
    <FormField
      id={id}
      label={resolvedLabel}
      hint={resolvedHint}
      className={className}
    >
      <Input
        id={id}
        name={name}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        pattern="^\d+(\.\d{1,2})?$"
        title={resolvedHint}
        defaultValue={paiseToRupeesInput(initialPaise)}
        required={required}
        disabled={disabled}
        className={cn("h-11 min-h-11", inputClassName)}
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
    </FormField>
  );
}
