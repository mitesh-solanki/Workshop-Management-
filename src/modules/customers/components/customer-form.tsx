"use client";

import { useActionState, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  createCustomerAction,
  updateCustomerAction,
  type CustomerActionState,
} from "@/app/actions/customers";

const initial: CustomerActionState = { ok: false };

const inputClass =
  "min-h-12 w-full rounded-md border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring";

type CustomerValues = {
  name: string;
  phone: string;
  address: string | null;
  notes: string | null;
};

type Props =
  | { mode: "create" }
  | { mode: "edit"; customerId: string; customer: CustomerValues };

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

  const defaults =
    props.mode === "edit"
      ? props.customer
      : { name: "", phone: "", address: null, notes: null };

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium">
          {t("name")}
        </label>
        <input
          id="name"
          name="name"
          defaultValue={defaults.name}
          required
          autoComplete="name"
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="phone" className="text-sm font-medium">
          {t("phone")}
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={defaults.phone}
          required
          autoComplete="tel"
          inputMode="tel"
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="address" className="text-sm font-medium">
          {t("address")}
        </label>
        <textarea
          id="address"
          name="address"
          defaultValue={defaults.address ?? ""}
          rows={3}
          className={`${inputClass} min-h-24 py-3`}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="notes" className="text-sm font-medium">
          {t("notes")}
        </label>
        <textarea
          id="notes"
          name="notes"
          defaultValue={defaults.notes ?? ""}
          rows={3}
          className={`${inputClass} min-h-24 py-3`}
        />
      </div>
      {state.message && (
        <p
          className={
            state.ok ? "text-sm text-foreground" : "text-sm text-destructive"
          }
          role="status"
        >
          {state.ok ? t("saved") : state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-md bg-primary px-4 text-base font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending
          ? t("saving")
          : props.mode === "create"
            ? t("create")
            : t("save")}
      </button>
    </form>
  );
}
