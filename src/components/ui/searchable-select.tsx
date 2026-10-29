"use client";

/**
 * Global searchable select — adapted from Cruise Holiday
 * (SearchableSelect / SearchableMultiSelect / PlaceSearchSelect).
 *
 * - mode "single" | "multiple"
 * - filter "local" (filter options in the menu) | "remote" (parent searches; trigger is the input)
 * - remote: type minQueryLength chars before results are expected
 *
 * Menu portals to document.body with position:fixed so dialog overflow /
 * zoom does not stretch a white card behind the list. Dialog/sheet keep
 * the menu open via searchable-select outside-interaction guards.
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Plus, Search, X } from "lucide-react";
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
  "aria-invalid"?: boolean | "true" | "false";
  "aria-describedby"?: string;
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
  /** Fired when the menu opens or closes (e.g. load a browse list on open). */
  onOpenChange?: (open: boolean) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  noun?: string;
  /**
   * When the menu has no matches and the query is non-empty, show this action
   * and allow Enter to create from the typed text (e.g. Add "{name}").
   */
  createFromQueryLabel?: (query: string) => string;
  onCreateFromQuery?: (query: string) => void;
  creatingFromQuery?: boolean;
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

function matchesOption(opt: SearchableSelectOption, q: string) {
  return (
    opt.label.toLowerCase().includes(q) ||
    opt.value.toLowerCase().includes(q) ||
    Boolean(opt.keywords?.toLowerCase().includes(q))
  );
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
    onOpenChange,
    onLoadMore,
    hasMore = false,
    noun = "selected",
    createFromQueryLabel,
    onCreateFromQuery,
    creatingFromQuery = false,
  } = props;
  const invalid =
    props["aria-invalid"] === true || props["aria-invalid"] === "true";
  const describedBy = props["aria-describedby"];
  const triggerInvalidClass = invalid
    ? "border-red-500 focus-within:border-red-500 focus-within:ring-red-500/25 focus-visible:border-red-500 focus-visible:ring-red-500/25"
    : undefined;

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
    if (!value) return "";
    return options.find((o) => o.value === value)?.label ?? "";
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
    // Always portal to body with fixed coords. Portaling into dialog + overflow
    // visible stretches the modal card behind the menu.
    setPortalRoot(document.body);
  }, [open]);

  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  useEffect(() => {
    onOpenChangeRef.current?.(open);
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
    if (!trigger) return;

    const updatePosition = () => {
      const rect = trigger.getBoundingClientRect();
      if (rect.width < 8) return;
      const gap = 6;
      const maxMenu = Math.min(280, window.innerHeight * 0.6);
      const spaceBelow = window.innerHeight - rect.bottom - gap;
      const spaceAbove = rect.top - gap;
      const placeAbove = spaceBelow < 140 && spaceAbove > spaceBelow;
      const width = rect.width;
      const left = rect.left;

      if (placeAbove) {
        setDropdownPos({
          top: undefined,
          bottom: window.innerHeight - rect.top + gap,
          left,
          width,
          maxHeight: Math.min(maxMenu, Math.max(spaceAbove, 80)),
        });
        return;
      }

      setDropdownPos({
        top: rect.bottom + gap,
        bottom: undefined,
        left,
        width,
        maxHeight: Math.min(maxMenu, Math.max(spaceBelow, 80)),
      });
    };

    updatePosition();
    const raf1 = requestAnimationFrame(() => {
      updatePosition();
      requestAnimationFrame(updatePosition);
    });
    const settleTimer = window.setTimeout(updatePosition, 220);
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => updatePosition())
        : null;
    resizeObserver?.observe(trigger);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      cancelAnimationFrame(raf1);
      window.clearTimeout(settleTimer);
      resizeObserver?.disconnect();
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

  const menu =
    showMenu && portalRoot ? (
      <div
        ref={dropdownRef}
        data-slot="searchable-select-dropdown"
        className="pointer-events-auto fixed z-10020 overflow-hidden rounded-lg border border-border bg-card shadow-lg"
        style={{
          top: dropdownPos.top,
          bottom: dropdownPos.bottom,
          left: dropdownPos.left,
          width: dropdownPos.width,
          minWidth: dropdownPos.width,
          maxWidth: dropdownPos.width,
          maxHeight: dropdownPos.maxHeight,
          boxSizing: "border-box",
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
          {onCreateFromQuery &&
          createFromQueryLabel &&
          queryTrim.length > 0 &&
          !loading ? (
            <button
              type="button"
              disabled={creatingFromQuery}
              onClick={() => {
                const name = queryTrim;
                closeMenu();
                onCreateFromQuery(name);
              }}
              className={cn(
                "flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-left text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60",
                filtered.length === 0 && "border-t-0",
              )}
            >
              <Plus className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
              <span className="min-w-0 flex-1 truncate">
                {creatingFromQuery
                  ? loadingLabel
                  : createFromQueryLabel(queryTrim)}
              </span>
            </button>
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
            triggerInvalidClass,
            disabled && "pointer-events-none opacity-50",
          )}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
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
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
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
                return;
              }
              if (e.key === "Enter") {
                e.preventDefault();
                if (
                  filtered.length === 0 &&
                  queryTrim.length > 0 &&
                  onCreateFromQuery &&
                  !creatingFromQuery &&
                  !loading
                ) {
                  const name = queryTrim;
                  closeMenu();
                  onCreateFromQuery(name);
                }
              }
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
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
        className={cn(
          "flex h-11 min-h-11 w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 text-left text-sm shadow-xs outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 disabled:pointer-events-none disabled:opacity-50",
          triggerInvalidClass,
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
