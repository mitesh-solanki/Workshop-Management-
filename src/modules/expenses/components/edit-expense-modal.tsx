"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import {
  updateExpenseModalAction,
  type ExpenseActionState,
} from "@/app/actions/expenses";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { paiseToRupeesInput } from "@/lib/money";
import {
  ExpenseFormFields,
  type ExpenseFormValues,
} from "@/modules/expenses/components/expense-form-fields";
import type {
  ExpenseMethod,
  ExpenseStatus,
} from "@/modules/expenses/schema";

const initial: ExpenseActionState = { ok: false };

export type EditExpenseValues = {
  id: string;
  amountPaise: number;
  spentAtInput: string;
  status: ExpenseStatus;
  method: ExpenseMethod | null;
  category: string;
  note: string | null;
};

type Props = {
  expense: EditExpenseValues;
  usedCategories?: readonly string[];
  trigger?: React.ReactNode;
};

function toForm(expense: EditExpenseValues): ExpenseFormValues {
  return {
    amountRupees: paiseToRupeesInput(expense.amountPaise),
    spentAt: expense.spentAtInput,
    status: expense.status,
    method: expense.method ?? (expense.status === "PAID" ? "CASH" : ""),
    category: expense.category,
    note: expense.note ?? "",
  };
}

export function EditExpenseModal({
  expense,
  usedCategories = [],
  trigger,
}: Props) {
  const t = useTranslations("expenses");
  const te = useTranslations("errors");
  const router = useRouter();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<ExpenseFormValues>(() => toForm(expense));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const boundUpdate = useMemo(
    () => updateExpenseModalAction.bind(null, expense.id),
    [expense.id],
  );
  const [state, formAction, pending] = useActionState(boundUpdate, initial);
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!state.message || state.message === handled.current) return;
    handled.current = state.message;

    if (state.ok) {
      toast.success(state.message);
      router.refresh();
      const id = window.setTimeout(() => setOpen(false), 0);
      return () => window.clearTimeout(id);
    }

    if (state.fieldErrors) {
      const errors = state.fieldErrors;
      const id = window.setTimeout(() => setFieldErrors(errors), 0);
      toast.error(state.message);
      return () => window.clearTimeout(id);
    }

    toast.error(state.message);
  }, [state, router]);

  function setField<K extends keyof ExpenseFormValues>(
    key: K,
    value: ExpenseFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function validateClient(): boolean {
    const next: Record<string, string> = {};
    if (!values.amountRupees.trim()) {
      next.amountRupees = te("validation.required");
    }
    if (!values.spentAt.trim()) {
      next.spentAt = te("validation.required");
    }
    if (!values.category) {
      next.category = te("validation.required");
    }
    if (values.status === "PAID" && !values.method) {
      next.method = te("validation.required");
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      handled.current = null;
      setValues(toForm(expense));
      setFieldErrors({});
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t("edit")}
          >
            <Pencil className="size-4" aria-hidden />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-5 py-4 pr-12 text-left">
          <DialogTitle>{t("editTitle")}</DialogTitle>
          <DialogDescription>{t("editSubtitle")}</DialogDescription>
        </DialogHeader>
        <DialogBody className="px-5 py-4">
          <form
            id={formId}
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (!validateClient()) return;
              const formData = new FormData(e.currentTarget);
              startTransition(() => {
                formAction(formData);
              });
            }}
          >
            <ExpenseFormFields
              idPrefix={`edit-expense-${expense.id}`}
              values={values}
              fieldErrors={fieldErrors}
              usedCategories={usedCategories}
              onChange={setField}
            />
          </form>
        </DialogBody>
        <DialogFooter className="gap-2 border-t border-border bg-background px-5 py-4 sm:justify-end">
          <DialogClose asChild>
            <Button type="button" variant="secondary" size="md">
              {t("cancel")}
            </Button>
          </DialogClose>
          <Button type="submit" form={formId} size="md" loading={pending}>
            {pending ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
