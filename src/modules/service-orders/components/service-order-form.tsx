"use client";

import { useActionState, useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  createServiceOrderAction,
  updateServiceOrderAction,
  type ServiceOrderActionState,
} from "@/app/actions/service-orders";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  SERVICE_ORDER_PRIORITIES,
  STATUS_TRANSITIONS,
  type ServiceOrderStatusValue,
} from "@/modules/service-orders/schema";

const initial: ServiceOrderActionState = { ok: false };

const selectClass =
  "h-11 min-h-11 w-full rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/40 md:text-sm";

type TechnicianOption = {
  id: string;
  name: string | null;
  email: string;
};

type LockedContext = {
  customerName: string;
  registrationNumber: string;
  vehicleLabel: string;
};

type CreateProps = {
  mode: "create";
  vehicleId: string;
  defaultOdometer: number | null;
  technicians: TechnicianOption[];
  locked: LockedContext;
  className?: string;
};

type EditProps = {
  mode: "edit";
  orderId: string;
  technicians: TechnicianOption[];
  locked: LockedContext;
  defaults: {
    complaint: string;
    requestedServices: string;
    odometerIn: number | null;
    expectedCompletion: string;
    technicianId: string;
    bay: string;
    priority: string;
    status: ServiceOrderStatusValue;
  };
  canEdit: boolean;
  className?: string;
};

type Props = CreateProps | EditProps;

function toDatetimeLocalValue(value: Date | string | null): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function datetimeLocalFromOrder(
  value: Date | string | null,
): string {
  return toDatetimeLocalValue(value);
}

export function ServiceOrderForm(props: Props) {
  const t = useTranslations("orders");
  const orderId = props.mode === "edit" ? props.orderId : null;
  const action = useMemo(() => {
    if (props.mode === "create" || !orderId) {
      return createServiceOrderAction;
    }
    return updateServiceOrderAction.bind(null, orderId);
  }, [props.mode, orderId]);
  const [state, formAction, pending] = useActionState(action, initial);
  const handledMessage = useRef<string | null>(null);
  const readOnly = props.mode === "edit" && !props.canEdit;

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
      ? props.defaults
      : {
          complaint: "",
          requestedServices: "",
          odometerIn: props.defaultOdometer,
          expectedCompletion: "",
          technicianId: "",
          bay: "",
          priority: "NORMAL",
          status: "WAITING" as const,
        };

  const currentStatus =
    props.mode === "edit" ? props.defaults.status : ("WAITING" as const);
  const nextStatuses = STATUS_TRANSITIONS[currentStatus];
  const statusOptions =
    props.mode === "edit"
      ? ([currentStatus, ...nextStatuses] as ServiceOrderStatusValue[])
      : [];

  return (
    <form
      action={formAction}
      className={cn("flex flex-col gap-5", props.className)}
    >
      {props.mode === "create" ? (
        <input type="hidden" name="vehicleId" value={props.vehicleId} />
      ) : null}

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="locked-customer" label={t("customer")}>
            <Input
              id="locked-customer"
              value={props.locked.customerName}
              disabled
              readOnly
              className="h-11 min-h-11"
            />
          </FormField>
          <FormField id="locked-vehicle" label={t("vehicle")}>
            <Input
              id="locked-vehicle"
              value={`${props.locked.registrationNumber} · ${props.locked.vehicleLabel}`}
              disabled
              readOnly
              className="h-11 min-h-11"
            />
          </FormField>
        </div>

        {props.mode === "edit" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="bay" label={t("bay")}>
              <Input
                id="bay"
                name="bay"
                maxLength={40}
                placeholder={t("bayPlaceholder")}
                defaultValue={defaults.bay}
                disabled={readOnly}
                className="h-11 min-h-11"
              />
            </FormField>
            <FormField id="status" label={t("statusField")}>
              <select
                id="status"
                name="status"
                className={selectClass}
                defaultValue={currentStatus}
                disabled={readOnly || nextStatuses.length === 0}
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status === currentStatus
                      ? t(`statuses.${status}`)
                      : `${t(`statuses.${currentStatus}`)} → ${t(`statuses.${status}`)}`}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        ) : (
          <FormField id="bay" label={t("bay")}>
            <Input
              id="bay"
              name="bay"
              maxLength={40}
              placeholder={t("bayPlaceholder")}
              defaultValue={defaults.bay}
              disabled={readOnly}
              className="h-11 min-h-11"
            />
          </FormField>
        )}

        {props.mode === "edit" ? (
          <p className="text-caption text-slate-500">
            {t("customerVehicleLocked")}
          </p>
        ) : null}
      </div>

      <FormField id="complaint" label={t("complaint")}>
        <Textarea
          id="complaint"
          name="complaint"
          required
          rows={4}
          autoFocus={props.mode === "create"}
          defaultValue={defaults.complaint}
          disabled={readOnly}
        />
      </FormField>
      <FormField
        id="requestedServices"
        label={t("requestedServices")}
        hint={t("requestedServicesHint")}
      >
        <Textarea
          id="requestedServices"
          name="requestedServices"
          rows={3}
          placeholder={t("requestedServicesHint")}
          defaultValue={defaults.requestedServices}
          disabled={readOnly}
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="odometerIn" label={t("odometerIn")}>
          <Input
            id="odometerIn"
            name="odometerIn"
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={defaults.odometerIn ?? ""}
            disabled={readOnly}
            className="h-11 min-h-11"
          />
        </FormField>
        <FormField id="expectedCompletion" label={t("expectedCompletion")}>
          <Input
            id="expectedCompletion"
            name="expectedCompletion"
            type="datetime-local"
            defaultValue={defaults.expectedCompletion}
            disabled={readOnly}
            className="h-11 min-h-11"
          />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="technicianId" label={t("technician")}>
          <select
            id="technicianId"
            name="technicianId"
            className={selectClass}
            defaultValue={defaults.technicianId}
            disabled={readOnly}
          >
            <option value="">{t("technicianUnassigned")}</option>
            {props.technicians.map((tech) => (
              <option key={tech.id} value={tech.id}>
                {tech.name?.trim() || tech.email}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="priority" label={t("priority")}>
          <select
            id="priority"
            name="priority"
            className={selectClass}
            defaultValue={defaults.priority || "NORMAL"}
            disabled={readOnly}
          >
            {SERVICE_ORDER_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {t(`priorities.${priority}`)}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      {!readOnly ? (
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button type="submit" size="md" loading={pending}>
            {pending
              ? t("saving")
              : props.mode === "create"
                ? t("create")
                : t("save")}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
