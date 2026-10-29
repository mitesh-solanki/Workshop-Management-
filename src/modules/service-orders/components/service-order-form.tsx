"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
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
import { BaySearchSelect } from "@/modules/bays/components/bay-search-select";
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
  /** When set, technician field is fixed to this id (technician self-assign). */
  lockTechnicianId?: string;
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
  /** Mechanic job card: vehicle, bay, odometer, status, complaint, requested services. */
  technicianFieldsOnly?: boolean;
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

function TechnicianReadField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-[15px] font-medium text-slate-900">
        {value}
      </dd>
    </div>
  );
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

  const lockTechnicianId =
    props.mode === "create" ? props.lockTechnicianId : undefined;

  const defaults =
    props.mode === "edit"
      ? props.defaults
      : {
          complaint: "",
          requestedServices: "",
          odometerIn: props.defaultOdometer,
          expectedCompletion: "",
          technicianId: lockTechnicianId ?? "",
          bay: "",
          priority: "NORMAL",
          status: "WAITING" as const,
        };

  const [bay, setBay] = useState(defaults.bay);

  const currentStatus =
    props.mode === "edit" ? props.defaults.status : ("WAITING" as const);
  const nextStatuses = STATUS_TRANSITIONS[currentStatus];
  const statusOptions =
    props.mode === "edit"
      ? ([currentStatus, ...nextStatuses] as ServiceOrderStatusValue[])
      : [];

  const technicianFieldsOnly =
    props.mode === "edit" && Boolean(props.technicianFieldsOnly);

  if (technicianFieldsOnly && readOnly && props.mode === "edit") {
    const unset = t("notSet");
    const vehicleLabel = `${props.locked.registrationNumber} · ${props.locked.vehicleLabel}`;
    const odometer =
      defaults.odometerIn == null ? unset : String(defaults.odometerIn);
    const bayLabel = defaults.bay.trim() || unset;
    const complaint = defaults.complaint.trim() || unset;
    const requested = defaults.requestedServices.trim() || unset;

    return (
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <TechnicianReadField label={t("vehicle")} value={vehicleLabel} />
        <TechnicianReadField
          label={t("statusField")}
          value={t(`statuses.${currentStatus}`)}
        />
        <TechnicianReadField label={t("bay")} value={bayLabel} />
        <TechnicianReadField label={t("odometerIn")} value={odometer} />
        <TechnicianReadField label={t("complaint")} value={complaint} />
        <TechnicianReadField
          label={t("requestedServices")}
          value={requested}
        />
      </dl>
    );
  }

  const bayField = (
    <div className="space-y-2">
      {props.bays.length === 0 && !technicianFieldsOnly ? (
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
        <BaySearchSelect
          id="bay"
          name="bay"
          value={bay}
          onChange={setBay}
          bays={props.bays}
          valueKey="name"
          disabled={readOnly}
          orphanValue={defaults.bay}
          placeholder={t("bayPlaceholder")}
          searchPlaceholder={t("baySearchPlaceholder")}
          emptyLabel={t("bayEmptyOptions")}
        />
      </FormField>
    </div>
  );

  const statusField =
    props.mode === "edit" ? (
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
    ) : null;

  return (
    <form
      action={formAction}
      className={cn("flex flex-col gap-5", props.className)}
    >
      {props.mode === "create" ? (
        <input type="hidden" name="vehicleId" value={props.vehicleId} />
      ) : null}

      {technicianFieldsOnly && props.mode === "edit" ? (
        <>
          <input
            type="hidden"
            name="expectedCompletion"
            value={defaults.expectedCompletion}
          />
          <input
            type="hidden"
            name="technicianId"
            value={defaults.technicianId}
          />
          <input
            type="hidden"
            name="priority"
            value={defaults.priority || "NORMAL"}
          />
          <div className="space-y-4">
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
              {statusField}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {bayField}
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
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="complaint" label={t("complaint")}>
                <Textarea
                  id="complaint"
                  name="complaint"
                  required
                  rows={4}
                  defaultValue={defaults.complaint}
                  disabled={readOnly}
                />
              </FormField>
              <FormField id="requestedServices" label={t("requestedServices")}>
                <Textarea
                  id="requestedServices"
                  name="requestedServices"
                  rows={4}
                  defaultValue={defaults.requestedServices}
                  disabled={readOnly}
                />
              </FormField>
            </div>
          </div>
        </>
      ) : (
        <>
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
                  {statusField}
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
            <FormField id="requestedServices" label={t("requestedServices")}>
              <Textarea
                id="requestedServices"
                name="requestedServices"
                rows={4}
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
              {lockTechnicianId ? (
                <>
                  <input
                    type="hidden"
                    name="technicianId"
                    value={lockTechnicianId}
                  />
                  <Input
                    id="technicianId"
                    value={
                      props.technicians.find(
                        (tech) => tech.id === lockTechnicianId,
                      )?.name?.trim() ||
                      props.technicians.find(
                        (tech) => tech.id === lockTechnicianId,
                      )?.email ||
                      t("technicianSelf")
                    }
                    disabled
                    readOnly
                    className="h-11 min-h-11"
                  />
                </>
              ) : (
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
              )}
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
        </>
      )}
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
