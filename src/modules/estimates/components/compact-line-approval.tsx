"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  saveInspectionEstimateLineAction,
  savePermissionLineAction,
} from "@/app/actions/estimates";
import { toast } from "@/components/ui/toast";
import { toastStockError } from "@/components/ui/toast-stock-error";
import {
  isZeroRupeesInput,
  paiseToRupeesInput,
} from "@/lib/money";
import { cn } from "@/lib/utils";
import type { EstimateApprovalStateValue } from "@/modules/estimates/schema";

const DECISIONS: {
  value: EstimateApprovalStateValue;
  labelKey: "decisionAgreed" | "decisionSaidNo";
}[] = [
  { value: "APPROVED", labelKey: "decisionAgreed" },
  { value: "REJECTED", labelKey: "decisionSaidNo" },
];

type Props = {
  orderId?: string;
  inspectionId?: string;
  lineId: string;
  approvalState: EstimateApprovalStateValue;
  description: string;
  quantity: number;
  unitPricePaise: number;
  disabled?: boolean;
  /** Icon-only marks for tight table cells; labels stay in title/aria. */
  compact?: boolean;
};

export function CompactLineApproval({
  orderId,
  inspectionId,
  lineId,
  approvalState,
  description,
  quantity,
  unitPricePaise,
  disabled,
  compact = false,
}: Props) {
  const t = useTranslations("estimates");
  const ti = useTranslations("inventory");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function save(nextState: EstimateApprovalStateValue) {
    if (disabled || pending || nextState === approvalState) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("description", description);
      formData.set("quantity", String(quantity));
      const priceInput = paiseToRupeesInput(unitPricePaise);
      formData.set(
        "unitPriceRupees",
        isZeroRupeesInput(priceInput) ? "0" : priceInput,
      );
      formData.set("approvalState", nextState);
      formData.set("method", "MANUAL");
      formData.set("note", "");
      const result = orderId
        ? await savePermissionLineAction(
            orderId,
            lineId,
            { ok: false },
            formData,
          )
        : await saveInspectionEstimateLineAction(
            inspectionId!,
            lineId,
            { ok: false },
            formData,
          );
      if (result.ok) {
        toast.success(t("approvalSaved"));
        router.refresh();
        return;
      }
      toastStockError(result.message ?? t("errors.lineBilled"), {
        stockPartId: result.stockPartId,
        viewStockLabel: ti("errors.viewStock"),
      });
    });
  }

  return (
    <div
      role="group"
      aria-label={t("customerSaidTitle")}
      className="inline-flex flex-nowrap items-center gap-1"
      data-row-stop
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {DECISIONS.map(({ value, labelKey }) => {
        const active = approvalState === value;
        const label = t(labelKey);
        const Icon = value === "APPROVED" ? Check : X;
        return (
          <button
            key={value}
            type="button"
            disabled={disabled || pending}
            title={label}
            aria-label={label}
            aria-pressed={active}
            onClick={() => save(value)}
            className={cn(
              "inline-flex h-9 min-h-9 shrink-0 items-center justify-center gap-1 rounded-md border text-[11px] font-bold transition-colors disabled:opacity-60",
              compact ? "w-9 px-0" : "px-2 sm:px-2.5 sm:text-[12px]",
              value === "APPROVED"
                ? active
                  ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-600 hover:text-white"
                  : "border-emerald-200 bg-white text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50"
                : active
                  ? "border-red-600 bg-red-600 text-white hover:bg-red-600 hover:text-white"
                  : "border-red-200 bg-white text-red-700 hover:border-red-400 hover:bg-red-50",
            )}
          >
            <Icon
              className="size-3.5 shrink-0"
              strokeWidth={2.5}
              aria-hidden
            />
            {compact ? null : <span>{label}</span>}
          </button>
        );
      })}
    </div>
  );
}
