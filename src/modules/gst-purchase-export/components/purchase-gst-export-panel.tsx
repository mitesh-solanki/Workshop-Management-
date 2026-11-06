"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { usePageDetailLabel } from "@/components/page-chrome";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FormSelect } from "@/components/ui/form-select";
import { ListFiltersResetButton } from "@/components/ui/list-filters-reset-button";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { sanitizeCsvFilename } from "@/lib/csv";
import { formatRupees, type Paise } from "@/lib/money";
import {
  buildPurchaseGstExportCsv,
  filterSelectedPurchaseGstExportRows,
  PURCHASE_GST_EXPORT_TYPES,
  purchaseGstExportFilename,
  type PurchaseGstExportRow,
  type PurchaseGstExportType,
} from "@/modules/gst-purchase-export/purchase-gst-export";
import { MonthYearPicker } from "@/modules/payroll/components/month-year-picker";

type TypeFilter = "ALL" | PurchaseGstExportType;

type Props = {
  yearMonth: string;
  rows: PurchaseGstExportRow[];
};

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = sanitizeCsvFilename(filename);
  anchor.click();
  URL.revokeObjectURL(url);
}

function matchesSearch(
  row: PurchaseGstExportRow,
  query: string,
  typeLabel: (type: PurchaseGstExportType) => string,
) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    row.vendorName.toLowerCase().includes(q) ||
    (row.vendorGstin?.toLowerCase().includes(q) ?? false) ||
    typeLabel(row.type).toLowerCase().includes(q)
  );
}

