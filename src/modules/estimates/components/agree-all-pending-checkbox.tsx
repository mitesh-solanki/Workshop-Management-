"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { agreeAllPendingLinesAction } from "@/app/actions/estimates";
import { toast } from "@/components/ui/toast";
import { toastStockError } from "@/components/ui/toast-stock-error";
import { cn } from "@/lib/utils";

type Props = {
  orderId: string;
  pendingCount: number;
  disabled?: boolean;
};

export function AgreeAllPendingCheckbox({
  orderId,
  pendingCount,
  disabled = false,
}: Props) {
  const t = useTranslations("estimates");
  const ti = useTranslations("inventory");
  const [pending, startTransition] = useTransition();
  const allAgreed = pendingCount === 0;

  function onChange(checked: boolean) {
    if (!checked || allAgreed || disabled || pending) return;
    startTransition(async () => {
      const result = await agreeAllPendingLinesAction(orderId);
      if (result.ok) {
        toast.success(
          result.message === "agreeAllSaved"
            ? t("agreeAllSaved")
            : t("approvalSaved"),
        );
        return;
      }
      toastStockError(result.message ?? t("errors.lineBilled"), {
        stockPartId: result.stockPartId,
        viewStockLabel: ti("errors.viewStock"),
      });
    });
  }

  return (
    <label
      className={cn(
        "inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-emerald-800 shadow-xs",
        (disabled || pending || allAgreed) && "cursor-default opacity-80",
      )}
    >
      <input
        type="checkbox"
        className="size-4 accent-emerald-700"
        checked={allAgreed}
        disabled={disabled || pending || allAgreed}
        onChange={(event) => onChange(event.target.checked)}
        aria-label={t("agreeAll")}
      />
      <span>{pending ? t("saving") : t("agreeAll")}</span>
    </label>
  );
}
