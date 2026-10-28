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
  updateCustomerAction,
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
import { isValidPhone, sanitizePhoneTyping } from "@/lib/contact";

const initial: CustomerActionState = { ok: false };

export type EditCustomerValues = {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  notes: string | null;
};

type FormValues = {
  name: string;
  phone: string;
  address: string;
  notes: string;
};

type Props = {
  customer: EditCustomerValues;
  /** Optional trigger; defaults to outline edit icon button. */
  trigger?: React.ReactNode;
};

export function EditCustomerModal({ customer, trigger }: Props) {
  const t = useTranslations("customers");
  const te = useTranslations("errors");
  const router = useRouter();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<FormValues>(() => ({
    name: customer.name,
    phone: customer.phone,
    address: customer.address ?? "",
    notes: customer.notes ?? "",
  }));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const boundUpdate = useMemo(
    () => updateCustomerAction.bind(null, customer.id),
    [customer.id],
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

    toast.error(state.message);
  }, [state, router]);

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
      document.getElementById(`edit-${first}-${customer.id}`)?.focus();
    }, 50);
    return false;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          handled.current = null;
          setValues({
            name: customer.name,
            phone: customer.phone,
            address: customer.address ?? "",
            notes: customer.notes ?? "",
          });
          setFieldErrors({});
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={t("edit")}
          >
            <Pencil className="size-4" aria-hidden />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border px-5 py-4 pr-12 text-left">
          <DialogTitle>{t("editTitle")}</DialogTitle>
          <DialogDescription>{customer.name}</DialogDescription>
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
                id={`edit-name-${customer.id}`}
                label={t("name")}
                error={fieldErrors.name}
              >
                <Input
                  id={`edit-name-${customer.id}`}
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
                id={`edit-phone-${customer.id}`}
                label={t("phone")}
                error={fieldErrors.phone}
              >
                <Input
                  id={`edit-phone-${customer.id}`}
                  name="phone"
                  type="tel"
                  value={values.phone}
                  onChange={(e) =>
                    setField("phone", sanitizePhoneTyping(e.target.value))
                  }
                  autoComplete="tel"
                  inputMode="tel"
                  aria-invalid={Boolean(fieldErrors.phone)}
                  className="h-11 min-h-11"
                />
              </FormField>
            </div>
            <FormField id={`edit-address-${customer.id}`} label={t("address")}>
              <Textarea
                id={`edit-address-${customer.id}`}
                name="address"
                value={values.address}
                onChange={(e) => setField("address", e.target.value)}
                rows={2}
              />
            </FormField>
            <FormField id={`edit-notes-${customer.id}`} label={t("notes")}>
              <Textarea
                id={`edit-notes-${customer.id}`}
                name="notes"
                value={values.notes}
                onChange={(e) => setField("notes", e.target.value)}
                rows={2}
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
            {pending ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
