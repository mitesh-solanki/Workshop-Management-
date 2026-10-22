"use client";

import { useActionState, useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  createVehicleAction,
  updateVehicleAction,
  type VehicleActionState,
} from "@/app/actions/vehicles";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";

const initial: VehicleActionState = { ok: false };

function toDateInput(value: Date | string | null | undefined): string {
  if (!value) {
    return "";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}

type VehicleValues = {
  registrationNumber: string;
  make: string;
  model: string;
  year: number | null;
  odometer: number | null;
  insuranceExpiry: Date | string | null;
  pucExpiry: Date | string | null;
  fitnessExpiry: Date | string | null;
};

type Props =
  | { mode: "create"; customerId: string }
  | {
      mode: "edit";
      vehicleId: string;
      customerId: string;
      vehicle: VehicleValues;
    };

export function VehicleForm(props: Props) {
  const t = useTranslations("vehicles");
  const boundUpdate = useMemo(() => {
    if (props.mode !== "edit") {
      return null;
    }
    return updateVehicleAction.bind(null, props.vehicleId, props.customerId);
  }, [props]);

  const [state, formAction, pending] = useActionState(
    props.mode === "create" ? createVehicleAction : boundUpdate!,
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
      ? props.vehicle
      : {
          registrationNumber: "",
          make: "",
          model: "",
          year: null,
          odometer: null,
          insuranceExpiry: null,
          pucExpiry: null,
          fitnessExpiry: null,
        };

  return (
    <form action={formAction} className="flex w-full flex-col gap-5">
      {props.mode === "create" ? (
        <input type="hidden" name="customerId" value={props.customerId} />
      ) : null}

      <FormField
        id="registrationNumber"
        label={t("registrationNumber")}
        hint={t("registrationHint")}
      >
        <Input
          id="registrationNumber"
          name="registrationNumber"
          defaultValue={defaults.registrationNumber}
          required
          autoCapitalize="characters"
          className="h-11 min-h-11"
        />
      </FormField>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FormField id="make" label={t("make")}>
          <Input
            id="make"
            name="make"
            defaultValue={defaults.make}
            required
            className="h-11 min-h-11"
          />
        </FormField>
        <FormField id="model" label={t("model")}>
          <Input
            id="model"
            name="model"
            defaultValue={defaults.model}
            required
            className="h-11 min-h-11"
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FormField id="year" label={t("year")}>
          <Input
            id="year"
            name="year"
            type="number"
            inputMode="numeric"
            min={1950}
            max={2100}
            defaultValue={defaults.year ?? ""}
            className="h-11 min-h-11"
          />
        </FormField>
        <FormField id="odometer" label={t("odometerHint")}>
          <Input
            id="odometer"
            name="odometer"
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={defaults.odometer ?? ""}
            className="h-11 min-h-11"
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <FormField id="insuranceExpiry" label={t("insuranceExpiry")}>
          <Input
            id="insuranceExpiry"
            name="insuranceExpiry"
            type="date"
            defaultValue={toDateInput(defaults.insuranceExpiry)}
            className="h-11 min-h-11"
          />
        </FormField>
        <FormField id="pucExpiry" label={t("pucExpiry")}>
          <Input
            id="pucExpiry"
            name="pucExpiry"
            type="date"
            defaultValue={toDateInput(defaults.pucExpiry)}
            className="h-11 min-h-11"
          />
        </FormField>
        <FormField id="fitnessExpiry" label={t("fitnessExpiry")}>
          <Input
            id="fitnessExpiry"
            name="fitnessExpiry"
            type="date"
            defaultValue={toDateInput(defaults.fitnessExpiry)}
            className="h-11 min-h-11"
          />
        </FormField>
      </div>

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
