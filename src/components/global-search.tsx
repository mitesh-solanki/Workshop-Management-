"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  Car,
  ClipboardList,
  Loader2,
  Package,
  Receipt,
  Search,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  GLOBAL_SEARCH_ENTITY_TYPES,
  GLOBAL_SEARCH_MIN_CHARS,
  type GlobalSearchEntityType,
  type GlobalSearchMatchField,
  type GlobalSearchResult,
} from "@/modules/global-search/schema";

const DEBOUNCE_MS = 350;

const TYPE_ICONS: Record<GlobalSearchEntityType, LucideIcon> = {
  customer: Users,
  vehicle: Car,
  order: ClipboardList,
  part: Package,
  vendor: Store,
  invoice: Receipt,
};

export function GlobalSearch() {
  const t = useTranslations("shell");
  const router = useRouter();
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [query]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  useEffect(() => {
    abortRef.current?.abort();

    if (debouncedQuery.length < GLOBAL_SEARCH_MIN_CHARS) {
      setResults([]);
      setLoading(false);
      setError(null);
      setActiveIndex(-1);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(debouncedQuery)}`,
          { signal: controller.signal },
        );
        const json = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          results?: GlobalSearchResult[];
          error?: string;
        };
        if (!res.ok || !json.success) {
          throw new Error(json.error || "search_failed");
        }
        setResults(Array.isArray(json.results) ? json.results : []);
        setActiveIndex(-1);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setResults([]);
        setError(t("searchError"));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [debouncedQuery, t]);

  const flatResults = results;
  const grouped = useMemo(() => {
    const map = new Map<GlobalSearchEntityType, GlobalSearchResult[]>();
    for (const type of GLOBAL_SEARCH_ENTITY_TYPES) map.set(type, []);
    for (const item of results) {
      const list = map.get(item.type);
      if (list) list.push(item);
    }
    return GLOBAL_SEARCH_ENTITY_TYPES.filter(
      (type) => (map.get(type)?.length ?? 0) > 0,
    ).map((type) => ({
      type,
      items: map.get(type)!,
    }));
  }, [results]);

  const showPanel =
    open && query.trim().length >= GLOBAL_SEARCH_MIN_CHARS;

  const goTo = useCallback(
    (href: string) => {
      setOpen(false);
      setActiveIndex(-1);
      router.push(href);
    },
    [router],
  );

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!showPanel) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, flatResults.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, -1));
    } else if (
      event.key === "Enter" &&
      activeIndex >= 0 &&
      flatResults[activeIndex]
    ) {
      event.preventDefault();
      goTo(flatResults[activeIndex].href);
    } else if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      inputRef.current?.blur();
    }
  }

  let optionOffset = 0;

  const waitingForDebounce =
    query.trim() !== debouncedQuery &&
    query.trim().length >= GLOBAL_SEARCH_MIN_CHARS;

  const statusLabel =
    loading || waitingForDebounce
      ? t("searching")
      : error
        ? t("searchError")
        : t("searchResultCount", { count: results.length });

  return (
    <div ref={rootRef} className="relative w-full min-w-0">
      <label className="relative block">
        <span className="sr-only">{t("searchLabel")}</span>
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <Input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchLabel")}
          aria-controls={listboxId}
          aria-autocomplete="list"
          autoComplete="off"
          className="h-11 rounded-lg border-slate-200 bg-slate-50 pr-3 pl-9 sm:pr-16"
        />
        <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border border-slate-200 bg-card px-1.5 py-0.5 text-[10px] font-medium text-slate-500 sm:inline">
          {t("searchShortcut")}
        </kbd>
      </label>

      {showPanel ? (
        <div
          id={listboxId}
          role="listbox"
          className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-xl border border-slate-200 bg-card shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
              {statusLabel}
            </p>
            {loading || waitingForDebounce ? (
              <Loader2
                className="size-3.5 animate-spin text-slate-500"
                aria-hidden
              />
            ) : null}
          </div>

          <div className="max-h-[min(28rem,70vh)] overflow-y-auto py-1">
            {error ? (
              <p className="px-4 py-6 text-center text-sm text-red-600">
                {error}
              </p>
            ) : !loading && !waitingForDebounce && results.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">
                {t("searchNoResults", { query: debouncedQuery || query.trim() })}
              </p>
            ) : loading || waitingForDebounce ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">
                {t("searching")}
              </p>
            ) : (
              grouped.map((group) => {
                const Icon = TYPE_ICONS[group.type];
                return (
                  <div key={group.type} className="py-1">
                    <div className="sticky top-0 z-1 flex items-center gap-2 bg-slate-50/95 px-4 py-1.5 backdrop-blur-sm">
                      <Icon className="size-3.5 text-slate-500" aria-hidden />
                      <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                        {t(`searchTypes.${group.type}`)}
                      </span>
                    </div>
                    <ul>
                      {group.items.map((item) => {
                        const index = optionOffset;
                        optionOffset += 1;
                        const active = index === activeIndex;
                        return (
                          <li
                            key={`${item.type}-${item.id}`}
                            role="option"
                            aria-selected={active}
                          >
                            <Link
                              href={item.href}
                              onClick={() => {
                                setOpen(false);
                                setActiveIndex(-1);
                              }}
                              onMouseEnter={() => setActiveIndex(index)}
                              className={cn(
                                "flex items-start gap-3 px-4 py-2.5 transition-colors",
                                active ? "bg-slate-100" : "hover:bg-slate-50",
                              )}
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold text-slate-900">
                                  {item.title}
                                </span>
                                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                                  <span className="font-medium text-slate-700">
                                    {t("searchMatchedIn", {
                                      field: t(
                                        `searchFields.${item.matchIn as GlobalSearchMatchField}`,
                                      ),
                                    })}
                                  </span>
                                  {item.subtitle ? (
                                    <>
                                      <span aria-hidden>·</span>
                                      <span className="truncate">
                                        {item.subtitle}
                                      </span>
                                    </>
                                  ) : null}
                                </span>
                              </span>
                              <ArrowRight
                                className={cn(
                                  "mt-1 size-3.5 shrink-0",
                                  active ? "text-slate-700" : "text-slate-300",
                                )}
                                aria-hidden
                              />
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
