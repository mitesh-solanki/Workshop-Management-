"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import {
  createCustomerModalAction,
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
import { sanitizePhoneTyping } from "@/lib/contact";

const initial: CustomerActionState = { ok: false };

type Props = {
  /** Optional trigger; defaults to primary “Add customer” button. */
  trigger?: React.ReactNode;
  size?: "sm" | "md";
};

export function CreateCustomerModal({ trigger, size = "md" }: Props) {
  const t = useTranslations("customers");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [state, formAction, pending] = useActionState(
    createCustomerModalAction,
    initial,
  );
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!state.message || state.message === handled.current) return;
    handled.current = state.message;

    if (state.ok && state.customerId) {
      toast.success(state.message);
      // Navigate away — dialog unmounts with the list page.
      router.push(`/customers/${state.customerId}`);
      return;
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
        } else {
          setPhone("");
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
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle>{t("newTitle")}</DialogTitle>
          <DialogDescription>{t("newSubtitle")}</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4 px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="modal-name" label={t("name")}>
              <Input
                id="modal-name"
                name="name"
                required
                autoComplete="name"
                autoFocus
                className="h-11 min-h-11"
              />
            </FormField>
            <FormField id="modal-phone" label={t("phone")}>
              <Input
                id="modal-phone"
                name="phone"
                type="tel"
                required
                autoComplete="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(sanitizePhoneTyping(e.target.value))}
                className="h-11 min-h-11"
              />
            </FormField>
          </div>
          <FormField id="modal-address" label={t("address")}>
            <Textarea id="modal-address" name="address" rows={2} />
          </FormField>
          <FormField id="modal-notes" label={t("notes")}>
            <Textarea id="modal-notes" name="notes" rows={2} />
          </FormField>

          <DialogFooter className="gap-2 border-t border-border px-0 pt-4 sm:justify-end">
            <DialogClose asChild>
              <Button type="button" variant="secondary" size="md">
                {t("cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" size="md" loading={pending}>
              {pending ? t("saving") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
