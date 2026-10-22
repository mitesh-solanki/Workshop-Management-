import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DataTableColumn<T> = {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  /** Hide this column on narrow tables (still available in mobileCard). */
  hideOnMobile?: boolean;
};

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  /** Card layout below `lg` — required for usable phone lists. */
  mobileCard: (row: T) => ReactNode;
  empty?: ReactNode;
  className?: string;
};

/**
 * Usage:
 * <DataTable
 *   columns={[{ id: "name", header: "Name", cell: (r) => r.name }]}
 *   rows={rows}
 *   getRowKey={(r) => r.id}
 *   mobileCard={(r) => <Card>…</Card>}
 * />
 * Desktop table; mobile card list. No horizontal scroll at 360px.
 */
function DataTable<T>({
  columns,
  rows,
  getRowKey,
  mobileCard,
  empty,
  className,
}: DataTableProps<T>) {
  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  return (
    <div className={cn("w-full", className)}>
      <ul className="space-y-3 lg:hidden">
        {rows.map((row) => (
          <li key={getRowKey(row)}>{mobileCard(row)}</li>
        ))}
      </ul>

      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-card shadow-sm lg:block">
        <table className="w-full min-w-0 border-collapse text-left text-body">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.id}
                  scope="col"
                  className={cn(
                    "px-4 py-3 text-caption font-semibold tracking-wide text-slate-500 uppercase",
                    col.className,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={getRowKey(row)}
                className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80"
              >
                {columns.map((col) => (
                  <td
                    key={col.id}
                    className={cn("px-4 py-3 text-slate-900", col.className)}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export { DataTable };
