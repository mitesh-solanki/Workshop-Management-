"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import {
  createServiceOrderAction,
  type ServiceOrderActionState,
} from "@/app/actions/service-orders";
import { SERVICE_ORDER_PRIORITIES } from "@/modules/service-orders/schema";

const initial: ServiceOrderActionState = { ok: false };

const inputClass =
  "min-h-12 w-full rounded-md border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring";

type TechnicianOption = {
  id: string;
  name: string | null;
  email: string;
};

type Props = {
  vehicleId: string;
  defaultOdometer: number | null;
  technicians: TechnicianOption[];
};

function toDateTimeLocal(value: Date | null | undefined): string {
  if (!value) {
    return "";
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

export function ServiceOrderForm({
  vehicleId,
  defaultOdometer,
  technicians,
}: Props) {
  const t = useTranslations("orders");
  const [state, formAction, pending] = useActionState(
    createServiceOrderAction,
    initial,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="complaint" className="text-sm font-medium">
          {t("complaint")}
        </label>
        <textarea
          id="complaint"
          name="complaint"
          required
          rows={4}
          className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="requestedServices" className="text-sm font-medium">
          {t("requestedServices")}
        </label>
        <textarea
          id="requestedServices"
          name="requestedServices"
          rows={3}
          placeholder={t("requestedServicesHint")}
          className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="odometerIn" className="text-sm font-medium">
            {t("odometerIn")}
          </label>
          <input
            id="odometerIn"
            name="odometerIn"
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={defaultOdometer ?? ""}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="expectedCompletion" className="text-sm font-medium">
            {t("expectedCompletion")}
          </label>
          <input
            id="expectedCompletion"
            name="expectedCompletion"
            type="datetime-local"
            defaultValue={toDateTimeLocal(null)}
            className={inputClass}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="technicianId" className="text-sm font-medium">
            {t("technician")}
          </label>
          <select
            id="technicianId"
            name="technicianId"
            className={inputClass}
            defaultValue=""
          >
            <option value="">{t("technicianUnassigned")}</option>
            {technicians.map((tech) => (
              <option key={tech.id} value={tech.id}>
                {tech.name?.trim() || tech.email}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="priority" className="text-sm font-medium">
            {t("priority")}
          </label>
          <select
            id="priority"
            name="priority"
            className={inputClass}
            defaultValue="NORMAL"
          >
            {SERVICE_ORDER_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {t(`priorities.${priority}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="bay" className="text-sm font-medium">
          {t("bay")}
        </label>
        <input
          id="bay"
          name="bay"
          maxLength={40}
          className={inputClass}
          placeholder={t("bayPlaceholder")}
        />
      </div>
      {state.message && !state.ok && (
        <p className="text-sm text-destructive" role="status">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-md bg-primary px-4 text-base font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? t("saving") : t("create")}
      </button>
    </form>
  );
}
