"use client";

import { useSyncExternalStore } from "react";
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
import { formatRupees } from "@/lib/money";
import { cn } from "@/lib/utils";

const MD_BREAKPOINT = 768;
const qtyColClass = "w-[9.5rem] min-w-[9.5rem] max-w-[9.5rem]";
const priceColClass = "w-36 min-w-36 max-w-36";
const subtotalColClass = "w-28 min-w-28 max-w-28";
const typeColClass = "w-24 min-w-24 max-w-24";
const warrantyColClass = "w-[9.5rem] min-w-[9.5rem] max-w-[9.5rem]";

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

export type PricingTableLine = {
  id: string;
  description: string;
  quantity: number;
  unitPricePaise: number;
  totalPaise: number;
  type?: "LABOUR" | "PART" | string;
  typeLabel?: string;
};

export type PricingLineWarrantyInfo = {
  label: string | null;
  required: boolean;
  incomplete: boolean;
  hasCard: boolean;
  photoUrl: string | null;
};

export type PricingLinesWarrantyProps = {
  byLineId: Record<string, PricingLineWarrantyInfo>;
  canEdit: boolean;
  columnLabel: string;
  addLabel: string;
  editLabel: string;
  viewCardLabel: string;
  savingLabel: string;
  savingLineId: string | null;
  onOpen: (lineId: string) => void;
};

type Props = {
  lines: PricingTableLine[];
  showType?: boolean;
  emptyLabel?: string;
  className?: string;
  warranty?: PricingLinesWarrantyProps;
};

function DescriptionWithWarrantyLabel({
  description,
  label,
  incomplete,
}: {
  description: string;
  label: string | null;
  incomplete?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <span className="truncate font-medium text-slate-900">{description}</span>
      {label ? (
        <span
          className={cn(
            "inline-flex max-w-full items-center text-[12px] font-medium",
            incomplete ? "text-amber-800" : "text-slate-600",
          )}
        >
          ({label})
        </span>
      ) : null}
    </div>
  );
}

function WarrantyActionCell({
  lineId,
  typeKey,
  warranty,
}: {
  lineId: string;
  typeKey: "LABOUR" | "PART" | null;
  warranty: PricingLinesWarrantyProps;
}) {
  if (typeKey !== "PART") {
    return (
      <span className="inline-flex h-11 min-h-11 w-full items-center justify-center text-slate-400">
        —
      </span>
    );
  }

  const info = warranty.byLineId[lineId];
  if (!info) {
    return (
      <span className="inline-flex h-11 min-h-11 w-full items-center justify-center text-slate-400">
        —
      </span>
    );
  }

  if (!warranty.canEdit) {
    if (info.photoUrl) {
      return (
        <a
          href={info.photoUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 min-h-11 items-center text-[12px] font-medium text-blue-700 underline-offset-2 hover:underline"
        >
          {warranty.viewCardLabel}
        </a>
      );
    }
    return (
      <span className="inline-flex h-11 min-h-11 w-full items-center justify-center text-slate-400">
        —
      </span>
    );
  }

  const saving = warranty.savingLineId === lineId;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={saving}
      className={cn(
        "h-9 min-h-9 w-full max-w-34 px-2 text-[12px]",
        info.incomplete && !saving && "border-amber-300 text-amber-900",
      )}
      onClick={() => {
        if (saving) return;
        warranty.onOpen(lineId);
      }}
    >
      {saving
        ? warranty.savingLabel
        : info.hasCard
          ? warranty.editLabel
          : warranty.addLabel}
    </Button>
  );
}

