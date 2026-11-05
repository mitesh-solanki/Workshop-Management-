"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { deleteExpenseAction } from "@/app/actions/expenses";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { formatRupees } from "@/lib/money";
import {
  EditExpenseModal,
  type EditExpenseValues,
} from "@/modules/expenses/components/edit-expense-modal";
import { MarkExpensePaidModal } from "@/modules/expenses/components/mark-expense-paid-modal";

type Props = {
  expense: EditExpenseValues;
  canWrite: boolean;
  usedCategories?: readonly string[];
};

export function ExpenseRowActions({
  expense,
  canWrite,
  usedCategories = [],
}: Props) {
  const t = useTranslations("expenses");
  const locale = useLocale();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onConfirmDelete() {
    startTransition(async () => {
      const result = await deleteExpenseAction(expense.id);
      if (!result.ok) {
        toast.error(result.message ?? t("error"));
        return;
      }
      toast.success(result.message ?? t("deleted"));
      setDeleteOpen(false);
    });
  }

  if (!canWrite) return null;

  return (
    <>
      <div
        className="flex items-center justify-end gap-1.5"
        data-row-stop
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        {expense.status === "UNPAID" ? (
          <MarkExpensePaidModal
            expenseId={expense.id}
            spentAtInput={expense.spentAtInput}
          />
        ) : null}
        <EditExpenseModal expense={expense} usedCategories={usedCategories} />
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={pending}
          className="text-danger hover:bg-danger/5 hover:text-danger"
          aria-label={t("delete")}
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(next) => {
          if (pending && !next) return;
          setDeleteOpen(next);
        }}
        title={t("deleteTitle")}
        description={t("deleteConfirm", {
          category: expense.category,
          amount: formatRupees(expense.amountPaise, locale),
        })}
        confirmLabel={t("delete")}
        variant="danger"
        loading={pending && deleteOpen}
        onConfirm={onConfirmDelete}
      />
    </>
  );
}
