"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  getPartPickerItemAction,
  searchPartsCatalogAction,
  type PartsPickerPageResult,
} from "@/app/actions/inventory";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "@/components/ui/toast";
import { withSelectedPartFirst } from "@/modules/inventory/components/parts-select-order";

export type PartPickerItem = PartsPickerPageResult["items"][number];

const PAGE_SIZE = 25;

type Props = {
  id?: string;
  name?: string;
  value: string;
  onChange: (partId: string, part: PartPickerItem | null) => void;
  className?: string;
  disabled?: boolean;
  clearable?: boolean;
  /** Shown until the selected part finishes loading (e.g. line description). */
  initialLabel?: string;
  /**
   * When the typed name is not in the list, show Add “{name}” and call this
   * (opens Create Part modal — do not silent-create like the old mechanic path).
   */
  onCreateFromQuery?: (name: string) => void;
};

/**
 * Job-card / estimate part picker: browse list on open (includes zero stock),
 * type to filter. Labels stay short (name + qty only).
 */
export function PartPickerSelect({
  id,
  name,
  value,
  onChange,
  className,
  disabled,
  clearable = true,
  initialLabel,
  onCreateFromQuery,
}: Props) {
  const ti = useTranslations("inventory");
  const [items, setItems] = useState<PartPickerItem[]>([]);
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<PartPickerItem | null>(() =>
    value && initialLabel
      ? {
          id: value,
          name: initialLabel,
          sku: "",
          unit: "pcs",
          sellingPricePaise: 0,
          quantityOnHand: 0,
        }
      : null,
  );
  const queryRef = useRef("");
  const requestId = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOpenRef = useRef(false);

  const loadPage = useCallback(
    async (q: string, offset: number, append: boolean) => {
      const idNow = ++requestId.current;
      setLoading(true);
      try {
        const page = await searchPartsCatalogAction(q.trim(), offset, PAGE_SIZE);
        if (idNow !== requestId.current) {
          return;
        }
        setItems((prev) => {
          if (!append) {
            return page.items;
          }
          const seen = new Set(prev.map((item) => item.id));
          return [...prev, ...page.items.filter((item) => !seen.has(item.id))];
        });
        setNextOffset(page.nextOffset);
        setHasMore(page.hasMore);
      } catch {
        if (idNow !== requestId.current) {
          return;
        }
        if (!append) {
          setItems([]);
          setNextOffset(0);
          setHasMore(false);
        }
        toast.error(ti("pickerLoadFailed"));
      } finally {
        if (idNow === requestId.current) {
          setLoading(false);
        }
      }
    },
    [ti],
  );

  useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    const match = items.find((item) => item.id === value);
    if (match) {
      setSelected(match);
      return;
    }
    if (selected?.id === value) {
      return;
    }
    let cancelled = false;
    void getPartPickerItemAction(value).then((part) => {
      if (cancelled || !part) return;
      setSelected(part);
    });
    return () => {
      cancelled = true;
    };
  }, [value, items, selected?.id]);

  const options = useMemo(() => {
    return withSelectedPartFirst(items, selected).map((part) => ({
      value: part.id,
      label: part.sku
        ? ti("partOptionLabel", {
            name: part.name,
            sku: part.sku,
            count: part.quantityOnHand,
            unit: part.unit,
          })
        : part.name,
      keywords: `${part.name} ${part.sku}`,
    }));
  }, [items, selected, ti]);

  function handleQueryChange(query: string) {
    queryRef.current = query;
    if (!isOpenRef.current) {
      return;
    }
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    setItems([]);
    setHasMore(false);
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      if (!isOpenRef.current) {
        return;
      }
      void loadPage(queryRef.current, 0, false);
    }, 250);
  }

  function handleOpenChange(open: boolean) {
    isOpenRef.current = open;
    if (!open) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      requestId.current += 1;
      setLoading(false);
      setItems([]);
      setHasMore(false);
      return;
    }
    queryRef.current = "";
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    setLoading(true);
    void loadPage("", 0, false);
  }

  function handleLoadMore() {
    if (loading || !hasMore) {
      return;
    }
    void loadPage(queryRef.current, nextOffset, true);
  }

  function handleChange(nextId: string) {
    if (!nextId) {
      setSelected(null);
      onChange("", null);
      return;
    }
    const part =
      items.find((item) => item.id === nextId) ??
      (selected?.id === nextId ? selected : null);
    if (part) {
      setSelected(part);
    }
    onChange(nextId, part);
  }

  return (
    <SearchableSelect
      id={id}
      name={name}
      value={value}
      onChange={handleChange}
      options={options}
      filter="remote"
      minQueryLength={0}
      loading={loading}
      hasMore={hasMore}
      onQueryChange={handleQueryChange}
      onOpenChange={handleOpenChange}
      onLoadMore={handleLoadMore}
      clearable={clearable}
      disabled={disabled}
      placeholder={ti("partSelectPlaceholder")}
      searchPlaceholder={
        onCreateFromQuery
          ? ti("partSelectPlaceholderQuickCreate")
          : ti("partSelectPlaceholder")
      }
      emptyLabel={
        onCreateFromQuery
          ? ti("emptySearchQuickCreate")
          : ti("emptySearchTitle")
      }
      loadingLabel={ti("pickerLoading")}
      className={className}
      createFromQueryLabel={
        onCreateFromQuery
          ? (query) => ti("quickAddPart", { name: query })
          : undefined
      }
      onCreateFromQuery={onCreateFromQuery}
    />
  );
}
