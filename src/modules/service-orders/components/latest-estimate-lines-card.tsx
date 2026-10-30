"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { SmoothAccordion } from "@/components/ui/smooth-accordion";
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

export type LatestEstimateLine = {
  id: string;
  type: "LABOUR" | "PART";
  description: string;
  quantity: number;
  unitPricePaise: number;
  approvalState: "PENDING" | "APPROVED" | "REJECTED";
};

type Props = {
  lines: LatestEstimateLine[];
  hidePrices?: boolean;
  defaultOpen?: boolean;
};

export function LatestEstimateLinesCard({
  lines,
  hidePrices = false,
  defaultOpen = true,
}: Props) {
  const t = useTranslations("orders");
  const locale = useLocale();
  const [open, setOpen] = useState(defaultOpen);

  const approvedLines = useMemo(
    () => lines.filter((line) => line.approvalState === "APPROVED"),
    [lines],
  );

  if (approvedLines.length === 0) return null;

  return (
    <div className="w-full max-w-3xl overflow-hidden rounded-[13px] border border-blue-200">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 bg-blue-50 px-4 py-3 text-left"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="min-w-0">
          <span className="block text-[14px] font-semibold text-blue-950">
            {t("latestEstimateTitle")}
          </span>
          <span className="mt-0.5 block text-[13px] font-medium text-blue-900/75">
            {t("latestEstimateHint")}
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-blue-900/80">
          {t("latestEstimateCount", { count: approvedLines.length })}
          <ChevronDown
            className={cn(
              "size-4 transition-transform duration-300",
              open && "rotate-180",
            )}
          />
        </span>
      </button>
      <SmoothAccordion open={open}>
        <div className="border-t border-slate-300 bg-white">
          <Table>
            <TableHeader className="bg-slate-100 [&_tr]:border-border">
              <TableRow>
                <TableHead className="text-left">{t("lineDescription")}</TableHead>
                <TableHead className="w-[88px] text-center">
                  {t("quantity")}
                </TableHead>
                {!hidePrices ? (
                  <TableHead className="w-[110px] text-center">
                    {t("unitPrice")}
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {approvedLines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="min-w-0 whitespace-normal align-middle text-left text-[14px] font-medium text-slate-900">
                    {line.description}
                  </TableCell>
                  <TableCell className="align-middle text-center tabular-nums text-slate-700">
                    {line.quantity}
                  </TableCell>
                  {!hidePrices ? (
                    <TableCell className="align-middle text-center text-[14px] font-bold tabular-nums text-slate-900">
                      {formatRupees(line.unitPricePaise, locale)}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SmoothAccordion>
    </div>
  );
}
