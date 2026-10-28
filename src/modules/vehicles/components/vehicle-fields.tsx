"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { GST_STATE_CODES } from "@/lib/gstin";
import {
  DEFAULT_VEHICLE_STATE_CODE,
  getVehicleYearMax,
  isValidVehicleOdometerInput,
  isValidVehicleYearInput,
  normaliseRegistration,
  sanitizeOdometerTyping,
  sanitizeYearTyping,
  VEHICLE_ODOMETER_MAX,
  VEHICLE_YEAR_MIN,
} from "@/modules/vehicles/schema";

export type VehicleFieldValues = {
  registrationNumber: string;
  make: string;
  model: string;
  stateCode: string;
  year: number | null;
  odometer: number | null;
  insuranceExpiry: Date | string | null;
  pucExpiry: Date | string | null;
  fitnessExpiry: Date | string | null;
};

export type VehicleFormFieldErrors = {
  registrationNumber?: string;
  make?: string;
  model?: string;
  year?: string;
  odometer?: string;
};

export function toDateInput(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

type FormState = {
  registrationNumber: string;
  make: string;
  model: string;
  stateCode: string;
  year: string;
  odometer: string;
  insuranceExpiry: string;
  pucExpiry: string;
  fitnessExpiry: string;
};

function toFormState(defaults: Partial<VehicleFieldValues> = {}): FormState {
  return {
    registrationNumber: defaults.registrationNumber ?? "",
    make: defaults.make ?? "",
    model: defaults.model ?? "",
    stateCode: defaults.stateCode ?? DEFAULT_VEHICLE_STATE_CODE,
    year: defaults.year != null ? String(defaults.year) : "",
    odometer: defaults.odometer != null ? String(defaults.odometer) : "",
    insuranceExpiry: toDateInput(defaults.insuranceExpiry),
    pucExpiry: toDateInput(defaults.pucExpiry),
    fitnessExpiry: toDateInput(defaults.fitnessExpiry),
  };
}

type Props = {
  idPrefix: string;
  defaults?: Partial<VehicleFieldValues>;
  /** Hide customerId field (edit mode). */
  customerId?: string;
  fieldErrors?: VehicleFormFieldErrors;
  onFieldErrorsChange?: (errors: VehicleFormFieldErrors) => void;
};

/** Shared create/edit vehicle fields for forms and modals. */
export function VehicleFields({
  idPrefix,
  defaults = {},
  customerId,
  fieldErrors = {},
  onFieldErrorsChange,
}: Props) {
  const t = useTranslations("vehicles");
  const te = useTranslations("errors");
  const tGst = useTranslations("gst");
  const yearMax = getVehicleYearMax();
  const [values, setValues] = useState(() => toFormState(defaults));

  const stateOptions = useMemo(
    () =>
      GST_STATE_CODES.map((code) => ({
        value: code,
        label: tGst(`states.${code}`),
        keywords: code,
      })),
    [tGst],
  );

  function clearError(key: keyof VehicleFormFieldErrors) {
    if (!onFieldErrorsChange || !fieldErrors[key]) return;
    const next = { ...fieldErrors };
    delete next[key];
    onFieldErrorsChange(next);
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (
      key === "registrationNumber" ||
      key === "make" ||
      key === "model" ||
      key === "year" ||
      key === "odometer"
    ) {
      clearError(key);
    }
  }

  function setYearValue(next: string) {
    const sanitized = sanitizeYearTyping(next);
    setValues((prev) => ({ ...prev, year: sanitized }));
    if (!onFieldErrorsChange) return;
    if (!sanitized || isValidVehicleYearInput(sanitized)) {
      clearError("year");
      return;
    }
    onFieldErrorsChange({
      ...fieldErrors,
      year: te("validation.invalidYear", {
        min: VEHICLE_YEAR_MIN,
        max: yearMax,
      }),
    });
  }

  function setOdometerValue(next: string) {
    const sanitized = sanitizeOdometerTyping(next);
    setValues((prev) => ({ ...prev, odometer: sanitized }));
    if (!onFieldErrorsChange) return;
    if (!sanitized || isValidVehicleOdometerInput(sanitized)) {
      clearError("odometer");
      return;
    }
    onFieldErrorsChange({
      ...fieldErrors,
      odometer: te("validation.invalidOdometer", {
        max: VEHICLE_ODOMETER_MAX.toLocaleString("en-IN"),
      }),
    });
  }

  function validateYearOdometerOnBlur() {
    if (!onFieldErrorsChange) return;
    const next: VehicleFormFieldErrors = { ...fieldErrors };
    if (values.year && !isValidVehicleYearInput(values.year)) {
      next.year = te("validation.invalidYear", {
        min: VEHICLE_YEAR_MIN,
        max: yearMax,
      });
    }
    if (values.odometer && !isValidVehicleOdometerInput(values.odometer)) {
      next.odometer = te("validation.invalidOdometer", {
        max: VEHICLE_ODOMETER_MAX.toLocaleString("en-IN"),
      });
    }
    onFieldErrorsChange(next);
  }

  return (
    <>
      {customerId ? (
        <input type="hidden" name="customerId" value={customerId} />
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          id={`${idPrefix}-registration`}
          label={t("registrationNumber")}
          error={fieldErrors.registrationNumber}
        >
          <Input
            id={`${idPrefix}-registration`}
            name="registrationNumber"
            value={values.registrationNumber}
            onChange={(e) =>
              setField("registrationNumber", e.target.value.toUpperCase())
            }
            required
            autoCapitalize="characters"
            aria-invalid={Boolean(fieldErrors.registrationNumber)}
            className="h-11 min-h-11"
          />
        </FormField>

        <FormField
          id={`${idPrefix}-state`}
          label={t("state")}
          hint={t("stateHint")}
        >
          <SearchableSelect
            id={`${idPrefix}-state`}
            name="stateCode"
            value={values.stateCode}
            onChange={(code) => setField("stateCode", code)}
            options={stateOptions}
            clearable={false}
            placeholder={t("statePlaceholder")}
            searchPlaceholder={t("stateSearchPlaceholder")}
            emptyLabel={t("stateEmpty")}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          id={`${idPrefix}-make`}
          label={t("make")}
          error={fieldErrors.make}
        >
          <Input
            id={`${idPrefix}-make`}
            name="make"
            value={values.make}
            onChange={(e) => setField("make", e.target.value)}
            required
            aria-invalid={Boolean(fieldErrors.make)}
            className="h-11 min-h-11"
          />
        </FormField>
        <FormField
          id={`${idPrefix}-model`}
          label={t("model")}
          error={fieldErrors.model}
        >
          <Input
            id={`${idPrefix}-model`}
            name="model"
            value={values.model}
            onChange={(e) => setField("model", e.target.value)}
            required
            aria-invalid={Boolean(fieldErrors.model)}
            className="h-11 min-h-11"
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          id={`${idPrefix}-year`}
          label={t("year")}
          error={fieldErrors.year}
        >
          <Input
            id={`${idPrefix}-year`}
            name="year"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder={t("yearPlaceholder")}
            maxLength={4}
            value={values.year}
            onChange={(e) => setYearValue(e.target.value)}
            onBlur={validateYearOdometerOnBlur}
            aria-invalid={Boolean(fieldErrors.year)}
            className="h-11 min-h-11"
          />
        </FormField>
        <FormField
          id={`${idPrefix}-odometer`}
          label={t("odometerHint")}
          error={fieldErrors.odometer}
        >
          <Input
            id={`${idPrefix}-odometer`}
            name="odometer"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder={t("odometerPlaceholder")}
            maxLength={6}
            value={values.odometer}
            onChange={(e) => setOdometerValue(e.target.value)}
            onBlur={validateYearOdometerOnBlur}
            aria-invalid={Boolean(fieldErrors.odometer)}
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
            value={values.insuranceExpiry}
            onChange={(e) => setField("insuranceExpiry", e.target.value)}
            className="h-11 min-h-11"
          />
        </FormField>
        <FormField id={`${idPrefix}-puc`} label={t("pucExpiry")}>
          <Input
            id={`${idPrefix}-puc`}
            name="pucExpiry"
            type="date"
            value={values.pucExpiry}
            onChange={(e) => setField("pucExpiry", e.target.value)}
            className="h-11 min-h-11"
          />
        </FormField>
        <FormField id={`${idPrefix}-fitness`} label={t("fitnessExpiry")}>
          <Input
            id={`${idPrefix}-fitness`}
            name="fitnessExpiry"
            type="date"
            value={values.fitnessExpiry}
            onChange={(e) => setField("fitnessExpiry", e.target.value)}
            className="h-11 min-h-11"
          />
        </FormField>
      </div>
    </>
  );
}

/** Client validation matching customer modal: required + year/km with red errors. */
export function validateVehicleFormFields(
  form: HTMLFormElement,
  messages: {
    required: string;
    registrationTooShort: string;
    invalidYear: string;
    invalidOdometer: string;
  },
): VehicleFormFieldErrors {
  const data = new FormData(form);
  const registrationNumber = String(
    data.get("registrationNumber") ?? "",
  ).trim();
  const make = String(data.get("make") ?? "").trim();
  const model = String(data.get("model") ?? "").trim();
  const year = String(data.get("year") ?? "").trim();
  const odometer = String(data.get("odometer") ?? "").trim();
  const normalisedReg = normaliseRegistration(registrationNumber);

  const next: VehicleFormFieldErrors = {};
  if (!normalisedReg) {
    next.registrationNumber = messages.required;
  } else if (normalisedReg.length < 4) {
    next.registrationNumber = messages.registrationTooShort;
  }
  if (!make) next.make = messages.required;
  if (!model) next.model = messages.required;
  if (year && !isValidVehicleYearInput(year)) {
    next.year = messages.invalidYear;
  }
  if (odometer && !isValidVehicleOdometerInput(odometer)) {
    next.odometer = messages.invalidOdometer;
  }
  return next;
}

export function firstVehicleFieldErrorId(
  idPrefix: string,
  errors: VehicleFormFieldErrors,
): string | null {
  const order = [
    "registrationNumber",
    "make",
    "model",
    "year",
    "odometer",
  ] as const;
  const map = {
    registrationNumber: `${idPrefix}-registration`,
    make: `${idPrefix}-make`,
    model: `${idPrefix}-model`,
    year: `${idPrefix}-year`,
    odometer: `${idPrefix}-odometer`,
  };
  for (const key of order) {
    if (errors[key]) return map[key];
  }
  return null;
}
