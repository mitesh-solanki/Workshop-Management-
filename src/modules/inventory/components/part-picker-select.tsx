"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  getPartPickerItemAction,
  searchPartsPickerAction,
  type PartsPickerPageResult,
} from "@/app/actions/inventory";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { withSelectedPartFirst } from "@/modules/inventory/components/parts-select-order";

export type PartPickerItem = PartsPickerPageResult["items"][number];

const PAGE_SIZE = 25;
const MIN_QUERY = 1;

type Props = {
  id?: string;
  name?: string;
  value: string;
  onChange: (partId: string, part: PartPickerItem | null) => void;
  className?: string;
  disabled?: boolean;
};

export function PartPickerSelect({
  id,
  name,
  value,
  onChange,
  className,
  disabled,
}: Props) {
  const ti = useTranslations("inventory");
  const [items, setItems] = useState<PartPickerItem[]>([]);
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<PartPickerItem | null>(null);
  const queryRef = useRef("");
  const requestId = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadPage = useCallback(async (q: string, offset: number, append: boolean) => {
    const trimmed = q.trim();
    if (trimmed.length < MIN_QUERY) {
      setItems([]);
      setNextOffset(0);
      setHasMore(false);
      setLoading(false);
      return;
    }
    const idNow = ++requestId.current;
    setLoading(true);
    try {
      const page = await searchPartsPickerAction(trimmed, offset, PAGE_SIZE);
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
    } finally {
      if (idNow === requestId.current) {
        setLoading(false);
      }
    }
  }, []);

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
    if (loading && items.length === 0) return [];
    return withSelectedPartFirst(items, selected).map((part) => ({
      value: part.id,
      label: ti("partOptionLabel", {
        name: part.name,
        sku: part.sku,
        count: part.quantityOnHand,
        unit: part.unit,
      }),
      keywords: `${part.name} ${part.sku}`,
    }));
  }, [items, selected, loading, ti]);

  function handleQueryChange(query: string) {
    queryRef.current = query;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY) {
      requestId.current += 1;
      setItems([]);
      setNextOffset(0);
      setHasMore(false);
      setLoading(false);
      return;
    }
    setItems([]);
    setHasMore(false);
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      void loadPage(queryRef.current, 0, false);
    }, 250);
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
      minQueryLength={MIN_QUERY}
      loading={loading}
      hasMore={hasMore}
      onQueryChange={handleQueryChange}
      onLoadMore={handleLoadMore}
      clearable
      disabled={disabled}
      placeholder={ti("partSelectPlaceholder")}
      searchPlaceholder={ti("partCatalogSearchHint")}
      emptyLabel={ti("emptySearchTitle")}
      loadingLabel={ti("pickerLoading")}
      className={className}
    />
  );
}
