"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  createServiceOrderAction,
  updateServiceOrderAction,
  type ServiceOrderActionState,
} from "@/app/actions/service-orders";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { FormSelect } from "@/components/ui/form-select";
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

type TechnicianOption = {
  id: string;
  name: string | null;
  email: string;
};

export type BayOption = {
  id: string;
  name: string;
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
  bays: BayOption[];
  className?: string;
};

type EditProps = {
  mode: "edit";
  orderId: string;
  technicians: TechnicianOption[];
  bays: BayOption[];
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
  const router = useRouter();
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
      if (props.mode === "create" && state.orderId) {
        router.push(`/orders/${state.orderId}?section=inspection`);
      }
    } else {
      toast.error(state.message);
    }
  }, [state, props.mode, router]);

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

  const baySelectOptions = useMemo(() => {
    const knownNames = new Set(props.bays.map((bay) => bay.name));
    const options = props.bays.map((bay) => ({
      value: bay.name,
      label: bay.name,
    }));
    const assigned = defaults.bay.trim();
    if (assigned && !knownNames.has(assigned)) {
      options.unshift({ value: assigned, label: assigned });
    }
    return options;
  }, [props.bays, defaults.bay]);

  const currentStatus =
    props.mode === "edit" ? props.defaults.status : ("WAITING" as const);
  const nextStatuses = STATUS_TRANSITIONS[currentStatus];
  const statusOptions =
    props.mode === "edit"
      ? ([currentStatus, ...nextStatuses] as ServiceOrderStatusValue[])
      : [];

  const bayField = (
    <div className="space-y-2">
      {props.bays.length === 0 ? (
        <p className="text-caption text-slate-500">
          {t("baysEmptyHint")}{" "}
          <Link
            href="/bays"
            className="font-medium text-teal-700 underline-offset-4 hover:underline"
          >
            {t("goToBays")}
          </Link>
        </p>
      ) : null}
      <FormField id="bay" label={t("bay")}>
        <FormSelect
          id="bay"
          name="bay"
          defaultValue={defaults.bay}
          disabled={readOnly}
          placeholder={t("bayPlaceholder")}
          options={baySelectOptions}
        />
      </FormField>
    </div>
  );

  return (
    <form
      action={formAction}
      className={cn("flex flex-col gap-5", props.className)}
    >
      {props.mode === "create" ? (
        <input type="hidden" name="vehicleId" value={props.vehicleId} />
      ) : null}

      <div className="space-y-4">
        {props.mode === "edit" ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="locked-vehicle" label={t("vehicle")}>
                <Input
                  id="locked-vehicle"
                  value={`${props.locked.registrationNumber} · ${props.locked.vehicleLabel}`}
                  disabled
                  readOnly
                  className="h-11 min-h-11"
                />
              </FormField>
              <FormField id="locked-customer" label={t("customer")}>
                <Input
                  id="locked-customer"
                  value={props.locked.customerName}
                  disabled
                  readOnly
                  className="h-11 min-h-11"
                />
              </FormField>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {bayField}
              <FormField id="status" label={t("statusField")}>
                <FormSelect
                  id="status"
                  name="status"
                  defaultValue={currentStatus}
                  disabled={readOnly || nextStatuses.length === 0}
                  options={statusOptions.map((status) => ({
                    value: status,
                    label:
                      status === currentStatus
                        ? t(`statuses.${status}`)
                        : `${t(`statuses.${currentStatus}`)} → ${t(`statuses.${status}`)}`,
                  }))}
                />
              </FormField>
            </div>
            <p className="text-caption text-slate-500">
              {t("customerVehicleLocked")}
            </p>
          </>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">{bayField}</div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
            rows={4}
            placeholder={t("requestedServicesHint")}
            defaultValue={defaults.requestedServices}
            disabled={readOnly}
          />
        </FormField>
      </div>
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
          <FormSelect
            id="technicianId"
            name="technicianId"
            defaultValue={defaults.technicianId}
            disabled={readOnly}
            options={[
              { value: "", label: t("technicianUnassigned") },
              ...props.technicians.map((tech) => ({
                value: tech.id,
                label: tech.name?.trim() || tech.email,
              })),
            ]}
          />
        </FormField>
        <FormField id="priority" label={t("priority")}>
          <FormSelect
            id="priority"
            name="priority"
            defaultValue={defaults.priority || "NORMAL"}
            disabled={readOnly}
            options={SERVICE_ORDER_PRIORITIES.map((priority) => ({
              value: priority,
              label: t(`priorities.${priority}`),
            }))}
          />
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
