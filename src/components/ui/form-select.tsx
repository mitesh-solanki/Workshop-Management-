"use client";

import { useId, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Radix Select disallows empty string values; map "" through this sentinel. */
const EMPTY_VALUE = "__form_select_empty__";

export type FormSelectOption = {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
};

type FormSelectProps = {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  triggerClassName?: string;
  options: readonly FormSelectOption[];
};

function toInternal(value: string) {
  return value === "" ? EMPTY_VALUE : value;
}

function fromInternal(value: string) {
  return value === EMPTY_VALUE ? "" : value;
}

/**
 * App select built on shadcn Select. Supports form `name` via a hidden input
 * and empty-string options when they are real choices (e.g. Walk-in, Unmapped).
 * Use `placeholder` for “nothing chosen yet” — do not add a disabled empty option.
 */
export function FormSelect({
  id,
  name,
  value,
  defaultValue,
  onValueChange,
  placeholder,
  disabled,
  required,
  className,
  triggerClassName,
  options,
}: FormSelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const isControlled = value !== undefined;
  const [uncontrolled, setUncontrolled] = useState(
    () => defaultValue ?? "",
  );
  const current = (isControlled ? value : uncontrolled) ?? "";

  const listOptions = options.filter(
    (option) => !(option.value === "" && option.disabled),
  );
  const hasEmptyChoice = listOptions.some((option) => option.value === "");
  const placeholderEmpty = current === "" && !hasEmptyChoice;
  const radixValue = toInternal(current);
  const selectedLabel = listOptions.find(
    (option) => option.value === current,
  )?.label;

  function handleChange(next: string) {
    const external = fromInternal(next);
    if (!isControlled) {
      setUncontrolled(external);
    }
    onValueChange?.(external);
  }

  return (
    <div className={cn("w-full min-w-0", className)}>
      {name ? (
        <input type="hidden" name={name} value={current} disabled={disabled} />
      ) : null}
      <Select
        value={radixValue}
        onValueChange={handleChange}
        disabled={disabled}
        required={required}
      >
        <SelectTrigger
          id={selectId}
          className={cn(
            "h-11 min-h-11 w-full min-w-0 bg-card shadow-none",
            triggerClassName,
          )}
        >
          {placeholderEmpty && placeholder ? (
            <SelectValue placeholder={placeholder}>
              <span className="text-muted-foreground">{placeholder}</span>
            </SelectValue>
          ) : (
            <SelectValue placeholder={placeholder}>
              {selectedLabel}
            </SelectValue>
          )}
        </SelectTrigger>
        <SelectContent
          position="popper"
          className="max-h-72 min-w-[var(--radix-select-trigger-width)]"
        >
          {placeholderEmpty ? (
            <SelectItem
              value={EMPTY_VALUE}
              disabled
              className="pointer-events-none hidden"
              aria-hidden
            >
              {placeholder ?? "\u00A0"}
            </SelectItem>
          ) : null}
          {listOptions.map((option) => (
            <SelectItem
              key={option.value === "" ? EMPTY_VALUE : option.value}
              value={toInternal(option.value)}
              disabled={option.disabled}
              className="min-h-10"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
