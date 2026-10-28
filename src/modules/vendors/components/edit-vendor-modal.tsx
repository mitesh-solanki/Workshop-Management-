"use client";

import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import {
  updateVendorModalAction,
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
import {
  isValidEmail,
  isValidPhone,
  sanitizeEmailTyping,
  sanitizePhoneTyping,
} from "@/lib/contact";

const initial: VendorActionState = { ok: false };

export type EditVendorValues = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstin: string | null;
  notes: string | null;
};

type FormValues = {
  name: string;
  phone: string;
  email: string;
  address: string;
  gstin: string;
  notes: string;
};

type Props = {
  vendor: EditVendorValues;
  trigger?: React.ReactNode;
};

function toForm(vendor: EditVendorValues): FormValues {
  return {
    name: vendor.name,
    phone: vendor.phone ?? "",
    email: vendor.email ?? "",
    address: vendor.address ?? "",
    gstin: vendor.gstin ?? "",
    notes: vendor.notes ?? "",
  };
}

export function EditVendorModal({ vendor, trigger }: Props) {
  const t = useTranslations("vendors");
  const te = useTranslations("errors");
  const router = useRouter();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<FormValues>(() => toForm(vendor));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const boundUpdate = useMemo(
    () => updateVendorModalAction.bind(null, vendor.id),
    [vendor.id],
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
      document.getElementById(`edit-vendor-${first}-${vendor.id}`)?.focus();
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
          setValues(toForm(vendor));
          setFieldErrors({});
        }
      }}
    >
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
      <DialogContent className="gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-5 py-4 pr-12 text-left">
          <DialogTitle>{t("editTitle")}</DialogTitle>
          <DialogDescription>{vendor.name}</DialogDescription>
        </DialogHeader>

        <DialogBody className="px-5 py-4">
          <form
            id={formId}
            action={(formData) => {
              if (!validateClient()) return;
              formAction(formData);
            }}
            className="flex flex-col gap-4"
          >
            <p className="text-caption text-muted-foreground">
              {t("contactRequiredHint")}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id={`edit-vendor-name-${vendor.id}`}
                label={t("nameRequired")}
                error={fieldErrors.name}
              >
                <Input
                  id={`edit-vendor-name-${vendor.id}`}
                  name="name"
                  value={values.name}
                  onChange={(e) => setField("name", e.target.value)}
                  required
                  autoComplete="organization"
                  autoFocus
                  placeholder={t("namePlaceholder")}
                  aria-invalid={Boolean(fieldErrors.name)}
                  className="h-11 min-h-11"
                />
              </FormField>
              <FormField
                id={`edit-vendor-phone-${vendor.id}`}
                label={t("phone")}
                error={fieldErrors.phone}
              >
                <Input
                  id={`edit-vendor-phone-${vendor.id}`}
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
                id={`edit-vendor-email-${vendor.id}`}
                label={t("email")}
                error={fieldErrors.email}
              >
                <Input
                  id={`edit-vendor-email-${vendor.id}`}
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
                id={`edit-vendor-gstin-${vendor.id}`}
                label={t("gstin")}
                error={fieldErrors.gstin}
              >
                <Input
                  id={`edit-vendor-gstin-${vendor.id}`}
                  name="gstin"
                  value={values.gstin}
                  onChange={(e) =>
                    setField(
                      "gstin",
                      e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 15),
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
            <FormField
              id={`edit-vendor-address-${vendor.id}`}
              label={t("address")}
            >
              <Textarea
                id={`edit-vendor-address-${vendor.id}`}
                name="address"
                rows={2}
                value={values.address}
                onChange={(e) => setField("address", e.target.value)}
                placeholder={t("addressPlaceholder")}
              />
            </FormField>
            <FormField id={`edit-vendor-notes-${vendor.id}`} label={t("notes")}>
              <Textarea
                id={`edit-vendor-notes-${vendor.id}`}
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
            {pending ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
