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
  type ExpenseGstSplit,
} from "@/modules/expenses/components/expense-form-fields";
import { uploadExpenseBillFile } from "@/modules/expenses/components/upload-expense-bill";
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
  vendorId?: string | null;
  gstSplit?: ExpenseGstSplit;
  gstRatePercent?: number;
  billFileName?: string | null;
  hasBill?: boolean;
};

type Props = {
  expense: EditExpenseValues;
  usedCategories?: readonly string[];
  vendors?: readonly {
    id: string;
    name: string;
  }[];
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
    vendorId: expense.vendorId ?? "",
    gstSplit: expense.gstSplit ?? "CGST_SGST",
    gstRatePercent: expense.gstRatePercent ?? 0,
    billFile: null,
  };
}

export function EditExpenseModal({
  expense,
  usedCategories = [],
  vendors = [],
  trigger,
}: Props) {
  const t = useTranslations("expenses");
  const te = useTranslations("errors");
  const router = useRouter();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<ExpenseFormValues>(() => toForm(expense));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const boundUpdate = useMemo(
    () => updateExpenseModalAction.bind(null, expense.id),
    [expense.id],
  );
  const [state, formAction, pending] = useActionState(boundUpdate, initial);
  const handled = useRef<string | null>(null);
  const pendingFileRef = useRef<File | null>(null);

  useEffect(() => {
    if (!state.message || state.message === handled.current) return;
    handled.current = state.message;

    if (state.ok) {
      const selected = pendingFileRef.current;
      void (async () => {
        if (selected) {
          setUploading(true);
          try {
            await uploadExpenseBillFile({
              expenseId: expense.id,
              file: selected,
              uploadFailedMessage: t("uploadFailed"),
            });
            toast.success(t("updatedWithBill"));
          } catch (err) {
            const message =
              err instanceof Error ? err.message : t("uploadFailed");
            toast.error(t("updatedButUploadFailed", { reason: message }));
          } finally {
            setUploading(false);
          }
        } else {
          toast.success(state.message);
        }
        pendingFileRef.current = null;
        router.refresh();
        window.setTimeout(() => setOpen(false), 0);
      })();
      return;
    }

    if (state.fieldErrors) {
      const errors = state.fieldErrors;
      const id = window.setTimeout(() => setFieldErrors(errors), 0);
      toast.error(state.message);
      return () => window.clearTimeout(id);
    }

    toast.error(state.message);
  }, [state, router, expense.id, t]);

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
    const hasExistingBill = Boolean(expense.hasBill);
    if (
      values.gstRatePercent > 0 &&
      !values.billFile &&
      !hasExistingBill
    ) {
      next.billFile = t("errors.billRequired");
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleOpenChange(next: boolean) {
    if (uploading) return;
    setOpen(next);
    if (next) {
      handled.current = null;
      setValues(toForm(expense));
      setFieldErrors({});
      pendingFileRef.current = null;
    }
  }

  const busy = pending || uploading;

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
      <DialogContent className="gap-0 p-0 sm:max-w-xl">
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
              pendingFileRef.current = values.billFile;
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
              vendors={vendors}
              onChange={setField}
            />
            {expense.hasBill && !values.billFile && values.gstRatePercent > 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {t("existingBill", {
                  name: expense.billFileName ?? t("bill"),
                })}
              </p>
            ) : null}
          </form>
        </DialogBody>
        <DialogFooter className="gap-2 border-t border-border bg-background px-5 py-4 sm:justify-end">
          <DialogClose asChild>
            <Button type="button" variant="secondary" size="md" disabled={busy}>
              {t("cancel")}
            </Button>
          </DialogClose>
          <Button type="submit" form={formId} size="md" loading={busy}>
            {busy ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
