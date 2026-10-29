"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRupees } from "@/lib/money";
import { cn } from "@/lib/utils";
import { EstimatePermissionLine } from "@/modules/estimates/components/estimate-permission-line";
import type { EstimateApprovalStateValue } from "@/modules/estimates/schema";

const MD_BREAKPOINT = 768;

const qtyColClass = "w-16 min-w-16 max-w-16";
const typeColClass = "w-[4.5rem] min-w-[4.5rem] max-w-[4.5rem]";
const priceColClass = "w-[6.5rem] min-w-[6.5rem] max-w-[6.5rem]";
const subtotalColClass = "w-[6.5rem] min-w-[6.5rem] max-w-[6.5rem]";
const statusColClass = "w-[16.5rem] min-w-[16.5rem] max-w-[16.5rem]";
const actionsColClass = "w-[5.5rem] min-w-[5.5rem] max-w-[5.5rem]";
const descColClass = "w-44 min-w-0 max-w-44";

function useIsMdDown() {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(`(max-width: ${MD_BREAKPOINT - 1}px)`);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.innerWidth < MD_BREAKPOINT,
    () => false,
  );
}

export type EstimateTableLine = {
  id: string;
  description: string;
  type: string;
  quantity: number;
  unitPricePaise: number;
  hsnOrSac: string | null;
  gstRatePercent: number;
  approvalState: EstimateApprovalStateValue;
  totalPaise: number;
  partId?: string | null;
};

type Props = {
  orderId: string;
  canEdit: boolean;
  askPermission: boolean;
  lines: EstimateTableLine[];
};

function TypeBadge({ type }: { type: string }) {
  const t = useTranslations("estimates");
  const typeKey = type === "PART" || type === "LABOUR" ? type : "LABOUR";
  return (
    <span
      className={cn(
        "inline-flex w-max rounded-md border px-2 py-0.5 text-[11px] font-semibold",
        typeKey === "PART"
          ? "border-blue-200 bg-blue-50 text-blue-800"
          : "border-orange-200 bg-orange-50 text-orange-800",
      )}
    >
      {t(`lineTypes.${typeKey}`)}
    </span>
  );
}

export function EstimateLinesTable({
  orderId,
  canEdit,
  askPermission,
  lines,
}: Props) {
  const t = useTranslations("estimates");
  const to = useTranslations("orders");
  const isMobile = useIsMdDown();

  if (lines.length === 0) {
    return <p className="text-sm text-slate-600">{t("linesEmpty")}</p>;
  }

  if (isMobile) {
    if (askPermission) {
      return (
        <ul className="grid gap-3">
          {lines.map((line, index) => (
            <EstimatePermissionLine
              key={line.id}
              orderId={orderId}
              canEdit={canEdit}
              index={index}
              line={line}
              layout="card"
            />
          ))}
        </ul>
      );
    }

    return (
      <ul className="divide-y divide-slate-200/80 overflow-hidden rounded-[10px] border border-slate-200 bg-white">
        {lines.map((line) => (
          <li
            key={line.id}
            className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-3"
          >
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <TypeBadge type={line.type} />
              <p className="min-w-0 truncate text-[14px] font-medium text-slate-900">
                {line.description}
              </p>
              <span className="inline-flex shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                {t("readyToBillBadge")}
              </span>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[12px] tabular-nums text-slate-500">
                {t("emptyPreviewQtyPrice", {
                  quantity: line.quantity,
                  price: formatRupees(line.unitPricePaise),
                })}
              </p>
              <p className="text-[14px] font-semibold tabular-nums text-slate-900">
                {formatRupees(line.totalPaise)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <Table className="table-fixed">
        <TableHeader className="bg-slate-100 [&_tr]:border-border">
          <TableRow className="hover:bg-transparent">
            <TableHead className={cn(typeColClass, "text-slate-700")}>
              {t("lineType")}
            </TableHead>
            <TableHead className={cn(descColClass, "text-slate-700")}>
              {t("lineDescription")}
            </TableHead>
            <TableHead
              className={cn(
                qtyColClass,
                "whitespace-nowrap text-center text-slate-700",
              )}
            >
              {t("quantity")}
            </TableHead>
            <TableHead className={cn(priceColClass, "text-slate-700")}>
              {t("unitPrice")}
            </TableHead>
            <TableHead className={cn(subtotalColClass, "text-slate-700")}>
              {to("lineSubtotal")}
            </TableHead>
            {askPermission ? (
              <TableHead className={cn(statusColClass, "text-slate-700")}>
                {t("approvalState")}
              </TableHead>
            ) : (
              <TableHead className={cn(statusColClass, "text-slate-700")}>
                {t("readyToBillBadge")}
              </TableHead>
            )}
            {askPermission && canEdit ? (
              <TableHead
                className={cn(actionsColClass, "text-right text-slate-700")}
              >
                {to("columns.actions")}
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {askPermission
            ? lines.map((line, index) => (
                <EstimatePermissionLine
                  key={line.id}
                  orderId={orderId}
                  canEdit={canEdit}
                  index={index}
                  line={line}
                  layout="table"
                />
              ))
            : lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell className={cn(typeColClass, "whitespace-nowrap")}>
                    <TypeBadge type={line.type} />
                  </TableCell>
                  <TableCell className={cn(descColClass, "whitespace-normal")}>
                    <span
                      className="block truncate font-medium text-slate-900"
                      title={line.description}
                    >
                      {line.description}
                    </span>
                  </TableCell>
                  <TableCell
                    className={cn(
                      qtyColClass,
                      "text-center tabular-nums text-slate-800",
                    )}
                  >
                    <span className="inline-flex h-10 min-h-10 w-full items-center justify-center">
                      {line.type === "PART" ? line.quantity : "—"}
                    </span>
                  </TableCell>
                  <TableCell
                    className={cn(priceColClass, "tabular-nums text-slate-800")}
                  >
                    <span className="inline-flex h-10 min-h-10 items-center">
                      {formatRupees(line.unitPricePaise)}
                    </span>
                  </TableCell>
                  <TableCell
                    className={cn(
                      subtotalColClass,
                      "font-semibold tabular-nums text-slate-950",
                    )}
                  >
                    <span className="inline-flex h-10 min-h-10 items-center">
                      {formatRupees(line.totalPaise)}
                    </span>
                  </TableCell>
                  <TableCell className={statusColClass}>
                    <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                      {t("readyToBillBadge")}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
        </TableBody>
      </Table>
    </div>
  );
}