export function PricingLinesTable({
  lines,
  showType = false,
  emptyLabel,
  className,
  warranty,
}: Props) {
  const tb = useTranslations("billing");
  const te = useTranslations("estimates");
  const to = useTranslations("orders");
  const isMobile = useIsMdDown();
  const showWarrantyCol = Boolean(warranty);

  if (lines.length === 0) {
    return (
      <p className="px-4 py-3 text-sm text-slate-600">
        {emptyLabel ?? tb("invoiceEmpty")}
      </p>
    );
  }

  if (isMobile) {
    return (
      <ul
        className={cn(
          "divide-y divide-slate-100 overflow-hidden bg-white",
          className,
        )}
      >
        {lines.map((line) => {
          const typeKey =
            line.type === "PART" || line.type === "LABOUR" ? line.type : null;
          const typeText =
            typeKey != null
              ? te(`lineTypes.${typeKey}`)
              : (line.typeLabel ?? null);
          const info =
            typeKey === "PART" && warranty
              ? warranty.byLineId[line.id]
              : undefined;
          return (
            <li
              key={line.id}
              className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex min-w-0 flex-wrap items-start gap-2">
                  {showType && typeText ? (
                    <span
                      className={cn(
                        "mt-0.5 inline-flex shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                        typeKey === "PART"
                          ? "border-blue-200 bg-blue-50 text-blue-800"
                          : "border-orange-200 bg-orange-50 text-orange-800",
                      )}
                    >
                      {typeText}
                    </span>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <DescriptionWithWarrantyLabel
                      description={line.description}
                      label={info?.label ?? null}
                      incomplete={info?.incomplete}
                    />
                  </div>
                </div>
                {showWarrantyCol && warranty && typeKey === "PART" ? (
                  <WarrantyActionCell
                    lineId={line.id}
                    typeKey={typeKey}
                    warranty={warranty}
                  />
                ) : null}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[12px] tabular-nums text-slate-500">
                  {typeKey === "LABOUR"
                    ? formatRupees(line.unitPricePaise)
                    : `${line.quantity} × ${formatRupees(line.unitPricePaise)}`}
                </p>
                <p className="text-[14px] font-semibold tabular-nums text-slate-900">
                  {formatRupees(line.totalPaise)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className={cn("overflow-hidden", className)}>
      <Table className="table-fixed">
        <TableHeader className="bg-slate-100 [&_tr]:border-border">
          <TableRow className="hover:bg-transparent">
            {showType ? (
              <TableHead className={cn(typeColClass, "text-slate-700")}>
                {te("lineType")}
              </TableHead>
            ) : null}
            <TableHead className="min-w-0 text-slate-700">
              {te("lineDescription")}
            </TableHead>
            {showWarrantyCol && warranty ? (
              <TableHead
                className={cn(
                  warrantyColClass,
                  "whitespace-nowrap text-center text-slate-700",
                )}
              >
                {warranty.columnLabel}
              </TableHead>
            ) : null}
            <TableHead
              className={cn(
                qtyColClass,
                "whitespace-nowrap text-center text-slate-700",
              )}
            >
              {te("quantity")}
            </TableHead>
            <TableHead className={cn(priceColClass, "text-slate-700")}>
              {te("unitPrice")}
            </TableHead>
            <TableHead className={cn(subtotalColClass, "text-slate-700")}>
              {to("lineSubtotal")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line) => {
            const typeKey =
              line.type === "PART" || line.type === "LABOUR"
                ? line.type
                : null;
            const typeText =
              typeKey != null
                ? te(`lineTypes.${typeKey}`)
                : (line.typeLabel ?? null);
            const info =
              typeKey === "PART" && warranty
                ? warranty.byLineId[line.id]
                : undefined;
            return (
              <TableRow key={line.id}>
                {showType ? (
                  <TableCell className={cn(typeColClass, "whitespace-nowrap")}>
                    {typeText ? (
                      <span
                        className={cn(
                          "inline-flex w-max rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                          typeKey === "PART"
                            ? "border-blue-200 bg-blue-50 text-blue-800"
                            : "border-orange-200 bg-orange-50 text-orange-800",
                        )}
                      >
                        {typeText}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                ) : null}
                <TableCell className="min-w-0 max-w-0 whitespace-normal">
                  <DescriptionWithWarrantyLabel
                    description={line.description}
                    label={info?.label ?? null}
                    incomplete={info?.incomplete}
                  />
                </TableCell>
                {showWarrantyCol && warranty ? (
                  <TableCell
                    className={cn(warrantyColClass, "text-center align-middle")}
                  >
                    <WarrantyActionCell
                      lineId={line.id}
                      typeKey={typeKey}
                      warranty={warranty}
                    />
                  </TableCell>
                ) : null}
                <TableCell
                  className={cn(
                    qtyColClass,
                    "text-center tabular-nums text-slate-800",
                  )}
                >
                  <span className="inline-flex h-11 min-h-11 w-full items-center justify-center">
                    {typeKey === "LABOUR" ? "—" : line.quantity}
                  </span>
                </TableCell>
                <TableCell
                  className={cn(priceColClass, "tabular-nums text-slate-800")}
                >
                  <span className="inline-flex h-11 min-h-11 items-center">
                    {formatRupees(line.unitPricePaise)}
                  </span>
                </TableCell>
                <TableCell
                  className={cn(
                    subtotalColClass,
                    "font-semibold tabular-nums text-slate-950",
                  )}
                >
                  <span className="inline-flex h-11 min-h-11 items-center">
                    {formatRupees(line.totalPaise)}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
