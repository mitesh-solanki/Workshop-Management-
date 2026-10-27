"use client";

/**
 * Global searchable select — adapted from Cruise Holiday
 * (SearchableSelect / SearchableMultiSelect / PlaceSearchSelect).
 *
 * - mode "single" | "multiple"
 * - filter "local" (filter options in the menu) | "remote" (parent searches; trigger is the input)
 * - remote: type minQueryLength chars before results are expected
 *
 * Menu portals into the nearest dialog/sheet content when present so Radix
 * focus trap / aria-hidden do not block the nested search input.
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type SearchableSelectOption = {
  value: string;
  label: string;
  keywords?: string;
};

type BaseProps = {
  id?: string;
  name?: string;
  options: readonly SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  loadingLabel?: string;
  clearLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  clearable?: boolean;
  className?: string;
  /** local = filter options client-side. remote = parent owns results via onQueryChange. */
  filter?: "local" | "remote";
  /**
   * Local only: keep the menu empty until the user types a search.
   * Selected value still shows on the trigger.
   */
  requireSearch?: boolean;
  /** For remote: do not call onQueryChange until query length reaches this (default 2). */
  minQueryLength?: number;
  onQueryChange?: (query: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  noun?: string;
};

type SingleProps = BaseProps & {
  mode?: "single";
  value: string;
  onChange: (value: string) => void;
  values?: never;
};

type MultipleProps = BaseProps & {
  mode: "multiple";
  values: string[];
  onChange: (values: string[]) => void;
  value?: never;
};

export type SearchableSelectProps = SingleProps | MultipleProps;

const OPEN_EVENT = "wm-searchable-select-open";
const LAYER_SELECTOR =
  "[data-slot='dialog-content'], [data-slot='sheet-content']";

function matchesOption(opt: SearchableSelectOption, q: string) {
  return (
    opt.label.toLowerCase().includes(q) ||
    opt.value.toLowerCase().includes(q) ||
    Boolean(opt.keywords?.toLowerCase().includes(q))
  );
}

function getPortalRoot(anchor: HTMLElement | null): HTMLElement {
  if (!anchor || typeof document === "undefined") return document.body;
  const layer = anchor.closest(LAYER_SELECTOR);
  return (layer as HTMLElement | null) ?? document.body;
}

