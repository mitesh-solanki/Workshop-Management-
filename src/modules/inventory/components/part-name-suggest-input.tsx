"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { filterCommonPartNames } from "@/modules/inventory/common-part-names";

type Props = {
  id: string;
  name?: string;
  value: string;
  onValueChange: (value: string) => void;
  required?: boolean;
  maxLength?: number;
  autoFocus?: boolean;
  className?: string;
};

export function PartNameSuggestInput({
  id,
  name = "name",
  value,
  onValueChange,
  required,
  maxLength = 200,
  autoFocus,
  className,
}: Props) {
  const t = useTranslations("inventory");
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const suggestions = filterCommonPartNames(value);
  const showList = open && suggestions.length > 0;

  useEffect(() => {
    if (!showList) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [showList]);

  function applySuggestion(suggestion: string) {
    onValueChange(suggestion);
    setOpen(false);
    setActiveIndex(-1);
  }

  return (
    <div ref={rootRef} className="relative">
      <Input
        id={id}
        name={name}
        required={required}
        maxLength={maxLength}
        autoFocus={autoFocus}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          showList && activeIndex >= 0
            ? `${listboxId}-option-${activeIndex}`
            : undefined
        }
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (!showList) return;

          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((index) =>
              index < suggestions.length - 1 ? index + 1 : 0,
            );
            return;
          }

          if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((index) =>
              index <= 0 ? suggestions.length - 1 : index - 1,
            );
            return;
          }

          if (event.key === "Enter" && activeIndex >= 0) {
            event.preventDefault();
            applySuggestion(suggestions[activeIndex]!);
            return;
          }

          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
            setActiveIndex(-1);
          }
        }}
        className={className}
      />

      {showList ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={t("nameSuggestionsLabel")}
          className="absolute inset-x-0 top-[calc(100%+0.25rem)] z-50 max-h-60 overflow-y-auto rounded-md border border-border bg-card py-1 shadow-lg"
        >
          {suggestions.map((suggestion, index) => {
            const active = index === activeIndex;
            return (
              <li
                key={suggestion}
                id={`${listboxId}-option-${index}`}
                role="option"
                aria-selected={active}
              >
                <button
                  type="button"
                  tabIndex={-1}
                  className={cn(
                    "flex min-h-11 w-full items-center px-3 text-left text-sm",
                    active ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    applySuggestion(suggestion);
                  }}
                >
                  {suggestion}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
