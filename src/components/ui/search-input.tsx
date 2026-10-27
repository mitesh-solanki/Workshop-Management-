"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchInputProps = Omit<
  React.ComponentProps<"input">,
  "type" | "value" | "defaultValue" | "onChange"
> & {
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
  className?: string;
};

/** Search field with clear button. */
function SearchInput({
  value,
  onValueChange,
  label,
  className,
  id,
  placeholder,
  ...props
}: SearchInputProps) {
  const t = useTranslations("common");
  const inputId = id ?? "search";

  return (
    <div className={cn("relative w-full", className)}>
      {label ? (
        <label htmlFor={inputId} className="sr-only">
          {label}
        </label>
      ) : null}
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
        aria-hidden
      />
      <Input
        {...props}
        id={inputId}
        type="text"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        value={value}
        placeholder={placeholder ?? t("search")}
        onChange={(event) => onValueChange(event.target.value)}
        className={cn(
          // Hide native clear (type=search / WebKit) — we use our own X.
          "h-11 min-h-11 rounded-lg border-slate-200 bg-card pl-9 text-sm [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden",
          value ? "pr-11" : "pr-3",
        )}
      />
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("clearSearch")}
          className="absolute top-1/2 right-1.5 -translate-y-1/2 text-slate-500"
          onClick={() => onValueChange("")}
        >
          <X className="size-4" aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}

export { SearchInput };
