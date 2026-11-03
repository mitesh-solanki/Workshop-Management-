"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  addServiceOrderLineAction,
  type ServiceOrderActionState,
} from "@/app/actions/service-orders";
import { RupeePriceInput } from "@/components/rupee-price-input";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { toast } from "@/components/ui/toast";
import { NoteSuggestInput } from "@/modules/inspections/components/note-suggest-input";

const initial: ServiceOrderActionState = { ok: false };

type Props = {
  orderId: string;
};

export function OutsideWorkForm({ orderId }: Props) {
  const t = useTranslations("orders");
  const bound = useMemo(
    () => addServiceOrderLineAction.bind(null, orderId),
    [orderId],
  );
  const [state, formAction, pending] = useActionState(bound, initial);
  const wasPending = useRef(false);
  const [formKey, setFormKey] = useState(0);
  const [description, setDescription] = useState("");

  useEffect(() => {
    const finished = wasPending.current && !pending;
    wasPending.current = pending;
    if (!finished || !state.message) return;

    if (state.ok) {
      toast.success(t("outsideWorkAdded"));
      setDescription("");
      setFormKey((key) => key + 1);
      return;
    }
    toast.error(state.message);
  }, [pending, state, t]);

  return (
    <form key={formKey} action={formAction} className="space-y-2">
      <input type="hidden" name="type" value="OUTSIDE" />
      <input type="hidden" name="partId" value="" />
      <input type="hidden" name="quantity" value="1" />
      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_9.5rem_auto]">
        <FormField id="outside-work-description" label={t("lineDescription")}>
          <NoteSuggestInput
            id="outside-work-description"
            name="description"
            required
            maxLength={500}
            value={description}
            suggestionMode="outsideWork"
            onValueChange={setDescription}
            placeholder={t("outsideWorkDescriptionPlaceholder")}
            className="rounded-lg border-slate-300 text-[14px] shadow-xs focus-visible:border-blue-600 focus-visible:ring-blue-600/25"
          />
        </FormField>

        <RupeePriceInput
          id="outside-work-unit-price"
          name="unitPriceRupees"
          label={t("outsideWorkAmount")}
          hint=""
          defaultPaise={0}
          inputClassName="h-11 min-h-11 rounded-lg border-slate-300 text-[14px] shadow-xs focus-visible:border-blue-600 focus-visible:ring-blue-600/25"
        />

        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={pending}
          className="h-11 min-h-11 gap-1.5 px-4"
        >
          <Plus className="size-4" strokeWidth={2.5} />
          {t("addLineAction")}
        </Button>
      </div>
    </form>
  );
}
