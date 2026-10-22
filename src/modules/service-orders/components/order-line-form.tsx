"use client";

import { useActionState, useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  addServiceOrderLineAction,
  type ServiceOrderActionState,
} from "@/app/actions/service-orders";
import { RupeePriceInput } from "@/components/rupee-price-input";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";

const initial: ServiceOrderActionState = { ok: false };

const selectClass =
  "h-11 min-h-11 w-full rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 md:text-sm";

type Props = {
  orderId: string;
};

export function OrderLineForm({ orderId }: Props) {
  const t = useTranslations("orders");
  const bound = useMemo(
    () => addServiceOrderLineAction.bind(null, orderId),
    [orderId],
  );
  const [state, formAction, pending] = useActionState(bound, initial);
  const handledMessage = useRef<string | null>(null);

  useEffect(() => {
    if (!state.message || state.message === handledMessage.current) return;
    handledMessage.current = state.message;
    if (state.ok) {
      toast.success(t("lineAdded"));
    } else {
      toast.error(state.message);
    }
  }, [state, t]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="type" label={t("lineType")}>
          <select
            id="type"
            name="type"
            required
            className={selectClass}
            defaultValue="LABOUR"
          >
            <option value="LABOUR">{t("lineTypes.LABOUR")}</option>
            <option value="PART">{t("lineTypes.PART")}</option>
          </select>
        </FormField>
        <FormField id="quantity" label={t("quantity")}>
          <Input
            id="quantity"
            name="quantity"
            type="number"
            inputMode="numeric"
            min={1}
            defaultValue={1}
            required
            className="h-11 min-h-11"
          />
        </FormField>
      </div>
      <FormField id="description" label={t("lineDescription")}>
        <Input
          id="description"
          name="description"
          required
          maxLength={500}
          className="h-11 min-h-11"
        />
      </FormField>
      <RupeePriceInput label={t("unitPrice")} hint={t("unitPriceHint")} />
      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button type="submit" variant="secondary" size="md" loading={pending}>
          {pending ? t("saving") : t("addLine")}
        </Button>
      </div>
    </form>
  );
}
