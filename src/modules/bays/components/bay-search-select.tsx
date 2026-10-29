"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { SearchableSelect } from "@/components/ui/searchable-select";

export type BaySearchOption = {
  id: string;
  name: string;
};

type Props = {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  bays: readonly BaySearchOption[];
  /** Job cards store bay name; workshop filter uses bay id. */
  valueKey?: "id" | "name";
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
  /** Extra option with empty value (e.g. All Bays). */
  emptyOptionLabel?: string;
  /** Include a selected value that is no longer in the bay list. */
  orphanValue?: string;
  orphanLabel?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
};

/**
 * Shared bay picker: browse + type-to-search in the same field.
 */
export function BaySearchSelect({
  id,
  name,
  value,
  onChange,
  bays,
  valueKey = "name",
  disabled = false,
  clearable = true,
  className,
  emptyOptionLabel,
  orphanValue,
  orphanLabel,
  placeholder,
  searchPlaceholder,
  emptyLabel,
}: Props) {
  const t = useTranslations("orders");
  const [query, setQuery] = useState("");

  const allOptions = useMemo(() => {
    const options = bays.map((bay) => ({
      value: valueKey === "id" ? bay.id : bay.name,
      label: bay.name,
      keywords: `${bay.name} ${bay.id}`,
    }));
    const known = new Set(options.map((opt) => opt.value));
    if (orphanValue?.trim() && !known.has(orphanValue.trim())) {
      options.unshift({
        value: orphanValue.trim(),
        label: orphanLabel?.trim() || orphanValue.trim(),
        keywords: orphanValue.trim(),
      });
    }
    if (emptyOptionLabel) {
      options.unshift({
        value: "",
        label: emptyOptionLabel,
        keywords: emptyOptionLabel,
      });
    }
    return options;
  }, [bays, valueKey, orphanValue, orphanLabel, emptyOptionLabel]);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allOptions;
    return allOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q) ||
        Boolean(opt.keywords?.toLowerCase().includes(q)),
    );
  }, [allOptions, query]);

  return (
    <SearchableSelect
      id={id}
      name={name}
      value={value}
      onChange={onChange}
      options={options}
      filter="remote"
      minQueryLength={0}
      onQueryChange={setQuery}
      onOpenChange={(open) => {
        if (!open) setQuery("");
      }}
      clearable={clearable}
      disabled={disabled}
      className={className}
      placeholder={placeholder ?? t("bayPlaceholder")}
      searchPlaceholder={searchPlaceholder ?? t("baySearchPlaceholder")}
      emptyLabel={emptyLabel ?? t("bayEmptyOptions")}
    />
  );
}
