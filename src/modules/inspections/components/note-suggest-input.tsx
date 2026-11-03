"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { filterOutsideWorkSuggestions } from "@/modules/inspections/outside-work-suggestions";
import { filterSubSpareSuggestions } from "@/modules/inspections/sub-spare-suggestions";

type Props = {
  id: string;
  value: string;
  mainSpareLabel?: string;
  /** Sub-spare suggestions for a main part, or outside-work service suggestions. */
  suggestionMode?: "subSpare" | "outsideWork";
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  name?: string;
  required?: boolean;
  maxLength?: number;
};

/** Notes field with autocomplete (portaled so accordion/table never clips it). */
export function NoteSuggestInput({
  id,
  value,
  mainSpareLabel = "",
  suggestionMode = "subSpare",
  onValueChange,
  placeholder,
  disabled,
  className,
  name,
  required,
  maxLength = 500,
}: Props) {
  const t = useTranslations("inspections");
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [mounted, setMounted] = useState(false);
  const [menuPos, setMenuPos] = useState({
    top: 0,
    left: 0,
    width: 0,
    maxHeight: 240,
  });

  const suggestions =
    suggestionMode === "outsideWork"
      ? filterOutsideWorkSuggestions(value)
      : filterSubSpareSuggestions(mainSpareLabel, value);
  const showList = open && !disabled && suggestions.length > 0;
  const listAriaLabel =
    suggestionMode === "outsideWork"
      ? t("outsideWorkSuggestions")
      : t("subSpareSuggestions");

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!showList || !rootRef.current) return;

    function updatePosition() {
      const trigger = rootRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const gap = 4;
      const maxMenu = Math.min(240, window.innerHeight * 0.45);
      const spaceBelow = window.innerHeight - rect.bottom - gap;
      const spaceAbove = rect.top - gap;
      const placeAbove = spaceBelow < 140 && spaceAbove > spaceBelow;
      const maxHeight = Math.min(
        maxMenu,
        Math.max(placeAbove ? spaceAbove : spaceBelow, 96),
      );

      setMenuPos({
        top: placeAbove
          ? Math.max(gap, rect.top - gap - maxHeight)
          : rect.bottom + gap,
        left: rect.left,
        width: rect.width,
        maxHeight,
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [showList, value, suggestions.length]);

  useEffect(() => {
    if (!showList) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        listRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
      setActiveIndex(-1);
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [showList]);

  function applySuggestion(suggestion: string) {
    onValueChange(suggestion);
    setOpen(false);
    setActiveIndex(-1);
  }

  const listbox =
    showList && mounted
      ? createPortal(
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label={listAriaLabel}
            style={{
              position: "fixed",
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
              maxHeight: menuPos.maxHeight,
            }}
            className="z-80 overflow-y-auto rounded-md border border-border bg-card py-1 shadow-lg"
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
                      active
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-muted",
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
          </ul>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <Input
        id={id}
        name={name}
        type="text"
        autoComplete="off"
        disabled={disabled}
        required={required}
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
        placeholder={placeholder}
        maxLength={maxLength}
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
        className={cn("h-11 min-h-11", className)}
      />
      {listbox}
    </div>
  );
}
