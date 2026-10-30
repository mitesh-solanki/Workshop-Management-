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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { BaySearchSelect } from "@/modules/bays/components/bay-search-select";
import {
  SERVICE_ORDER_PRIORITIES,
  STATUS_TRANSITIONS,
  type ServiceOrderStatusValue,
} from "@/modules/service-orders/schema";
import { technicianDisplayName } from "@/modules/service-orders/technicians";

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
  makeModel?: string;
};

type CreateProps = {
  mode: "create";
  vehicleId: string;
  defaultOdometer: number | null;
  /** Prefill from linked inspection when creating a job card. */
  defaultExpectedCompletion?: string;
  technicians: TechnicianOption[];
  bays: BayOption[];
  /** When set, technician field is fixed to this id (technician self-assign). */
  lockTechnicianId?: string;
  /** Link this standalone inspection after the job card is created. */
  inspectionId?: string;
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
    technicianIds: string[];
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
        router.push(`/orders/${state.orderId}`);
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
          expectedCompletion: props.defaultExpectedCompletion ?? "",
          technicianIds: lockTechnicianId ? [lockTechnicianId] : [],
          bay: "",
          priority: "NORMAL",
          status: "WAITING" as const,
        };

  const [bay, setBay] = useState(defaults.bay);
  const [technicianIds, setTechnicianIds] = useState<string[]>(
    defaults.technicianIds,
  );
  const [technicianQuery, setTechnicianQuery] = useState("");

  const allTechnicianOptions = useMemo(
    () =>
      props.technicians
        .map((tech) => {
          const label = technicianDisplayName(tech);
          if (!label) return null;
          return {
            value: tech.id,
            label,
            keywords: `${tech.name ?? ""} ${tech.email}`,
          };
        })
        .filter(
          (option): option is { value: string; label: string; keywords: string } =>
            option != null,
        ),
    [props.technicians],
  );

  const technicianOptions = useMemo(() => {
    const q = technicianQuery.trim().toLowerCase();
    if (!q) return allTechnicianOptions;
    return allTechnicianOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q) ||
        opt.keywords.toLowerCase().includes(q),
    );
  }, [allTechnicianOptions, technicianQuery]);

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
    const odometer =
      defaults.odometerIn == null ? unset : String(defaults.odometerIn);
    const bayLabel = defaults.bay.trim() || unset;

    return (
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <TechnicianReadField
          label={t("vehicle")}
          value={`${props.locked.registrationNumber} · ${props.locked.customerName}`}
        />
        <TechnicianReadField
          label={t("statusField")}
          value={t(`statuses.${currentStatus}`)}
        />
        <TechnicianReadField label={t("bay")} value={bayLabel} />
        <TechnicianReadField label={t("odometerIn")} value={odometer} />
      </dl>
    );
  }

  const vehicleField =
    props.mode === "edit" ? (
      <FormField id="locked-vehicle" label={t("vehicle")}>
        <Input
          id="locked-vehicle"
          value={
            technicianFieldsOnly
              ? `${props.locked.registrationNumber} · ${props.locked.customerName}`
              : props.locked.registrationNumber
          }
          disabled
          readOnly
          className="h-11 min-h-11"
        />
      </FormField>
    ) : null;

  const customerField =
    props.mode === "edit" ? (
      <FormField id="locked-customer" label={t("customer")}>
        <Input
          id="locked-customer"
          value={props.locked.customerName}
          disabled
          readOnly
          className="h-11 min-h-11"
        />
      </FormField>
    ) : null;

  const expectedCompletionField = (
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
  );

  const technicianField = (
    <FormField id="technicianIds" label={t("technicians")}>
      {lockTechnicianId ? (
        <>
          <input
            type="hidden"
            name="technicianIds"
            value={lockTechnicianId}
          />
          <Input
            id="technicianIds"
            value={
              technicianDisplayName(
                props.technicians.find(
                  (tech) => tech.id === lockTechnicianId,
                ) ?? { name: null, email: "" },
              ) || t("technicianSelf")
            }
            disabled
            readOnly
            className="h-11 min-h-11"
          />
        </>
      ) : (
        <SearchableSelect
          id="technicianIds"
          name="technicianIds"
          mode="multiple"
          values={technicianIds}
          onChange={setTechnicianIds}
          options={technicianOptions}
          filter="remote"
          minQueryLength={0}
          onQueryChange={setTechnicianQuery}
          onOpenChange={(open) => {
            if (!open) setTechnicianQuery("");
          }}
          clearable
          disabled={readOnly}
          noun={t("techniciansSelectedNoun")}
          placeholder={t("techniciansPlaceholder")}
          searchPlaceholder={t("techniciansSearchPlaceholder")}
          emptyLabel={t("techniciansEmpty")}
        />
      )}
    </FormField>
  );

  const odometerField = (
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
  );

  const priorityField = (
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
  );

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
        <>
          <input type="hidden" name="vehicleId" value={props.vehicleId} />
          {props.inspectionId ? (
            <input
              type="hidden"
              name="inspectionId"
              value={props.inspectionId}
            />
          ) : null}
        </>
      ) : null}

      {technicianFieldsOnly && props.mode === "edit" ? (
        <>
          <input
            type="hidden"
            name="expectedCompletion"
            value={defaults.expectedCompletion}
          />
          {defaults.technicianIds.map((id) => (
            <input key={id} type="hidden" name="technicianIds" value={id} />
          ))}
          <input
            type="hidden"
            name="priority"
            value={defaults.priority || "NORMAL"}
          />
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {vehicleField}
              {statusField}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {bayField}
              {odometerField}
            </div>
            <input type="hidden" name="complaint" value={defaults.complaint} />
            <input
              type="hidden"
              name="requestedServices"
              value={defaults.requestedServices}
            />
          </div>
        </>
      ) : (
        <>
          <input type="hidden" name="complaint" value={defaults.complaint} />
          <input
            type="hidden"
            name="requestedServices"
            value={defaults.requestedServices}
          />
          <div className="space-y-4">
            {props.mode === "edit" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {vehicleField}
                {customerField}
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              {expectedCompletionField}
              {props.mode === "edit" ? statusField : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {bayField}
              {technicianField}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {odometerField}
              {priorityField}
            </div>
          </div>
        </>
      )}
      {!readOnly ? (
        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
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