export function PurchaseGstExportPanel({ yearMonth, rows }: Props) {
  const t = useTranslations("gstPurchaseExport");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [pendingMonth, startMonthTransition] = useTransition();
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const rowIdsKey = rows.map((row) => row.id).join(",");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(rows.map((row) => row.id)),
  );
  const [selectionSourceKey, setSelectionSourceKey] = useState(rowIdsKey);
  if (rowIdsKey !== selectionSourceKey) {
    setSelectionSourceKey(rowIdsKey);
    setSelectedIds(new Set(rows.map((row) => row.id)));
  }

  usePageDetailLabel(t("detailLabel"));

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }),
    [locale],
  );

  const typeLabel = useCallback(
    (type: PurchaseGstExportType) => {
      if (type === "PARTS") return t("types.parts");
      if (type === "OUTSIDE_WORK") return t("types.outsideWork");
      return t("types.expense");
    },
    [t],
  );

  const typeFilterOptions = useMemo(
    () => [
      { value: "ALL", label: t("typeFilterAll") },
      ...PURCHASE_GST_EXPORT_TYPES.map((type) => ({
        value: type,
        label: typeLabel(type),
      })),
    ],
    [t, typeLabel],
  );

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (typeFilter !== "ALL" && row.type !== typeFilter) return false;
        return matchesSearch(row, search, typeLabel);
      }),
    [rows, search, typeFilter, typeLabel],
  );

  const filteredSelectedCount = filteredRows.filter((row) =>
    selectedIds.has(row.id),
  ).length;
  const allFilteredSelected =
    filteredRows.length > 0 && filteredSelectedCount === filteredRows.length;
  const someFilteredSelected =
    filteredSelectedCount > 0 && filteredSelectedCount < filteredRows.length;

  const toggleAllFiltered = useCallback(
    (checked: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const row of filteredRows) {
          if (checked) next.add(row.id);
          else next.delete(row.id);
        }
        return next;
      });
    },
    [filteredRows],
  );

  const toggleOne = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  function onMonthChange(next: string) {
    startMonthTransition(() => {
      const params = new URLSearchParams();
      params.set("month", next);
      router.replace(`/purchases/export-gst?${params.toString()}`);
    });
  }

  function onDownload() {
    if (exporting || selectedIds.size === 0) {
      toast.error(t("noneSelected"));
      return;
    }
    setExporting(true);
    try {
      const selected = filterSelectedPurchaseGstExportRows(
        rows,
        Array.from(selectedIds),
      );
      if (selected.length === 0) {
        toast.error(t("noneSelected"));
        return;
      }
      const csv = buildPurchaseGstExportCsv(selected);
      downloadCsv(purchaseGstExportFilename(yearMonth), csv);
      toast.success(t("success", { count: selected.length }));
    } finally {
      setExporting(false);
    }
  }

  const columns = useMemo<ColumnDef<PurchaseGstExportRow>[]>(
    () => [
      {
        id: "select",
        header: () => (
          <Checkbox
            checked={
              allFilteredSelected
                ? true
                : someFilteredSelected
                  ? "indeterminate"
                  : false
            }
            onCheckedChange={(value) => toggleAllFiltered(value === true)}
            aria-label={t("selectAll")}
            className="size-5"
          />
        ),
        meta: { className: "w-12" },
        cell: ({ row }) => (
          <Checkbox
            checked={selectedIds.has(row.original.id)}
            onCheckedChange={(value) =>
              toggleOne(row.original.id, value === true)
            }
            aria-label={t("selectRow", { name: row.original.vendorName })}
            className="size-5"
          />
        ),
      },
      {
        accessorKey: "spentAt",
        header: t("columns.date"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {dateFmt.format(new Date(row.original.spentAt))}
          </span>
        ),
      },
      {
        accessorKey: "type",
        header: t("columns.type"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {typeLabel(row.original.type)}
          </span>
        ),
      },
      {
        accessorKey: "vendorName",
        header: t("columns.vendor"),
        cell: ({ row }) => (
          <span className="truncate font-medium text-foreground">
            {row.original.vendorName.trim() || "—"}
          </span>
        ),
      },
      {
        accessorKey: "vendorGstin",
        header: t("columns.gstin"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums text-muted-foreground">
            {row.original.vendorGstin?.trim() || "—"}
          </span>
        ),
      },
      {
        accessorKey: "taxablePaise",
        header: t("columns.taxable"),
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums whitespace-nowrap text-foreground">
            {formatRupees(row.original.taxablePaise as Paise, locale)}
          </span>
        ),
      },
      {
        accessorKey: "cgstPaise",
        header: t("columns.cgst"),
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums whitespace-nowrap text-foreground">
            {formatRupees(row.original.cgstPaise as Paise, locale)}
          </span>
        ),
      },
      {
        accessorKey: "sgstPaise",
        header: t("columns.sgst"),
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums whitespace-nowrap text-foreground">
            {formatRupees(row.original.sgstPaise as Paise, locale)}
          </span>
        ),
      },
      {
        accessorKey: "igstPaise",
        header: t("columns.igst"),
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums whitespace-nowrap text-foreground">
            {formatRupees(row.original.igstPaise as Paise, locale)}
          </span>
        ),
      },
      {
        accessorKey: "totalPaise",
        header: t("columns.total"),
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums whitespace-nowrap text-foreground">
            {formatRupees(row.original.totalPaise as Paise, locale)}
          </span>
        ),
      },
    ],
    [
      allFilteredSelected,
      dateFmt,
      locale,
      selectedIds,
      someFilteredSelected,
      t,
      toggleAllFiltered,
      toggleOne,
      typeLabel,
    ],
  );

  const filtersActive = search.trim().length > 0 || typeFilter !== "ALL";

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button
            type="button"
            size="sm"
            className="min-h-11"
            disabled={exporting || selectedIds.size === 0}
            onClick={onDownload}
          >
            <Download className="size-4" aria-hidden />
            {exporting ? t("downloading") : t("download")}
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={filteredRows}
        defaultPageSize={50}
        toolbar={
          <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <SearchInput
              id="purchase-gst-export-search"
              className="w-full lg:max-w-md"
              value={search}
              onValueChange={setSearch}
              label={t("searchLabel")}
              placeholder={t("searchPlaceholder")}
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              <p className="text-sm whitespace-nowrap text-muted-foreground sm:mr-1">
                {t("selectedCount", {
                  selected: selectedIds.size,
                  total: rows.length,
                })}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <MonthYearPicker
                  yearMonth={yearMonth}
                  disabled={pendingMonth || exporting}
                  onChange={onMonthChange}
                />
                <div className="w-fit shrink-0">
                  <FormSelect
                    id="purchase-gst-type-filter"
                    value={typeFilter}
                    onValueChange={(value) =>
                      setTypeFilter((value as TypeFilter) || "ALL")
                    }
                    options={typeFilterOptions}
                    selectedPrefix={t("typeFilterLabel")}
                    disabled={pendingMonth || exporting}
                    className="w-fit"
                    triggerClassName="h-11 min-h-11 w-auto min-w-36 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold shadow-xs"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-11"
                  disabled={
                    pendingMonth || exporting || filteredRows.length === 0
                  }
                  onClick={() => toggleAllFiltered(!allFilteredSelected)}
                >
                  {allFilteredSelected ? t("deselectAll") : t("selectAll")}
                </Button>
                <ListFiltersResetButton
                  label={tc("resetFilters")}
                  disabled={!filtersActive || pendingMonth}
                  onReset={() => {
                    setSearch("");
                    setTypeFilter("ALL");
                  }}
                />
              </div>
            </div>
          </div>
        }
        empty={
          <EmptyState
            icon={FileSpreadsheet}
            title={
              filtersActive ? t("emptySearchTitle") : t("emptyTitle")
            }
            description={
              filtersActive
                ? t("emptySearchDescription")
                : t("emptyDescription")
            }
          />
        }
        renderMobileCard={(row) => {
          const item = row.original;
          const checked = selectedIds.has(item.id);
          return (
            <div className="flex gap-3">
              <Checkbox
                checked={checked}
                onCheckedChange={(value) =>
                  toggleOne(item.id, value === true)
                }
                aria-label={t("selectRow", { name: item.vendorName })}
                className="mt-1 size-5 shrink-0"
              />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                      {item.vendorName}
                    </p>
                    <p className="text-caption text-muted-foreground">
                      {typeLabel(item.type)} ·{" "}
                      {dateFmt.format(new Date(item.spentAt))}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold tabular-nums text-foreground">
                    {formatRupees(item.totalPaise as Paise, locale)}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("columns.gstin")}: {item.vendorGstin?.trim() || "—"}
                </p>
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 px-3 py-2.5 text-sm">
                  <div>
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {t("columns.taxable")}
                    </p>
                    <p className="mt-0.5 font-semibold tabular-nums text-foreground">
                      {formatRupees(item.taxablePaise as Paise, locale)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {t("columns.cgst")}
                    </p>
                    <p className="mt-0.5 font-semibold tabular-nums text-foreground">
                      {formatRupees(item.cgstPaise as Paise, locale)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {t("columns.sgst")}
                    </p>
                    <p className="mt-0.5 font-semibold tabular-nums text-foreground">
                      {formatRupees(item.sgstPaise as Paise, locale)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {t("columns.igst")}
                    </p>
                    <p className="mt-0.5 font-semibold tabular-nums text-foreground">
                      {formatRupees(item.igstPaise as Paise, locale)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        }}
      />
    </div>
  );
}
