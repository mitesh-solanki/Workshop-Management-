"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  createInspectionAction,
  type InspectionActionState,
} from "@/app/actions/inspections";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "@/components/ui/toast";

export type InspectionVehicleOption = {
  id: string;
  registrationNumber: string;
  make: string;
  model: string;
  customerId: string;
  customerName: string;
};

type Props = {
  vehicles: InspectionVehicleOption[];
  initialVehicleId?: string;
  initialCustomerId?: string;
};

const initial: InspectionActionState = { ok: false };

export function NewInspectionForm({
  vehicles,
  initialVehicleId = "",
  initialCustomerId = "",
}: Props) {
  const t = useTranslations("inspections");
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    createInspectionAction,
    initial,
  );
  const handled = useRef<string | null>(null);

  const filteredVehicles = useMemo(() => {
    if (!initialCustomerId) return vehicles;
    return vehicles.filter((v) => v.customerId === initialCustomerId);
  }, [vehicles, initialCustomerId]);

  const defaultVehicle =
    initialVehicleId &&
    filteredVehicles.some((v) => v.id === initialVehicleId)
      ? initialVehicleId
      : "";

  const [vehicleId, setVehicleId] = useState(defaultVehicle);

  const selected = useMemo(
    () => filteredVehicles.find((item) => item.id === vehicleId) ?? null,
    [filteredVehicles, vehicleId],
  );

  const vehicleOptions = useMemo(
    () =>
      filteredVehicles.map((vehicle) => ({
        value: vehicle.id,
        label: `${vehicle.registrationNumber} — ${vehicle.make} ${vehicle.model}`,
        keywords: `${vehicle.registrationNumber} ${vehicle.make} ${vehicle.model} ${vehicle.customerName}`,
      })),
    [filteredVehicles],
  );

  useEffect(() => {
    if (!state.message || state.message === handled.current) return;
    handled.current = state.message;
    if (state.ok && state.inspectionId) {
      toast.success(t("created"));
      router.push(`/inspections/${state.inspectionId}`);
      return;
    }
    if (!state.ok) {
      toast.error(state.message);
    }
  }, [state, router, t]);

  return (
    <form action={formAction} className="space-y-5">
      {selected ? (
        <input type="hidden" name="customerId" value={selected.customerId} />
      ) : null}
      <input type="hidden" name="vehicleId" value={vehicleId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="inspection-vehicle"
          label={t("selectVehicle")}
          hint={vehicleId ? undefined : t("selectVehicleHint")}
        >
          <SearchableSelect
            id="inspection-vehicle"
            value={vehicleId}
            onChange={setVehicleId}
            options={vehicleOptions}
            clearable={false}
            placeholder={t("selectVehiclePlaceholder")}
            searchPlaceholder={t("selectVehicleSearchPlaceholder")}
            emptyLabel={t("selectVehicleEmpty")}
          />
        </FormField>
        <FormField id="inspection-customer" label={t("customer")}>
          <Input
            id="inspection-customer"
            value={selected?.customerName ?? ""}
            placeholder={t("selectVehiclePlaceholder")}
            disabled
            readOnly
            className="h-11 min-h-11"
          />
        </FormField>
      </div>

      <Button
        type="submit"
        size="md"
        loading={pending}
        disabled={!selected || pending}
      >
        {pending ? t("starting") : t("startInspection")}
      </Button>
    </form>
  );
}
