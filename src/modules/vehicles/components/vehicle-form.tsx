"use client";

import { useActionState, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  createVehicleAction,
  updateVehicleAction,
  type VehicleActionState,
} from "@/app/actions/vehicles";

const initial: VehicleActionState = { ok: false };

const inputClass =
  "min-h-12 w-full rounded-md border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring";

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
    <form action={formAction} className="flex flex-col gap-4">
      {props.mode === "create" && (
        <input type="hidden" name="customerId" value={props.customerId} />
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="registrationNumber" className="text-sm font-medium">
          {t("registrationNumber")}
        </label>
        <input
          id="registrationNumber"
          name="registrationNumber"
          defaultValue={defaults.registrationNumber}
          required
          autoCapitalize="characters"
          className={inputClass}
        />
        <p className="text-xs text-muted-foreground">{t("registrationHint")}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="make" className="text-sm font-medium">
            {t("make")}
          </label>
          <input
            id="make"
            name="make"
            defaultValue={defaults.make}
            required
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="model" className="text-sm font-medium">
            {t("model")}
          </label>
          <input
            id="model"
            name="model"
            defaultValue={defaults.model}
            required
            className={inputClass}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="year" className="text-sm font-medium">
            {t("year")}
          </label>
          <input
            id="year"
            name="year"
            type="number"
            inputMode="numeric"
            min={1950}
            max={2100}
            defaultValue={defaults.year ?? ""}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="odometer" className="text-sm font-medium">
            {t("odometer")}
          </label>
          <input
            id="odometer"
            name="odometer"
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={defaults.odometer ?? ""}
            className={inputClass}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="insuranceExpiry" className="text-sm font-medium">
          {t("insuranceExpiry")}
        </label>
        <input
          id="insuranceExpiry"
          name="insuranceExpiry"
          type="date"
          defaultValue={toDateInput(defaults.insuranceExpiry)}
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="pucExpiry" className="text-sm font-medium">
          {t("pucExpiry")}
        </label>
        <input
          id="pucExpiry"
          name="pucExpiry"
          type="date"
          defaultValue={toDateInput(defaults.pucExpiry)}
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="fitnessExpiry" className="text-sm font-medium">
          {t("fitnessExpiry")}
        </label>
        <input
          id="fitnessExpiry"
          name="fitnessExpiry"
          type="date"
          defaultValue={toDateInput(defaults.fitnessExpiry)}
          className={inputClass}
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
