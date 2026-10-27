"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { savePermissionLineAction } from "@/app/actions/estimates";
import { toast } from "@/components/ui/toast";
import {
  isZeroRupeesInput,
  paiseToRupeesInput,
} from "@/lib/money";
import { cn } from "@/lib/utils";
import type { EstimateApprovalStateValue } from "@/modules/estimates/schema";

const DECISIONS: {
  value: EstimateApprovalStateValue;
  mark: string;
  labelKey: "decisionAgreed" | "decisionSaidNo";
}[] = [
  { value: "APPROVED", mark: "✓", labelKey: "decisionAgreed" },
  { value: "REJECTED", mark: "✕", labelKey: "decisionSaidNo" },
];

type Props = {
  orderId: string;
  lineId: string;
  approvalState: EstimateApprovalStateValue;
  description: string;
  quantity: number;
  unitPricePaise: number;
  disabled?: boolean;
};

export function CompactLineApproval({
  orderId,
  lineId,
  approvalState,
  description,
  quantity,
  unitPricePaise,
  disabled,
}: Props) {
  const t = useTranslations("estimates");
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
      const result = await savePermissionLineAction(
        orderId,
        lineId,
        { ok: false },
        formData,
      );
      if (result.ok) {
        toast.success(t("approvalSaved"));
        return;
      }
      toast.error(result.message ?? t("errors.lineBilled"));
    });
  }

  return (
    <div
      role="group"
      aria-label={t("customerSaidTitle")}
      className="flex flex-wrap gap-1"
      data-row-stop
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {DECISIONS.map(({ value, mark, labelKey }) => {
        const active = approvalState === value;
        return (
          <button
            key={value}
            type="button"
            disabled={disabled || pending}
            title={t(labelKey)}
            aria-pressed={active}
            onClick={() => save(value)}
            className={cn(
              "inline-flex min-h-9 items-center gap-1 rounded-lg border px-2 text-[11px] font-bold transition-colors disabled:opacity-60 sm:px-2.5 sm:text-[12px]",
              value === "APPROVED"
                ? active
                  ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                  : "border-emerald-200 bg-white text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50"
                : active
                  ? "border-red-500 bg-red-50 text-red-800"
                  : "border-red-200 bg-white text-red-700 hover:border-red-400 hover:bg-red-50",
            )}
          >
            <span aria-hidden>{mark}</span>
            <span className="hidden sm:inline">{t(labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}
