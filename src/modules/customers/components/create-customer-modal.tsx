"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import {
  createCustomerModalAction,
  type CustomerActionState,
} from "@/app/actions/customers";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { useCreateModalNavigation } from "@/hooks/use-create-modal-navigation";
import { isValidPhone, sanitizePhoneTyping } from "@/lib/contact";

const initial: CustomerActionState = { ok: false };

type FormValues = {
  name: string;
  phone: string;
  address: string;
  notes: string;
};

const EMPTY: FormValues = {
  name: "",
  phone: "",
  address: "",
  notes: "",
};

type Props = {
  /** Optional trigger; defaults to primary “Add customer” button. */
  trigger?: React.ReactNode;
  size?: "sm" | "md";
};

export function CreateCustomerModal({ trigger, size = "md" }: Props) {
  const t = useTranslations("customers");
  const te = useTranslations("errors");
  const formId = useId();
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [state, formAction, pending] = useActionState(
    createCustomerModalAction,
    initial,
  );
  const errorHandled = useRef<string | null>(null);

  const { open, onOpenChange } = useCreateModalNavigation({
    kind: "customer",
    success:
      state.ok && state.customerId
        ? { id: state.customerId, message: state.message }
        : null,
    hrefForId: (id) => `/customers/${id}`,
    onReset: () => {
      setValues(EMPTY);
      setFieldErrors({});
    },
  });

  useEffect(() => {
    if (state.ok || !state.message) return;
    if (state.message === errorHandled.current) return;
    errorHandled.current = state.message;
    toast.error(state.message);
  }, [state.ok, state.message]);

  function setField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
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
    if (!values.name.trim()) {
      next.name = te("validation.required");
    }
    if (!values.phone.trim()) {
      next.phone = te("validation.required");
    } else if (!isValidPhone(values.phone)) {
      next.phone = te("validation.invalidPhone");
    }
    setFieldErrors(next);
    if (Object.keys(next).length === 0) return true;
    const first = Object.keys(next)[0];
    window.setTimeout(() => {
      document.getElementById(`modal-${first}`)?.focus();
    }, 50);
    return false;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (next) {
          errorHandled.current = null;
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" size={size}>
            <Plus className="size-4" aria-hidden />
            {t("add")}
          </Button>
        )}
      </DialogTrigger>
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
              const formData = new FormData(e.currentTarget);
              startTransition(() => {
                formAction(formData);
              });
            }}
            className="flex flex-col gap-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="modal-name"
                label={t("name")}
                error={fieldErrors.name}
              >
                <Input
                  id="modal-name"
                  name="name"
                  value={values.name}
                  onChange={(e) => setField("name", e.target.value)}
                  autoComplete="name"
                  autoFocus
                  aria-invalid={Boolean(fieldErrors.name)}
                  className="h-11 min-h-11"
                />
              </FormField>
              <FormField
                id="modal-phone"
                label={t("phone")}
                error={fieldErrors.phone}
              >
                <Input
                  id="modal-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  value={values.phone}
                  onChange={(e) =>
                    setField("phone", sanitizePhoneTyping(e.target.value))
                  }
                  aria-invalid={Boolean(fieldErrors.phone)}
                  className="h-11 min-h-11"
                />
              </FormField>
            </div>
            <FormField id="modal-address" label={t("address")}>
              <Textarea
                id="modal-address"
                name="address"
                rows={2}
                value={values.address}
                onChange={(e) => setField("address", e.target.value)}
              />
            </FormField>
            <FormField id="modal-notes" label={t("notes")}>
              <Textarea
                id="modal-notes"
                name="notes"
                rows={2}
                value={values.notes}
                onChange={(e) => setField("notes", e.target.value)}
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
            {pending ? t("saving") : t("create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
