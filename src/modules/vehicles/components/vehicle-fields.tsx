"use client";

import { useTranslations } from "next-intl";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

export type VehicleFieldValues = {
  registrationNumber: string;
  make: string;
  model: string;
  year: number | null;
  odometer: number | null;
  insuranceExpiry: Date | string | null;
  pucExpiry: Date | string | null;
  fitnessExpiry: Date | string | null;
};

export function toDateInput(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

type Props = {
  idPrefix: string;
  defaults?: Partial<VehicleFieldValues>;
  /** Hide customerId field (edit mode). */
  customerId?: string;
};

/** Shared create/edit vehicle fields for forms and modals. */
export function VehicleFields({ idPrefix, defaults = {}, customerId }: Props) {
  const t = useTranslations("vehicles");

  return (
    <>
      {customerId ? (
        <input type="hidden" name="customerId" value={customerId} />
      ) : null}

      <FormField
        id={`${idPrefix}-registration`}
        label={t("registrationNumber")}
        hint={t("registrationHint")}
      >
        <Input
          id={`${idPrefix}-registration`}
          name="registrationNumber"
          defaultValue={defaults.registrationNumber ?? ""}
          required
          autoCapitalize="characters"
          className="h-11 min-h-11"
        />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField id={`${idPrefix}-make`} label={t("make")}>
          <Input
            id={`${idPrefix}-make`}
            name="make"
            defaultValue={defaults.make ?? ""}
            required
            className="h-11 min-h-11"
          />
        </FormField>
        <FormField id={`${idPrefix}-model`} label={t("model")}>
          <Input
            id={`${idPrefix}-model`}
            name="model"
            defaultValue={defaults.model ?? ""}
            required
            className="h-11 min-h-11"
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField id={`${idPrefix}-year`} label={t("year")}>
          <Input
            id={`${idPrefix}-year`}
            name="year"
            type="number"
            inputMode="numeric"
            min={1950}
            max={2100}
            defaultValue={defaults.year ?? ""}
            className="h-11 min-h-11"
          />
        </FormField>
        <FormField id={`${idPrefix}-odometer`} label={t("odometerHint")}>
          <Input
            id={`${idPrefix}-odometer`}
            name="odometer"
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={defaults.odometer ?? ""}
            className="h-11 min-h-11"
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField id={`${idPrefix}-insurance`} label={t("insuranceExpiry")}>
          <Input
            id={`${idPrefix}-insurance`}
            name="insuranceExpiry"
            type="date"
            defaultValue={toDateInput(defaults.insuranceExpiry)}
            className="h-11 min-h-11"
          />
        </FormField>
        <FormField id={`${idPrefix}-puc`} label={t("pucExpiry")}>
          <Input
            id={`${idPrefix}-puc`}
            name="pucExpiry"
            type="date"
            defaultValue={toDateInput(defaults.pucExpiry)}
            className="h-11 min-h-11"
          />
        </FormField>
        <FormField id={`${idPrefix}-fitness`} label={t("fitnessExpiry")}>
          <Input
            id={`${idPrefix}-fitness`}
            name="fitnessExpiry"
            type="date"
            defaultValue={toDateInput(defaults.fitnessExpiry)}
            className="h-11 min-h-11"
          />
        </FormField>
      </div>
    </>
  );
}
