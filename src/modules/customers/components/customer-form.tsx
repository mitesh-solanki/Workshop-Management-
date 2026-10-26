"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  createCustomerAction,
  updateCustomerAction,
  type CustomerActionState,
} from "@/app/actions/customers";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { sanitizePhoneTyping } from "@/lib/contact";
import { cn } from "@/lib/utils";

const initial: CustomerActionState = { ok: false };

type CustomerValues = {
  name: string;
  phone: string;
  address: string | null;
  notes: string | null;
};

type Props =
  | { mode: "create"; className?: string }
  | {
      mode: "edit";
      customerId: string;
      customer: CustomerValues;
      className?: string;
    };

export function CustomerForm(props: Props) {
  const t = useTranslations("customers");
  const boundUpdate = useMemo(() => {
    if (props.mode !== "edit") {
      return null;
    }
    return updateCustomerAction.bind(null, props.customerId);
  }, [props]);

  const [state, formAction, pending] = useActionState(
    props.mode === "create" ? createCustomerAction : boundUpdate!,
    initial,
  );
  const handledMessage = useRef<string | null>(null);

  useEffect(() => {
    if (!state.message || state.message === handledMessage.current) return;
    handledMessage.current = state.message;
    if (state.ok) {
      toast.success(state.message);
    } else {
      toast.error(state.message);
    }
  }, [state]);

  const defaults =
    props.mode === "edit"
      ? props.customer
      : { name: "", phone: "", address: null, notes: null };
  const [phone, setPhone] = useState(defaults.phone);

  return (
    <form
      action={formAction}
      className={cn("flex flex-col gap-5", props.className)}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="name" label={t("name")}>
          <Input
            id="name"
            name="name"
            defaultValue={defaults.name}
            required
            autoComplete="name"
            className="h-11 min-h-11"
          />
        </FormField>
        <FormField id="phone" label={t("phone")}>
          <Input
            id="phone"
            name="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(sanitizePhoneTyping(e.target.value))}
            required
            autoComplete="tel"
            inputMode="tel"
            className="h-11 min-h-11"
          />
        </FormField>
      </div>
      <FormField id="address" label={t("address")}>
        <Textarea
          id="address"
          name="address"
          defaultValue={defaults.address ?? ""}
          rows={3}
        />
      </FormField>
      <FormField id="notes" label={t("notes")}>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={defaults.notes ?? ""}
          rows={3}
        />
      </FormField>
      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button type="submit" size="md" loading={pending}>
          {pending
            ? t("saving")
            : props.mode === "create"
              ? t("create")
              : t("save")}
        </Button>
      </div>
    </form>
  );
}
