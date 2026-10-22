"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
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

const initial: CustomerActionState = { ok: false };

export type EditCustomerValues = {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  notes: string | null;
};

type Props = {
  customer: EditCustomerValues;
  /** Optional trigger; defaults to outline edit icon button. */
  trigger?: React.ReactNode;
};

export function EditCustomerModal({ customer, trigger }: Props) {
  const t = useTranslations("customers");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const boundUpdate = useMemo(
    () => updateCustomerAction.bind(null, customer.id),
    [customer.id],
  );
  const [state, formAction, pending] = useActionState(boundUpdate, initial);
  const handled = useRef<string | null>(null);
  // Remount fields when defaults change after a successful save + refresh.
  const formKey = [
    customer.id,
    customer.name,
    customer.phone,
    customer.address ?? "",
    customer.notes ?? "",
  ].join("|");

  useEffect(() => {
    if (!state.message || state.message === handled.current) return;
    handled.current = state.message;

    if (state.ok) {
      toast.success(state.message);
      router.refresh();
      // Defer close so we don't setState synchronously inside the effect body.
      const id = window.setTimeout(() => setOpen(false), 0);
      return () => window.clearTimeout(id);
    }

    toast.error(state.message);
  }, [state, router]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          handled.current = null;
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
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle>{t("editTitle")}</DialogTitle>
          <DialogDescription>{customer.name}</DialogDescription>
        </DialogHeader>

        <form
          key={formKey}
          action={formAction}
          className="flex flex-col gap-4 px-5 py-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id={`edit-name-${customer.id}`} label={t("name")}>
              <Input
                id={`edit-name-${customer.id}`}
                name="name"
                defaultValue={customer.name}
                required
                autoComplete="name"
                autoFocus
                className="h-11 min-h-11"
              />
            </FormField>
            <FormField id={`edit-phone-${customer.id}`} label={t("phone")}>
              <Input
                id={`edit-phone-${customer.id}`}
                name="phone"
                type="tel"
                defaultValue={customer.phone}
                required
                autoComplete="tel"
                inputMode="tel"
                className="h-11 min-h-11"
              />
            </FormField>
          </div>
          <FormField id={`edit-address-${customer.id}`} label={t("address")}>
            <Textarea
              id={`edit-address-${customer.id}`}
              name="address"
              defaultValue={customer.address ?? ""}
              rows={2}
            />
          </FormField>
          <FormField id={`edit-notes-${customer.id}`} label={t("notes")}>
            <Textarea
              id={`edit-notes-${customer.id}`}
              name="notes"
              defaultValue={customer.notes ?? ""}
              rows={2}
            />
          </FormField>

          <DialogFooter className="gap-2 border-t border-border px-0 pt-4 sm:justify-end">
            <DialogClose asChild>
              <Button type="button" variant="secondary" size="md">
                {t("cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" size="md" loading={pending}>
              {pending ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
