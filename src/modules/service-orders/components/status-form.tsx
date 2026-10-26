"use client";

import { useActionState, useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  changeServiceOrderStatusAction,
  type ServiceOrderActionState,
} from "@/app/actions/service-orders";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { FormSelect } from "@/components/ui/form-select";
import { toast } from "@/components/ui/toast";
import {
  STATUS_TRANSITIONS,
  type ServiceOrderStatusValue,
} from "@/modules/service-orders/schema";

const initial: ServiceOrderActionState = { ok: false };

type Props = {
  orderId: string;
  currentStatus: ServiceOrderStatusValue;
  disabled?: boolean;
};

/** Status lives on the details form — not a separate job-card section. */
export function StatusForm({
  orderId,
  currentStatus,
  disabled = false,
}: Props) {
  const t = useTranslations("orders");
  const bound = useMemo(
    () => changeServiceOrderStatusAction.bind(null, orderId),
    [orderId],
  );
  const [state, formAction, pending] = useActionState(bound, initial);
  const nextStatuses = STATUS_TRANSITIONS[currentStatus];
  const handledMessage = useRef<string | null>(null);

  useEffect(() => {
    if (!state.message || state.message === handledMessage.current) return;
    handledMessage.current = state.message;
    if (state.ok) {
      toast.success(t("statusUpdated"));
    } else {
      toast.error(state.message);
    }
  }, [state, t]);

  if (nextStatuses.length === 0 || disabled) {
    return (
      <FormField id={`status-${orderId}`} label={t("statusField")}>
        <FormSelect
          id={`status-${orderId}`}
          value={currentStatus}
          disabled
          options={[
            {
              value: currentStatus,
              label: t(`statuses.${currentStatus}`),
            },
          ]}
        />
      </FormField>
    );
  }

  return (
    <form
      action={formAction}
      className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
    >
      <FormField
        id={`status-${orderId}`}
        label={t("statusField")}
        hint={t("changeStatus")}
      >
        <FormSelect
          id={`status-${orderId}`}
          name="status"
          required
          defaultValue={nextStatuses[0]}
          disabled={pending}
          options={nextStatuses.map((status) => ({
            value: status,
            label: `${t(`statuses.${currentStatus}`)} → ${t(`statuses.${status}`)}`,
          }))}
        />
      </FormField>
      <Button type="submit" size="md" loading={pending} className="shrink-0">
        {pending ? t("saving") : t("updateStatus")}
      </Button>
    </form>
  );
}
