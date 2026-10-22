"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type Row,
  type Updater,
} from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50] as const;
const DEFAULT_PAGE_SIZE = 10;

export type DataTablePagination = {
  /** 0-based page index from the server. */
  pageIndex: number;
  pageSize: number;
  /** Total matching rows (server). */
  rowCount: number;
};

type ColumnMeta = {
  /** Applied to header + cell (e.g. actions: hug content). */
  className?: string;
};

type DataTableProps<TData, TValue = unknown> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  empty?: React.ReactNode;
  className?: string;
  /** Filter / search controls — rendered in the top bar inside the border. */
  toolbar?: React.ReactNode;
  /**
   * Server pagination (URL `page` + `pageSize`).
   * Omit for client-side pagination of the full `data` array.
   */
  pagination?: DataTablePagination;
  /** Initial page size for client-side mode. */
  defaultPageSize?: number;
  /** When set, clicking a row navigates here. Use `data-row-stop` to opt out. */
  getRowHref?: (row: TData) => string;
  /**
   * Mobile card layout (< md). Desktop table stays unchanged.
   * When set, table is `hidden md:block` and cards show on small screens.
   */
  renderMobileCard?: (row: Row<TData>) => React.ReactNode;
};

/**
 * Single bordered shell: toolbar → table/cards → pagination.
 * Inspired by shadcn dashboard-01 blocks.
 */
function DataTable<TData, TValue = unknown>({
  columns,
  data,
  empty,
  className,
  toolbar,
  pagination: serverPagination,
  defaultPageSize = DEFAULT_PAGE_SIZE,
  getRowHref,
  renderMobileCard,
}: DataTableProps<TData, TValue>) {
  const t = useTranslations("table");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const manual = Boolean(serverPagination);

  const [clientPagination, setClientPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: defaultPageSize,
  });

  const pagination = manual
    ? {
        pageIndex: serverPagination!.pageIndex,
        pageSize: serverPagination!.pageSize,
      }
    : clientPagination;

  const pageCount = useMemo(() => {
    if (!manual || !serverPagination) return undefined;
    const size = Math.max(1, serverPagination.pageSize);
    return Math.max(1, Math.ceil(serverPagination.rowCount / size) || 1);
  }, [manual, serverPagination]);

  function pushServerPagination(next: PaginationState) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(next.pageIndex + 1));
    params.set("pageSize", String(next.pageSize));
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function onPaginationChange(updater: Updater<PaginationState>) {
    const next = typeof updater === "function" ? updater(pagination) : updater;
    if (manual) {
      pushServerPagination(next);
      return;
    }
    setClientPagination(next);
  }

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onPaginationChange,
    state: { pagination },
    ...(manual
      ? {
          manualPagination: true as const,
          pageCount,
          rowCount: serverPagination!.rowCount,
        }
      : {
          getPaginationRowModel: getPaginationRowModel(),
        }),
  });

  const rows = table.getRowModel().rows;
  const isEmpty = data.length === 0;

  if (isEmpty && empty && !toolbar) {
    return <>{empty}</>;
  }

  const currentPage = pagination.pageIndex + 1;
  const totalPages = Math.max(table.getPageCount(), 1);
  const pageSize = pagination.pageSize;
  const rowCount = manual ? serverPagination!.rowCount : data.length;
  const from = rowCount === 0 ? 0 : pagination.pageIndex * pageSize + 1;
  const to = Math.min(pagination.pageIndex * pageSize + rows.length, rowCount);

  function columnClassName(columnDef: ColumnDef<TData, TValue>) {
    return (columnDef.meta as ColumnMeta | undefined)?.className;
  }

  function onRowActivate(row: TData, event: React.MouseEvent | React.KeyboardEvent) {
    const href = getRowHref?.(row);
    if (!href) return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-row-stop]")) return;
    if (
      target.closest(
        "a, button, input, select, textarea, [role='menuitem']",
      )
    ) {
      return;
    }
    router.push(href);
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card shadow-sm",
        className,
      )}
    >
      {toolbar ? (
        <div className="border-b border-border p-3 sm:px-4">{toolbar}</div>
      ) : null}

      {isEmpty && empty ? (
        <div className="p-4">{empty}</div>
      ) : (
        <>
          {renderMobileCard ? (
            <div className="space-y-3 bg-muted/30 p-3 md:hidden">
              {rows.length > 0 ? (
                rows.map((row) => {
                  const href = getRowHref?.(row.original);
                  return (
                    <div
                      key={row.id}
                      role={href ? "link" : undefined}
                      tabIndex={href ? 0 : undefined}
                      className={cn(
                        "rounded-xl border border-border bg-card p-4 shadow-sm",
                        href &&
                          "cursor-pointer transition-colors active:bg-muted/40",
                      )}
                      onClick={
                        href
                          ? (event) => onRowActivate(row.original, event)
                          : undefined
                      }
                      onKeyDown={
                        href
                          ? (event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                onRowActivate(row.original, event);
                              }
                            }
                          : undefined
                      }
                    >
                      {renderMobileCard(row)}
                    </div>
                  );
                })
              ) : (
                <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                  {t("noResults")}
                </p>
              )}
            </div>
          ) : null}

          <div className={cn(renderMobileCard && "hidden md:block")}>
            <Table>
              <TableHeader className="bg-muted/60">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className="hover:bg-transparent"
                  >
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        colSpan={header.colSpan}
                        className={columnClassName(header.column.columnDef)}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {rows.length > 0 ? (
                  rows.map((row) => {
                    const href = getRowHref?.(row.original);
                    return (
                      <TableRow
                        key={row.id}
                        className={href ? "cursor-pointer" : undefined}
                        onClick={
                          href
                            ? (event) => onRowActivate(row.original, event)
                            : undefined
                        }
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell
                            key={cell.id}
                            className={columnClassName(cell.column.columnDef)}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {t("noResults")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {!isEmpty || !empty ? (
        <div className="flex flex-col gap-3 border-t border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <p className="text-sm text-muted-foreground">
            {t("showing", { from, to, total: rowCount })}
          </p>

          <div className="flex w-full items-center justify-between gap-3 sm:w-fit sm:justify-start sm:gap-4 lg:gap-6">
            <p className="text-sm font-medium tabular-nums">
              {t("pageOf", { page: currentPage, pages: totalPages })}
            </p>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="hidden size-8 lg:flex"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
                aria-label={t("firstPage")}
              >
                <ChevronsLeft className="size-4" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="size-8"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                aria-label={t("previousPage")}
              >
                <ChevronLeft className="size-4" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="size-8"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                aria-label={t("nextPage")}
              >
                <ChevronRight className="size-4" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="hidden size-8 lg:flex"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
                aria-label={t("lastPage")}
              >
                <ChevronsRight className="size-4" aria-hidden />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { DataTable, DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS };
export type { ColumnDef };
