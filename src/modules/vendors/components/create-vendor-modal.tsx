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
  createVendorModalAction,
  type VendorActionState,
} from "@/app/actions/vendors";
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
import {
  isValidEmail,
  isValidPhone,
  sanitizeEmailTyping,
  sanitizePhoneTyping,
} from "@/lib/contact";

const initial: VendorActionState = { ok: false };

type FormValues = {
  name: string;
  phone: string;
  email: string;
  address: string;
  gstin: string;
  notes: string;
};

const EMPTY: FormValues = {
  name: "",
  phone: "",
  email: "",
  address: "",
  gstin: "",
  notes: "",
};

export type CreatedVendorSummary = {
  id: string;
  name: string;
};

type Props = {
  trigger?: React.ReactNode;
  size?: "sm" | "md";
  /** Controlled open (e.g. quick-add from inventory Bought From). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Prefill name when opening from a typed vendor query. */
  initialName?: string;
  /** Stay on the current page and call `onCreated` instead of opening the vendor. */
  navigateOnSuccess?: boolean;
  onCreated?: (vendor: CreatedVendorSummary) => void;
};

export function CreateVendorModal({
  trigger,
  size = "md",
  open: openProp,
  onOpenChange: onOpenChangeProp,
  initialName = "",
  navigateOnSuccess = true,
  onCreated,
}: Props) {
  const t = useTranslations("vendors");
  const te = useTranslations("errors");
  const formId = useId();
  const [values, setValues] = useState<FormValues>(() => ({
    ...EMPTY,
    name: initialName,
  }));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [state, formAction, pending] = useActionState(
    createVendorModalAction,
    initial,
  );
  const errorHandled = useRef<string | null>(null);
  const successHandled = useRef<string | null>(null);
  const submittedNameRef = useRef("");
  const controlled = openProp !== undefined;

  function resetForm(name = "") {
    setValues({ ...EMPTY, name });
    setFieldErrors({});
  }

  const nav = useCreateModalNavigation({
    kind: "vendor",
    success:
      navigateOnSuccess && state.ok && state.vendorId
        ? { id: state.vendorId, message: state.message }
        : null,
    hrefForId: (id) => `/vendors/${id}`,
    onReset: () => resetForm(),
  });

  const open = controlled ? Boolean(openProp) : nav.open;

  function handleOpenChange(next: boolean) {
    if (controlled) {
      onOpenChangeProp?.(next);
    } else {
      nav.onOpenChange(next);
    }
    if (next) {
      errorHandled.current = null;
      successHandled.current = null;
      resetForm(initialName.trim());
    } else {
      resetForm();
    }
  }

  useEffect(() => {
    if (!open) return;
    setValues((prev) =>
      prev.name.trim() === initialName.trim()
        ? prev
        : { ...prev, name: initialName },
    );
  }, [open, initialName]);

  useEffect(() => {
    if (state.ok || !state.message) return;
    if (state.message === errorHandled.current) return;
    errorHandled.current = state.message;
    if (state.fieldErrors) {
      setFieldErrors(state.fieldErrors);
    }
    toast.error(state.message);
  }, [state]);

  useEffect(() => {
    if (navigateOnSuccess) return;
    if (!state.ok || !state.vendorId) return;
    if (successHandled.current === state.vendorId) return;
    successHandled.current = state.vendorId;
    const created = {
      id: state.vendorId,
      name: submittedNameRef.current.trim() || t("add"),
    };
    toast.success(state.message ?? t("created"));
    onCreated?.(created);
    handleOpenChange(false);
  }, [state, navigateOnSuccess, onCreated, t]);

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
    if (values.phone.trim() && !isValidPhone(values.phone)) {
      next.phone = te("validation.invalidPhone");
    }
    if (values.email.trim() && !isValidEmail(values.email)) {
      next.email = te("validation.invalidEmail");
    }
    if (!values.phone.trim() && !values.email.trim()) {
      next.phone = te("validation.phoneOrEmail");
    }
    if (
      values.gstin.trim() &&
      !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(
        values.gstin.trim().toUpperCase(),
      )
    ) {
      next.gstin = te("validation.invalidGstin");
    }
    setFieldErrors(next);
    if (Object.keys(next).length === 0) return true;
    const first = Object.keys(next)[0];
    window.setTimeout(() => {
      document.getElementById(`modal-vendor-${first}`)?.focus();
    }, 50);
    return false;
  }

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
      <DialogContent className="gap-0 p-0 sm:max-w-2xl">
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
              submittedNameRef.current = values.name;
              const formData = new FormData(e.currentTarget);
              startTransition(() => {
                formAction(formData);
              });
            }}
            className="flex flex-col gap-4"
          >
            <p className="text-caption text-muted-foreground">
              {t("contactRequiredHint")}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="modal-vendor-name"
                label={t("nameRequired")}
                error={fieldErrors.name}
              >
                <Input
                  id="modal-vendor-name"
                  name="name"
                  value={values.name}
                  onChange={(e) => setField("name", e.target.value)}
                  autoComplete="organization"
                  autoFocus
                  placeholder={t("namePlaceholder")}
                  aria-invalid={Boolean(fieldErrors.name)}
                  className="h-11 min-h-11"
                />
              </FormField>
              <FormField
                id="modal-vendor-phone"
                label={t("phone")}
                error={fieldErrors.phone}
              >
                <Input
                  id="modal-vendor-phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={values.phone}
                  onChange={(e) =>
                    setField("phone", sanitizePhoneTyping(e.target.value))
                  }
                  placeholder={t("phonePlaceholder")}
                  aria-invalid={Boolean(fieldErrors.phone)}
                  className="h-11 min-h-11"
                />
              </FormField>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="modal-vendor-email"
                label={t("email")}
                error={fieldErrors.email}
              >
                <Input
                  id="modal-vendor-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={values.email}
                  onChange={(e) =>
                    setField("email", sanitizeEmailTyping(e.target.value))
                  }
                  placeholder={t("emailPlaceholder")}
                  aria-invalid={Boolean(fieldErrors.email)}
                  className="h-11 min-h-11"
                />
              </FormField>
              <FormField
                id="modal-vendor-gstin"
                label={t("gstin")}
                error={fieldErrors.gstin}
              >
                <Input
                  id="modal-vendor-gstin"
                  name="gstin"
                  value={values.gstin}
                  onChange={(e) =>
                    setField(
                      "gstin",
                      e.target.value
                        .toUpperCase()
                        .replace(/[^0-9A-Z]/g, "")
                        .slice(0, 15),
                    )
                  }
                  placeholder={t("gstinPlaceholder")}
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={15}
                  aria-invalid={Boolean(fieldErrors.gstin)}
                  className="h-11 min-h-11 uppercase"
                />
              </FormField>
            </div>
            <FormField id="modal-vendor-address" label={t("address")}>
              <Textarea
                id="modal-vendor-address"
                name="address"
                rows={2}
                value={values.address}
                onChange={(e) => setField("address", e.target.value)}
                placeholder={t("addressPlaceholder")}
              />
            </FormField>
            <FormField id="modal-vendor-notes" label={t("notes")}>
              <Textarea
                id="modal-vendor-notes"
                name="notes"
                rows={2}
                value={values.notes}
                onChange={(e) => setField("notes", e.target.value)}
                placeholder={t("notesPlaceholder")}
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
