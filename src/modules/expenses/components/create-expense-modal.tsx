"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import {
  createExpenseModalAction,
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
import { useStripCreateQuery } from "@/hooks/use-open-create-query";
import {
  ExpenseFormFields,
  todayDateInput,
  type ExpenseFormValues,
} from "@/modules/expenses/components/expense-form-fields";
import { uploadExpenseBillFile } from "@/modules/expenses/components/upload-expense-bill";

const initial: ExpenseActionState = { ok: false };

const EMPTY = (): ExpenseFormValues => ({
  amountRupees: "",
  spentAt: todayDateInput(),
  status: "PAID",
  method: "CASH",
  category: "",
  note: "",
  vendorId: "",
  gstSplit: "CGST_SGST",
  gstRatePercent: 0,
  billFile: null,
});

type Props = {
  trigger?: React.ReactNode;
  size?: "sm" | "md";
  defaultOpen?: boolean;
  usedCategories?: readonly string[];
  vendors?: readonly {
    id: string;
    name: string;
  }[];
};

export function CreateExpenseModal({
  trigger,
  size = "md",
  defaultOpen = false,
  usedCategories = [],
  vendors = [],
}: Props) {
  const t = useTranslations("expenses");
  const te = useTranslations("errors");
  const router = useRouter();
  const formId = useId();
  const [open, setOpen] = useState(defaultOpen);
  const [values, setValues] = useState<ExpenseFormValues>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [state, formAction, pending] = useActionState(
    createExpenseModalAction,
    initial,
  );
  const errorHandled = useRef<string | null>(null);
  const successHandled = useRef<string | null>(null);
  const pendingFileRef = useRef<File | null>(null);

  useStripCreateQuery(defaultOpen);

  function resetForm() {
    setValues(EMPTY());
    setFieldErrors({});
    pendingFileRef.current = null;
  }

  function handleOpenChange(next: boolean) {
    if (uploading) return;
    setOpen(next);
    if (next) {
      errorHandled.current = null;
      successHandled.current = null;
      resetForm();
    } else {
      resetForm();
    }
  }

  useEffect(() => {
    if (!state.message || state.message === errorHandled.current) return;
    if (state.ok && state.expenseId) {
      if (successHandled.current === state.expenseId) return;
      successHandled.current = state.expenseId;
      errorHandled.current = state.message;
      const expenseId = state.expenseId;
      const selected = pendingFileRef.current;

      void (async () => {
        if (selected) {
          setUploading(true);
          try {
            await uploadExpenseBillFile({
              expenseId,
              file: selected,
              uploadFailedMessage: t("uploadFailed"),
            });
            toast.success(t("createdWithBill"));
          } catch (err) {
            const message =
              err instanceof Error ? err.message : t("uploadFailed");
            toast.error(t("createdButUploadFailed", { reason: message }));
          } finally {
            setUploading(false);
          }
        } else {
          toast.success(state.message);
        }
        pendingFileRef.current = null;
        router.refresh();
        window.setTimeout(() => {
          setOpen(false);
          resetForm();
        }, 0);
      })();
      return;
    }

    if (state.ok) return;
    errorHandled.current = state.message;
    if (state.fieldErrors) {
      const errors = state.fieldErrors;
      const id = window.setTimeout(() => setFieldErrors(errors), 0);
      toast.error(state.message);
      return () => window.clearTimeout(id);
    }
    toast.error(state.message);
  }, [state, router, t]);

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
    if (values.gstRatePercent > 0 && !values.billFile) {
      next.billFile = t("errors.billRequired");
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  const busy = pending || uploading;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger !== null ? (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button type="button" size={size}>
              <Plus className="size-4" aria-hidden />
              {t("add")}
            </Button>
          )}
        </DialogTrigger>
      ) : null}
      <DialogContent className="gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border px-5 py-4 pr-12 text-left">
          <DialogTitle>{t("newTitle")}</DialogTitle>
          <DialogDescription>{t("newSubtitle")}</DialogDescription>
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
              idPrefix="create-expense"
              values={values}
              fieldErrors={fieldErrors}
              usedCategories={usedCategories}
              vendors={vendors}
              onChange={setField}
            />
          </form>
        </DialogBody>
        <DialogFooter className="gap-2 border-t border-border bg-background px-5 py-4 sm:justify-end">
          <DialogClose asChild>
            <Button type="button" variant="secondary" size="md" disabled={busy}>
              {t("cancel")}
            </Button>
          </DialogClose>
          <Button type="submit" form={formId} size="md" loading={busy}>
            {busy ? t("saving") : t("create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
