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
import { Check } from "lucide-react";
import {
  markExpensePaidAction,
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
import { FormField } from "@/components/ui/form-field";
import { FormSelect } from "@/components/ui/form-select";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { todayDateInput } from "@/modules/expenses/components/expense-form-fields";
import {
  EXPENSE_METHODS,
  type ExpenseMethod,
} from "@/modules/expenses/schema";

const initial: ExpenseActionState = { ok: false };

type Props = {
  expenseId: string;
  spentAtInput: string;
};

export function MarkExpensePaidModal({ expenseId, spentAtInput }: Props) {
  const t = useTranslations("expenses");
  const te = useTranslations("errors");
  const router = useRouter();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<ExpenseMethod | "">("CASH");
  const [spentAt, setSpentAt] = useState(spentAtInput || todayDateInput());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const boundMark = useMemo(
    () => markExpensePaidAction.bind(null, expenseId),
    [expenseId],
  );
  const [state, formAction, pending] = useActionState(boundMark, initial);
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

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      handled.current = null;
      setMethod("CASH");
      setSpentAt(spentAtInput || todayDateInput());
      setFieldErrors({});
    }
  }

  function validateClient(): boolean {
    const next: Record<string, string> = {};
    if (!method) next.method = te("validation.required");
    if (!spentAt.trim()) next.spentAt = te("validation.required");
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="default" variant="secondary">
          <Check className="size-4" aria-hidden />
          {t("markPaid")}
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border px-5 py-4 pr-12 text-left">
          <DialogTitle>{t("markPaidTitle")}</DialogTitle>
          <DialogDescription>{t("markPaidSubtitle")}</DialogDescription>
        </DialogHeader>
        <DialogBody className="px-5 py-4">
          <form
            id={formId}
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!validateClient()) return;
              const formData = new FormData(e.currentTarget);
              startTransition(() => {
                formAction(formData);
              });
            }}
          >
            <FormField
              id={`mark-paid-${expenseId}-method`}
              label={t("method")}
              error={fieldErrors.method}
            >
              <FormSelect
                id={`mark-paid-${expenseId}-method`}
                name="method"
                value={method}
                onValueChange={(value) =>
                  setMethod(value as ExpenseMethod | "")
                }
                placeholder={t("methodPlaceholder")}
                options={EXPENSE_METHODS.map((item) => ({
                  value: item,
                  label: t(`methods.${item}`),
                }))}
                triggerClassName="h-11 min-h-11"
              />
            </FormField>
            <FormField
              id={`mark-paid-${expenseId}-spentAt`}
              label={t("paidOn")}
              error={fieldErrors.spentAt}
            >
              <Input
                id={`mark-paid-${expenseId}-spentAt`}
                name="spentAt"
                type="date"
                value={spentAt}
                onChange={(e) => setSpentAt(e.target.value)}
                className="h-11 min-h-11"
              />
            </FormField>
          </form>
        </DialogBody>
        <DialogFooter className="gap-2 border-t border-border bg-background px-5 py-4 sm:justify-end">
          <DialogClose asChild>
            <Button type="button" variant="secondary" size="md">
              {t("cancel")}
            </Button>
          </DialogClose>
          <Button type="submit" form={formId} size="md" loading={pending}>
            {pending ? t("saving") : t("markPaid")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
