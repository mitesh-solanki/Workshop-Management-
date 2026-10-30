"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { FileText, Plus, Trash2, Upload, X } from "lucide-react";
import { getVendorOptionsAction } from "@/app/actions/vendors";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { QuantityStepper } from "@/modules/inventory/components/quantity-stepper";
import { shopReceiveFilesForUpload as filesForUpload } from "@/modules/inventory/shop-receive";

export type ShopReceiveVendor = { id: string; name: string };

export type ShopReceiveLine = {
  key: string;
  vendorId: string;
  quantity: number;
  file: File | null;
};

type Props = {
  idPrefix: string;
  disabled?: boolean;
  lines: ShopReceiveLine[];
  onLinesChange: (lines: ShopReceiveLine[]) => void;
  /** Line keys that need a vendor — red error under the vendor field. */
  vendorErrorKeys?: string[];
};

function newLine(): ShopReceiveLine {
  return {
    key: `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    vendorId: "",
    quantity: 1,
    file: null,
  };
}

/** Keep the target above the fixed FormActionBar (and similar sticky footers). */
function scrollIntoViewClearOfStickyFooter(el: HTMLElement) {
  const bar = document.querySelector("[data-slot='form-action-bar']");
  const barHeight =
    bar instanceof HTMLElement ? bar.getBoundingClientRect().height : 0;
  const gap = 16;
  const rect = el.getBoundingClientRect();
  const viewportBottom = window.innerHeight - barHeight - gap;
  if (rect.bottom > viewportBottom) {
    window.scrollBy({
      top: rect.bottom - viewportBottom,
      behavior: "smooth",
    });
    return;
  }
  if (rect.top < gap) {
    window.scrollBy({ top: rect.top - gap, behavior: "smooth" });
  }
}

export function ShopReceiveFields({
  idPrefix,
  disabled = false,
  lines,
  onLinesChange,
  vendorErrorKeys = [],
}: Props) {
  const t = useTranslations("inventory");
  const [vendors, setVendors] = useState<ShopReceiveVendor[]>([]);
  const [vendorQueries, setVendorQueries] = useState<Record<string, string>>(
    {},
  );
  const [highlightedLineKey, setHighlightedLineKey] = useState<string | null>(
    null,
  );
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const linesRef = useRef(lines);
  linesRef.current = lines;
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const previewUrlsRef = useRef<Record<string, string>>({});
  const rowRefs = useRef<Record<string, HTMLElement | null>>({});
  const highlightClearTimerRef = useRef<number | null>(null);

  function flashHighlight(lineKey: string) {
    if (highlightClearTimerRef.current != null) {
      window.clearTimeout(highlightClearTimerRef.current);
    }
    setHighlightedLineKey(lineKey);
    highlightClearTimerRef.current = window.setTimeout(() => {
      setHighlightedLineKey((current) =>
        current === lineKey ? null : current,
      );
      highlightClearTimerRef.current = null;
    }, 2500);
  }

  useEffect(() => {
    let cancelled = false;
    void getVendorOptionsAction().then((rows) => {
      if (!cancelled) setVendors(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      for (const url of Object.values(previewUrlsRef.current)) {
        URL.revokeObjectURL(url);
      }
      previewUrlsRef.current = {};
      if (highlightClearTimerRef.current != null) {
        window.clearTimeout(highlightClearTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const nextUrls: Record<string, string> = { ...previewUrlsRef.current };
    const keep = new Set(lines.map((line) => line.key));

    for (const key of Object.keys(nextUrls)) {
      if (!keep.has(key)) {
        URL.revokeObjectURL(nextUrls[key]!);
        delete nextUrls[key];
      }
    }

    for (const line of lines) {
      const existing = nextUrls[line.key];
      if (!line.file || !line.file.type.startsWith("image/")) {
        if (existing) {
          URL.revokeObjectURL(existing);
          delete nextUrls[line.key];
        }
        continue;
      }
      if (existing) continue;
      nextUrls[line.key] = URL.createObjectURL(line.file);
    }

    previewUrlsRef.current = nextUrls;
    setPreviewUrls({ ...nextUrls });
  }, [lines]);

  useEffect(() => {
    if (vendorErrorKeys.length === 0) return;
    const firstKey = vendorErrorKeys[0];
    if (!firstKey) return;
    window.setTimeout(() => {
      const row = rowRefs.current[firstKey];
      if (row) scrollIntoViewClearOfStickyFooter(row);
      document.getElementById(`${idPrefix}-vendor-${firstKey}`)?.focus();
    }, 50);
  }, [vendorErrorKeys, idPrefix]);

  const busy = disabled;

  function updateLine(key: string, patch: Partial<ShopReceiveLine>) {
    onLinesChange(
      linesRef.current.map((line) =>
        line.key === key ? { ...line, ...patch } : line,
      ),
    );
    if (patch.vendorId !== undefined && key === highlightedLineKey) {
      setHighlightedLineKey(null);
    }
  }

  function addLine() {
    const line = newLine();
    onLinesChange([...linesRef.current, line]);
    flashHighlight(line.key);
    window.setTimeout(() => {
      const row = rowRefs.current[line.key];
      if (row) scrollIntoViewClearOfStickyFooter(row);
      document.getElementById(`${idPrefix}-vendor-${line.key}`)?.focus();
    }, 80);
  }

  function removeLine(key: string) {
    if (linesRef.current.length <= 1) {
      const reset = newLine();
      onLinesChange([reset]);
      flashHighlight(reset.key);
      return;
    }
    onLinesChange(linesRef.current.filter((line) => line.key !== key));
    if (highlightedLineKey === key) setHighlightedLineKey(null);
  }

  function optionsForLine(line: ShopReceiveLine) {
    const q = (vendorQueries[line.key] ?? "").trim().toLowerCase();
    const matched = q
      ? vendors.filter((vendor) => vendor.name.toLowerCase().includes(q))
      : vendors;
    const selected = vendors.find((vendor) => vendor.id === line.vendorId);
    const rows =
      selected && !matched.some((vendor) => vendor.id === selected.id)
        ? [selected, ...matched]
        : matched;
    return rows.map((vendor) => ({
      value: vendor.id,
      label: vendor.name,
      keywords: vendor.name,
    }));
  }

  function renderVendorSelect(line: ShopReceiveLine, showLabel: boolean) {
    const vendorError = vendorErrorKeys.includes(line.key)
      ? t("shopVendorRequired")
      : undefined;
    const select = (
      <SearchableSelect
        id={`${idPrefix}-vendor-${line.key}`}
        value={line.vendorId}
        onChange={(next) => {
          updateLine(line.key, { vendorId: next });
        }}
        clearable
        filter="remote"
        minQueryLength={0}
        onQueryChange={(q) =>
          setVendorQueries((prev) => ({
            ...prev,
            [line.key]: q,
          }))
        }
        placeholder={t("boughtFromPlaceholder")}
        searchPlaceholder={t("boughtFromPlaceholder")}
        emptyLabel={t("emptyVendorSearch")}
        disabled={busy}
        options={optionsForLine(line)}
      />
    );
    if (!showLabel) {
      return (
        <div className="min-w-0 space-y-1">
          {select}
          {vendorError ? (
            <p className="text-caption text-danger" role="alert">
              {vendorError}
            </p>
          ) : null}
        </div>
      );
    }
    return (
      <FormField
        id={`${idPrefix}-vendor-${line.key}`}
        label={t("vendor")}
        error={vendorError}
      >
        {select}
      </FormField>
    );
  }

  function renderQty(line: ShopReceiveLine, showLabel: boolean) {
    return (
      <QuantityStepper
        id={`${idPrefix}-qty-${line.key}`}
        label={t("qtyFromShop")}
        defaultValue={line.quantity}
        min={1}
        hideLabel={!showLabel}
        onValueChange={(quantity) => updateLine(line.key, { quantity })}
      />
    );
  }

  function clearBill(lineKey: string) {
    updateLine(lineKey, { file: null });
    const input = fileInputRefs.current[lineKey];
    if (input) input.value = "";
  }

  function billFileKind(file: File): "image" | "pdf" | "file" {
    if (file.type.startsWith("image/")) return "image";
    if (
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf")
    ) {
      return "pdf";
    }
    return "file";
  }

  function renderBill(line: ShopReceiveLine, showLabel: boolean) {
    const kind = line.file ? billFileKind(line.file) : null;
    const isImage = kind === "image" && Boolean(previewUrls[line.key]);
    const control = (
      <>
        <input
          ref={(el) => {
            fileInputRefs.current[line.key] = el;
          }}
          id={`${idPrefix}-bill-${line.key}`}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          capture="environment"
          className="hidden"
          disabled={busy}
          onChange={(event) => {
            updateLine(line.key, {
              file: event.target.files?.[0] ?? null,
            });
          }}
        />
        {line.file ? (
          <div className="relative inline-flex max-w-full items-center">
            {isImage ? (
              <div className="relative size-11 shrink-0 rounded-lg border border-slate-200 bg-white shadow-xs">
                <div className="size-full overflow-hidden rounded-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrls[line.key]}
                    alt={line.file.name}
                    className="size-full object-cover"
                  />
                </div>
              </div>
            ) : (
              <div
                className="inline-flex h-11 max-w-[11rem] items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/70 px-2.5 shadow-xs"
                title={line.file.name}
              >
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-blue-100 text-blue-700">
                  <FileText className="size-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-slate-800">
                    {kind === "pdf" ? t("shopBillPdf") : t("shopBillFile")}
                  </span>
                  <span className="block truncate text-[10px] text-slate-500">
                    {line.file.name}
                  </span>
                </span>
              </div>
            )}
            <button
              type="button"
              disabled={busy}
              aria-label={t("shopBillClear")}
              title={t("shopBillClear")}
              className="absolute -top-1.5 -right-1.5 z-10 flex size-5 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm hover:bg-slate-800"
              onClick={() => clearBill(line.key)}
            >
              <X className="size-3" aria-hidden />
            </button>
          </div>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="md"
            disabled={busy}
            className="h-11 min-h-11 shrink-0 rounded-lg"
            onClick={() => fileInputRefs.current[line.key]?.click()}
          >
            <Upload className="size-4" aria-hidden />
            {t("shopBillChoose")}
          </Button>
        )}
      </>
    );
    if (!showLabel) {
      return <div className="min-w-0">{control}</div>;
    }
    return (
      <FormField
        id={`${idPrefix}-bill-${line.key}`}
        label={t("shopBillPhoto")}
        hint={line.file ? undefined : t("shopBillPhotoHint")}
      >
        {control}
      </FormField>
    );
  }

  function renderRemove(line: ShopReceiveLine) {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-11 min-h-11 min-w-11 text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
        disabled={busy || lines.length <= 1}
        aria-label={t("removeShopLine")}
        onClick={() => removeLine(line.key)}
      >
        <Trash2 className="size-4" aria-hidden />
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name="shopLineCount" value={lines.length} />
      {lines.map((line, index) => (
        <span key={`shop-submit-${line.key}`} className="hidden">
          <input
            type="hidden"
            name={`shopVendorId_${index}`}
            value={line.vendorId}
          />
          <input
            type="hidden"
            name={`shopQty_${index}`}
            value={Number.isFinite(line.quantity) ? line.quantity : 0}
          />
        </span>
      ))}

      <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
            {t("boughtFrom")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("boughtFromMultiHint")}
          </p>
        </div>
        <button
          type="button"
          className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-1.5 rounded-xl border border-dashed border-blue-300 bg-blue-50/60 px-3 text-sm font-medium text-blue-700 hover:bg-blue-50 sm:w-auto"
          disabled={busy}
          onClick={addLine}
        >
          <Plus className="size-4" strokeWidth={2.5} aria-hidden />
          {t("addAnotherPurchaseLine")}
        </button>
      </div>

      <ul className="space-y-3 md:hidden">
        {lines.map((line, index) => {
          const highlighted = highlightedLineKey === line.key;
          return (
            <li
              key={line.key}
              ref={(el) => {
                rowRefs.current[line.key] = el;
              }}
              className={cn(
                "scroll-mb-28 rounded-xl border bg-card p-3.5 shadow-xs",
                vendorErrorKeys.includes(line.key)
                  ? "border-red-300 ring-1 ring-red-200"
                  : highlighted
                    ? "border-blue-400 ring-2 ring-blue-200"
                    : "border-border",
              )}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-800">
                  {t("shopLineLabel", { number: index + 1 })}
                  {highlighted ? (
                    <span className="ml-2 text-xs font-medium text-blue-700">
                      {t("shopNewRowHint")}
                    </span>
                  ) : null}
                </span>
                {renderRemove(line)}
              </div>
              <div className="space-y-3">
                {renderVendorSelect(line, true)}
                {renderQty(line, true)}
                {renderBill(line, true)}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="hidden rounded-xl border border-border md:block">
        <Table className="overflow-visible">
          <TableHeader className="rounded-t-xl bg-slate-100 [&_tr]:border-border">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 rounded-tl-xl text-slate-700">
                #
              </TableHead>
              <TableHead className="min-w-[14rem] text-slate-700">
                {t("vendor")}
              </TableHead>
              <TableHead className="w-40 text-slate-700">
                {t("qtyFromShop")}
              </TableHead>
              <TableHead className="min-w-[8rem] text-slate-700">
                {t("shopBillPhoto")}
              </TableHead>
              <TableHead className="w-[1%] rounded-tr-xl text-right text-slate-700">
                <span className="sr-only">{t("removeShopLine")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line, index) => {
              const highlighted = highlightedLineKey === line.key;
              const hasError = vendorErrorKeys.includes(line.key);
              const isLast = index === lines.length - 1;
              return (
                <TableRow
                  key={line.key}
                  ref={(el) => {
                    rowRefs.current[line.key] = el;
                  }}
                  className={cn(
                    "scroll-mb-28",
                    hasError && "bg-red-50/50",
                    highlighted && !hasError && "bg-blue-50",
                    highlighted &&
                      !hasError &&
                      "border-l-4 border-l-blue-500",
                  )}
                >
                  <TableCell
                    className={cn(
                      "align-middle py-2.5 tabular-nums text-slate-600",
                      isLast && "rounded-bl-xl",
                    )}
                  >
                    {index + 1}
                  </TableCell>
                  <TableCell className="align-middle whitespace-normal py-2.5">
                    {renderVendorSelect(line, false)}
                  </TableCell>
                  <TableCell className="align-middle whitespace-normal py-2.5">
                    {renderQty(line, false)}
                  </TableCell>
                  <TableCell className="align-middle whitespace-normal py-2.5">
                    {renderBill(line, false)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "align-middle py-2.5 text-right",
                      isLast && "rounded-br-xl",
                    )}
                  >
                    {renderRemove(line)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function createEmptyShopReceiveLines(): ShopReceiveLine[] {
  return [newLine()];
}

export function shopReceiveFilesForUpload(
  lines: ShopReceiveLine[],
): Array<File | null> {
  return filesForUpload(lines);
}