export function SearchableSelect(props: SearchableSelectProps) {
  const multiple = props.mode === "multiple";
  const filter = props.filter ?? (props.onQueryChange ? "remote" : "local");
  const remote = filter === "remote";
  const requireSearch = Boolean(props.requireSearch) && !remote;
  /** Remote (parts): type in the field. Local: button + search as first row in menu. */
  const inputTrigger = remote;
  const minQueryLength = props.minQueryLength ?? 2;
  const {
    id,
    name,
    options,
    placeholder = "Select…",
    searchPlaceholder = remote ? "Type to search…" : "Search…",
    emptyLabel = "No matches found.",
    loadingLabel = "Loading…",
    clearLabel = "Clear",
    disabled = false,
    loading = false,
    clearable = true,
    className,
    onQueryChange,
    onLoadMore,
    hasMore = false,
    noun = "selected",
  } = props;

  const selectedValues = useMemo(() => {
    if (multiple) return props.values;
    return props.value ? [props.value] : [];
  }, [multiple, props]);

  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuSearchRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const instanceId = useRef(`ss-${Math.random().toString(36).slice(2)}`);
  const [dropdownPos, setDropdownPos] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
  }>({ left: 0, width: 0, maxHeight: 280 });

  const selectedLabel = useMemo(() => {
    if (multiple) {
      if (selectedValues.length === 0) return "";
      if (selectedValues.length <= 2) {
        return selectedValues
          .map(
            (v) => options.find((o) => o.value === v)?.label ?? v,
          )
          .join(", ");
      }
      return `${selectedValues.length} ${noun}`;
    }
    const value = props.value;
    return options.find((o) => o.value === value)?.label ?? value;
  }, [multiple, noun, options, props, selectedValues]);

  function closeMenu() {
    setOpen(false);
    setQuery("");
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        !containerRef.current?.contains(target) &&
        !dropdownRef.current?.contains(target)
      ) {
        closeMenu();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function onOtherOpen(event: Event) {
      const id = (event as CustomEvent<string>).detail;
      if (id === instanceId.current) return;
      closeMenu();
    }
    document.addEventListener(OPEN_EVENT, onOtherOpen);
    return () => document.removeEventListener(OPEN_EVENT, onOtherOpen);
  }, []);

  useEffect(() => {
    if (!open) {
      setPortalRoot(null);
      return;
    }
    const root = getPortalRoot(containerRef.current);
    setPortalRoot(root);

    if (root !== document.body) {
      const prevOverflow = root.style.overflow;
      root.style.overflow = "visible";
      return () => {
        root.style.overflow = prevOverflow;
      };
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.dispatchEvent(
      new CustomEvent(OPEN_EVENT, { detail: instanceId.current }),
    );
    const frame = requestAnimationFrame(() => {
      if (inputTrigger) inputRef.current?.focus();
      else menuSearchRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, inputTrigger, portalRoot]);

  useEffect(() => {
    if (!open || !portalRoot) return;
    const trigger = triggerRef.current;
    const container = containerRef.current;
    if (!trigger) return;

    const updatePosition = () => {
      const rect = (container ?? trigger).getBoundingClientRect();
      const rootRect =
        portalRoot === document.body
          ? {
              top: 0,
              left: 0,
              bottom: window.innerHeight,
              right: window.innerWidth,
              width: window.innerWidth,
              height: window.innerHeight,
            }
          : portalRoot.getBoundingClientRect();
      const gap = 6;
      const maxMenu = Math.min(280, window.innerHeight * 0.6);
      const spaceBelow = Math.min(
        window.innerHeight - rect.bottom - gap,
        rootRect.bottom - rect.bottom - gap,
      );
      const spaceAbove = Math.min(rect.top - gap, rect.top - rootRect.top - gap);
      const placeAbove = spaceBelow < 140 && spaceAbove > spaceBelow;
      const preferredWidth = Math.max(rect.width, 176);
      const maxRight = rootRect.right - 8;
      const leftViewport = Math.min(
        rect.left,
        Math.max(rootRect.left + 8, maxRight - preferredWidth),
      );
      const left = leftViewport - rootRect.left;
      const width = Math.min(preferredWidth, maxRight - leftViewport);

      if (placeAbove) {
        setDropdownPos({
          top: undefined,
          bottom: rootRect.bottom - rect.top + gap,
          left,
          width,
          maxHeight: Math.min(maxMenu, Math.max(spaceAbove, 80)),
        });
        return;
      }

      setDropdownPos({
        top: rect.bottom - rootRect.top + gap,
        bottom: undefined,
        left,
        width,
        maxHeight: Math.min(maxMenu, Math.max(spaceBelow, 80)),
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, portalRoot]);

  const onQueryChangeRef = useRef(onQueryChange);
  onQueryChangeRef.current = onQueryChange;
  const skipInitialQuery = useRef(true);
  useEffect(() => {
    if (skipInitialQuery.current) {
      skipInitialQuery.current = false;
      return;
    }
    if (!onQueryChangeRef.current) return;
    if (remote && query.trim().length > 0 && query.trim().length < minQueryLength) {
      return;
    }
    onQueryChangeRef.current(query);
  }, [query, remote, minQueryLength]);

  const filtered = useMemo(() => {
    if (remote) {
      if (query.trim().length < minQueryLength && query.trim().length > 0) {
        return [];
      }
      return [...options];
    }
    const q = query.trim().toLowerCase();
    if (requireSearch && !q) return [];
    const source = q ? options.filter((opt) => matchesOption(opt, q)) : [...options];

    if (!multiple) return source;

    const seen = new Set<string>();
    const selected: SearchableSelectOption[] = [];
    const rest: SearchableSelectOption[] = [];
    for (const value of selectedValues) {
      if (seen.has(value)) continue;
      const match = source.find((opt) => opt.value === value);
      selected.push(match ?? { value, label: value });
      seen.add(value);
    }
    for (const opt of source) {
      if (seen.has(opt.value)) continue;
      rest.push(opt);
      seen.add(opt.value);
    }
    return [...selected, ...rest];
  }, [
    options,
    query,
    remote,
    requireSearch,
    minQueryLength,
    multiple,
    selectedValues,
  ]);

  function selectSingle(next: string) {
    if (multiple) return;
    props.onChange(next);
    closeMenu();
  }

  function toggleMultiple(next: string) {
    if (!multiple) return;
    props.onChange(
      selectedSet.has(next)
        ? props.values.filter((item) => item !== next)
        : [...props.values, next],
    );
  }

  function clearSelection() {
    if (multiple) props.onChange([]);
    else props.onChange("");
    setQuery("");
  }

  const hasSelection = selectedValues.length > 0;
  const queryTrim = query.trim();

  const menuMessage = loading ? loadingLabel : emptyLabel;

  /**
   * Remote field search: hint stays in the input only — do not open an empty
   * panel that repeats the same “type to search” text underneath.
   */
  const showMenu =
    open &&
    mounted &&
    portalRoot != null &&
    !(requireSearch && queryTrim.length === 0) &&
    !(inputTrigger && queryTrim.length < minQueryLength);

  const menuInLayer = portalRoot != null && portalRoot !== document.body;

  const menu =
    showMenu && portalRoot ? (
      <div
        ref={dropdownRef}
        data-slot="searchable-select-dropdown"
        className={cn(
          "pointer-events-auto z-10020 overflow-hidden rounded-lg border border-border bg-card shadow-lg",
          menuInLayer ? "absolute" : "fixed",
        )}
        style={{
          top: dropdownPos.top,
          bottom: dropdownPos.bottom,
          left: dropdownPos.left,
          width: dropdownPos.width,
          maxHeight: dropdownPos.maxHeight,
        }}
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        {!inputTrigger ? (
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              ref={menuSearchRef}
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoComplete="off"
            />
          </div>
        ) : null}
        <div
          className="overscroll-contain py-1"
          style={{
            maxHeight: Math.max(
              80,
              dropdownPos.maxHeight - (inputTrigger ? 0 : 48),
            ),
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-y",
          }}
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onScroll={(e) => {
            if (!onLoadMore || !hasMore || loading) return;
            if (remote && queryTrim.length < minQueryLength) return;
            const el = e.currentTarget;
            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 48) {
              onLoadMore();
            }
          }}
        >
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">{menuMessage}</p>
          ) : (
            filtered.map((opt) => {
              const selected = selectedSet.has(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    multiple ? toggleMultiple(opt.value) : selectSingle(opt.value)
                  }
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted/60",
                    selected
                      ? "bg-primary/10 font-semibold text-foreground"
                      : "text-foreground",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                  {selected ? (
                    <Check className="size-4 shrink-0 text-primary" aria-hidden />
                  ) : null}
                </button>
              );
            })
          )}
          {hasMore && filtered.length > 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              {loading ? loadingLabel : "Scroll to load more"}
            </p>
          ) : null}
        </div>
      </div>
    ) : null;

  const showClear = clearable && hasSelection && !disabled;

  const hiddenInputs =
    name && !disabled ? (
      multiple ? (
        selectedValues.map((v) => (
          <input key={v} type="hidden" name={name} value={v} />
        ))
      ) : (
        <input type="hidden" name={name} value={props.value} />
      )
    ) : null;

  const portaledMenu =
    menu && portalRoot ? createPortal(menu, portalRoot) : null;

  if (inputTrigger) {
    const fieldValue = open ? query : selectedLabel;
    const fieldPlaceholder = open
      ? searchPlaceholder
      : loading && !hasSelection
        ? loadingLabel
        : placeholder;

    return (
      <div ref={containerRef} className={cn("relative w-full min-w-0", className)}>
        {hiddenInputs}
        <div
          ref={triggerRef as RefObject<HTMLDivElement>}
          id={id}
          className={cn(
            "flex h-11 min-h-11 w-full items-center justify-between rounded-md border border-input bg-card px-3 text-left text-sm shadow-xs outline-none transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30",
            disabled && "pointer-events-none opacity-50",
          )}
          onClick={() => {
            if (disabled) return;
            if (!open) {
              setQuery("");
              setOpen(true);
            }
            inputRef.current?.focus();
          }}
        >
          <Search
            className="mr-2 size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <input
            ref={inputRef}
            type="text"
            disabled={disabled}
            value={fieldValue}
            placeholder={fieldPlaceholder}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!open) setOpen(true);
            }}
            onFocus={() => {
              if (disabled) return;
              if (!open) {
                setQuery("");
                setOpen(true);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                closeMenu();
                inputRef.current?.blur();
              }
              if (e.key === "Enter") e.preventDefault();
            }}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
            autoComplete="off"
          />
          <div className="flex shrink-0 items-center gap-1">
            {showClear ? (
              <button
                type="button"
                aria-label={clearLabel}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  clearSelection();
                }}
              >
                <X className="size-3.5" />
              </button>
            ) : null}
            <ChevronDown
              className={cn(
                "size-4 text-muted-foreground transition",
                open && "rotate-180",
              )}
              aria-hidden
            />
          </div>
        </div>
        {portaledMenu}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn("relative w-full min-w-0", className)}>
      {hiddenInputs}
      <button
        ref={triggerRef as RefObject<HTMLButtonElement>}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
        className={cn(
          "flex h-11 min-h-11 w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 text-left text-sm shadow-xs outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 disabled:pointer-events-none disabled:opacity-50",
        )}
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            hasSelection ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {hasSelection
            ? selectedLabel
            : loading
              ? loadingLabel
              : placeholder}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {showClear ? (
            <span
              role="button"
              tabIndex={0}
              aria-label={clearLabel}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                clearSelection();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  clearSelection();
                }
              }}
            >
              <X className="size-3.5" />
            </span>
          ) : null}
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </div>
      </button>
      {portaledMenu}
    </div>
  );
}
