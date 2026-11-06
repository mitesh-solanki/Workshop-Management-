"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { usePageDetailLabel } from "@/components/page-chrome";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ListFiltersResetButton } from "@/components/ui/list-filters-reset-button";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { sanitizeCsvFilename } from "@/lib/csv";
import { formatRupees, type Paise } from "@/lib/money";
import {
  buildGstExportCsv,
  filterSelectedGstExportRows,
  gstExportFilename,
  type GstExportInvoiceRow,
} from "@/modules/invoices/gst-export";
import { MonthYearPicker } from "@/modules/payroll/components/month-year-picker";

type Props = {
  yearMonth: string;
  invoices: GstExportInvoiceRow[];
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

function matchesSearch(invoice: GstExportInvoiceRow, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    invoice.customerName.toLowerCase().includes(q) ||
    (invoice.customerGstin?.toLowerCase().includes(q) ?? false)
  );
}

export function GstExportPanel({ yearMonth, invoices }: Props) {
  const t = useTranslations("invoices");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [pendingMonth, startMonthTransition] = useTransition();
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState("");
  const invoiceIdsKey = invoices.map((row) => row.id).join(",");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(invoices.map((row) => row.id)),
  );
  const [selectionSourceKey, setSelectionSourceKey] = useState(invoiceIdsKey);
  if (invoiceIdsKey !== selectionSourceKey) {
    setSelectionSourceKey(invoiceIdsKey);
    setSelectedIds(new Set(invoices.map((row) => row.id)));
  }

  usePageDetailLabel(t("gstExport.detailLabel"));

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

  const filteredInvoices = useMemo(
    () => invoices.filter((invoice) => matchesSearch(invoice, search)),
    [invoices, search],
  );

  const filteredSelectedCount = filteredInvoices.filter((invoice) =>
    selectedIds.has(invoice.id),
  ).length;
  const allFilteredSelected =
    filteredInvoices.length > 0 &&
    filteredSelectedCount === filteredInvoices.length;
  const someFilteredSelected =
    filteredSelectedCount > 0 &&
    filteredSelectedCount < filteredInvoices.length;

  const toggleAllFiltered = useCallback(
    (checked: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const invoice of filteredInvoices) {
          if (checked) next.add(invoice.id);
          else next.delete(invoice.id);
        }
        return next;
      });
    },
    [filteredInvoices],
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
      router.replace(`/invoices/export-gst?${params.toString()}`);
    });
  }

  function onDownload() {
    if (exporting || selectedIds.size === 0) {
      toast.error(t("gstExport.noneSelected"));
      return;
    }
    setExporting(true);
    try {
      const rows = filterSelectedGstExportRows(
        invoices,
        Array.from(selectedIds),
      );
      if (rows.length === 0) {
        toast.error(t("gstExport.noneSelected"));
        return;
      }
      const csv = buildGstExportCsv(rows);
      downloadCsv(gstExportFilename(yearMonth), csv);
      toast.success(t("gstExport.success", { count: rows.length }));
    } finally {
      setExporting(false);
    }
  }

  const columns = useMemo<ColumnDef<GstExportInvoiceRow>[]>(
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
            aria-label={t("gstExport.selectAll")}
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
            aria-label={t("gstExport.selectRow", {
              number: row.original.invoiceNumber,
            })}
            className="size-5"
          />
        ),
      },
      {
        accessorKey: "finalizedAt",
        header: t("gstExport.columns.date"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {dateFmt.format(new Date(row.original.finalizedAt))}
          </span>
        ),
      },
      {
        accessorKey: "customerName",
        header: t("gstExport.columns.customer"),
        cell: ({ row }) => (
          <span className="truncate font-medium text-foreground">
            {row.original.customerName}
          </span>
        ),
      },
      {
        accessorKey: "customerGstin",
        header: t("gstExport.columns.gstin"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums text-muted-foreground">
            {row.original.customerGstin?.trim() || "—"}
          </span>
        ),
      },
      {
        accessorKey: "taxablePaise",
        header: t("gstExport.columns.taxable"),
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums whitespace-nowrap text-foreground">
            {formatRupees(row.original.taxablePaise as Paise, locale)}
          </span>
        ),
      },
      {
        accessorKey: "cgstPaise",
        header: t("gstExport.columns.cgst"),
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums whitespace-nowrap text-foreground">
            {formatRupees(row.original.cgstPaise as Paise, locale)}
          </span>
        ),
      },
      {
        accessorKey: "sgstPaise",
        header: t("gstExport.columns.sgst"),
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums whitespace-nowrap text-foreground">
            {formatRupees(row.original.sgstPaise as Paise, locale)}
          </span>
        ),
      },
      {
        accessorKey: "igstPaise",
        header: t("gstExport.columns.igst"),
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums whitespace-nowrap text-foreground">
            {formatRupees(row.original.igstPaise as Paise, locale)}
          </span>
        ),
      },
      {
        accessorKey: "totalPaise",
        header: t("gstExport.columns.total"),
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
    ],
  );

  const filtersActive = search.trim().length > 0;

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title={t("gstExport.title")}
        description={t("gstExport.subtitle")}
        actions={
          <>
            <Button asChild variant="outline" size="sm" className="min-h-11">
              <Link href="/invoices">{t("gstExport.back")}</Link>
            </Button>
            <Button
              type="button"
              size="sm"
              className="min-h-11"
              disabled={exporting || selectedIds.size === 0}
              onClick={onDownload}
            >
              <Download className="size-4" aria-hidden />
              {exporting ? t("gstExport.downloading") : t("gstExport.download")}
            </Button>
          </>
        }
      />

      <DataTable
        columns={columns}
        data={filteredInvoices}
        defaultPageSize={50}
        toolbar={
          <div className="flex w-full flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <SearchInput
              id="gst-export-search"
              className="w-full md:max-w-md"
              value={search}
              onValueChange={setSearch}
              label={t("gstExport.searchLabel")}
              placeholder={t("gstExport.searchPlaceholder")}
            />
            <div className="flex flex-wrap items-center justify-end gap-2">
              <p className="text-sm text-muted-foreground">
                {t("gstExport.selectedCount", {
                  selected: selectedIds.size,
                  total: invoices.length,
                })}
              </p>
              <MonthYearPicker
                yearMonth={yearMonth}
                disabled={pendingMonth || exporting}
                onChange={onMonthChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11"
                disabled={
                  pendingMonth || exporting || filteredInvoices.length === 0
                }
                onClick={() => toggleAllFiltered(!allFilteredSelected)}
              >
                {allFilteredSelected
                  ? t("gstExport.deselectAll")
                  : t("gstExport.selectAll")}
              </Button>
              <ListFiltersResetButton
                label={tc("resetFilters")}
                disabled={!filtersActive || pendingMonth}
                onReset={() => setSearch("")}
              />
            </div>
          </div>
        }
        empty={
          <EmptyState
            icon={FileSpreadsheet}
            title={
              filtersActive
                ? t("gstExport.emptySearchTitle")
                : t("gstExport.emptyTitle")
            }
            description={
              filtersActive
                ? t("gstExport.emptySearchDescription")
                : t("gstExport.emptyDescription")
            }
          />
        }
        renderMobileCard={(row) => {
          const invoice = row.original;
          const checked = selectedIds.has(invoice.id);
          return (
            <div className="flex gap-3">
              <Checkbox
                checked={checked}
                onCheckedChange={(value) =>
                  toggleOne(invoice.id, value === true)
                }
                aria-label={t("gstExport.selectRow", {
                  number: invoice.invoiceNumber,
                })}
                className="mt-1 size-5 shrink-0"
              />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                      {invoice.customerName}
                    </p>
                    <p className="text-caption text-muted-foreground">
                      {dateFmt.format(new Date(invoice.finalizedAt))}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold tabular-nums text-foreground">
                    {formatRupees(invoice.totalPaise as Paise, locale)}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("gstExport.columns.gstin")}:{" "}
                  {invoice.customerGstin?.trim() || "—"}
                </p>
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 px-3 py-2.5 text-sm">
                  <div>
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {t("gstExport.columns.taxable")}
                    </p>
                    <p className="mt-0.5 font-semibold tabular-nums text-foreground">
                      {formatRupees(invoice.taxablePaise as Paise, locale)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {t("gstExport.columns.cgst")}
                    </p>
                    <p className="mt-0.5 font-semibold tabular-nums text-foreground">
                      {formatRupees(invoice.cgstPaise as Paise, locale)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {t("gstExport.columns.sgst")}
                    </p>
                    <p className="mt-0.5 font-semibold tabular-nums text-foreground">
                      {formatRupees(invoice.sgstPaise as Paise, locale)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {t("gstExport.columns.igst")}
                    </p>
                    <p className="mt-0.5 font-semibold tabular-nums text-foreground">
                      {formatRupees(invoice.igstPaise as Paise, locale)}
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
