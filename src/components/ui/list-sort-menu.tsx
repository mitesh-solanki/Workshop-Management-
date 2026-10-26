"use client";

import { ArrowUpDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ListSortOption<T extends string> = {
  value: T;
  label: string;
};

type ListSortMenuProps<T extends string> = {
  value: T;
  options: readonly ListSortOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  disabled?: boolean;
};

export function ListSortMenu<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  disabled = false,
}: ListSortMenuProps<T>) {
  const selectedLabel =
    options.find((option) => option.value === value)?.label ?? ariaLabel;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          disabled={disabled}
          aria-label={ariaLabel}
          title={selectedLabel}
          className="min-h-11 min-w-11 shrink-0"
        >
          <ArrowUpDown className="size-4 shrink-0" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[12rem]">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <DropdownMenuItem
              key={option.value}
              disabled={disabled || selected}
              className="min-h-10 justify-between"
              onSelect={() => {
                onChange(option.value);
              }}
            >
              <span>{option.label}</span>
              {selected ? (
                <Check className="size-4 shrink-0" aria-hidden />
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
