"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { getSuggestedExpectedCompletionAction } from "@/app/actions/service-orders";
import { searchVehiclesPickerAction } from "@/app/actions/vehicles";
import { FormField } from "@/components/ui/form-field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { JobCardSectionNav } from "@/modules/service-orders/components/job-card-section-nav";
import { ServiceOrderForm } from "@/modules/service-orders/components/service-order-form";
import {
  FULL_JOB_CARD_SURFACE,
  type JobCardSection,
  type JobCardSurface,
} from "@/modules/service-orders/job-card-sections";

export type VehicleOption = {
  id: string;
  registrationNumber: string;
  make: string;
  model: string;
  odometer: number | null;
  customerName: string;
};

type TechnicianOption = {
  id: string;
  name: string | null;
  email: string;
};

type BayOption = {
  id: string;
  name: string;
};

type Props = {
  vehicles: VehicleOption[];
  technicians: TechnicianOption[];
  bays: BayOption[];
  suggestedJobCardNumber: number;
  initialVehicleId?: string;
  /** When set (technician create), assignment is locked to this user. */
  lockTechnicianId?: string;
  /** Link this inspection after create. */
  inspectionId?: string;
  /** Prefill expected completion from the linked inspection. */
  defaultExpectedCompletion?: string;
  /** Defaults to full Owner/Manager surface — pass technician surface separately. */
  surface?: JobCardSurface;
  /**
   * When true, vehicle list is complete for this customer — local filter only.
   * When false, search the garage by registration or customer name (debounced).
   */
  localVehicleList?: boolean;
};

function toSelectOptions(vehicles: VehicleOption[]) {
  return vehicles.map((vehicle) => ({
    value: vehicle.id,
    label: `${vehicle.registrationNumber} · ${vehicle.customerName}`.trim(),
    keywords: `${vehicle.registrationNumber} ${vehicle.customerName} ${vehicle.make} ${vehicle.model}`,
  }));
}

export function NewJobCardForm({
  vehicles: initialVehicles,
  technicians,
  bays,
  suggestedJobCardNumber,
  initialVehicleId = "",
  lockTechnicianId,
  inspectionId,
  defaultExpectedCompletion = "",
  surface = FULL_JOB_CARD_SURFACE,
  localVehicleList = false,
}: Props) {
  const t = useTranslations("orders");
  /** Keep the number shown at open — do not follow counter after save soft-refresh. */
  const [lockedJobCardNumber] = useState(suggestedJobCardNumber);
  const [vehicleId, setVehicleId] = useState(initialVehicleId);
  const [remoteVehicles, setRemoteVehicles] = useState<VehicleOption[] | null>(
    null,
  );
  const vehicles = remoteVehicles ?? initialVehicles;
  const [vehicleSearching, setVehicleSearching] = useState(false);
  const searchTimer = useRef<number | null>(null);
  const [expectedCompletion, setExpectedCompletion] = useState(
    defaultExpectedCompletion,
  );
  const [expectedCompletionSource, setExpectedCompletionSource] = useState<
    "inspection" | "estimate" | "linked-inspection" | null
  >(defaultExpectedCompletion ? "linked-inspection" : null);

  const sections = surface.sections;
  const lockedSections = sections.filter(
    (id): id is JobCardSection => id !== "details",
  );

  const selected = useMemo(
    () => vehicles.find((item) => item.id === vehicleId) ?? null,
    [vehicles, vehicleId],
  );

  useEffect(() => {
    return () => {
      if (searchTimer.current != null) {
        window.clearTimeout(searchTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!vehicleId) {
      if (!inspectionId) {
        window.setTimeout(() => {
          setExpectedCompletion("");
          setExpectedCompletionSource(null);
        }, 0);
      }
      return;
    }

    // Linked inspection from URL wins until vehicle changes away.
    if (inspectionId && defaultExpectedCompletion && vehicleId === initialVehicleId) {
      window.setTimeout(() => {
        setExpectedCompletion(defaultExpectedCompletion);
        setExpectedCompletionSource("linked-inspection");
      }, 0);
      return;
    }

    let cancelled = false;
    void (async () => {
      const result = await getSuggestedExpectedCompletionAction(vehicleId);
      if (cancelled) return;
      if (result.ok && result.suggestion) {
        setExpectedCompletion(result.suggestion.date);
        setExpectedCompletionSource(result.suggestion.source);
      } else {
        setExpectedCompletion("");
        setExpectedCompletionSource(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    vehicleId,
    inspectionId,
    defaultExpectedCompletion,
    initialVehicleId,
  ]);

  const expectedCompletionHint =
    expectedCompletionSource === "inspection" ||
    expectedCompletionSource === "linked-inspection"
      ? t("expectedCompletionFromInspection")
      : expectedCompletionSource === "estimate"
        ? t("expectedCompletionFromEstimate")
        : undefined;

  const vehicleOptions = useMemo(() => {
    const options = toSelectOptions(vehicles);
    if (!vehicleId) return options;
    const current = options.find((option) => option.value === vehicleId);
    if (!current) return options;
    return [current, ...options.filter((option) => option.value !== vehicleId)];
  }, [vehicles, vehicleId]);

  function onVehicleQueryChange(query: string) {
    if (localVehicleList) {
      const q = query.trim().toLowerCase();
      if (!q) {
        setRemoteVehicles(null);
        return;
      }
      setRemoteVehicles(
        initialVehicles.filter((vehicle) => {
          const haystack =
            `${vehicle.registrationNumber} ${vehicle.customerName} ${vehicle.make} ${vehicle.model}`.toLowerCase();
          return haystack.includes(q);
        }),
      );
      return;
    }

    if (searchTimer.current != null) {
      window.clearTimeout(searchTimer.current);
    }
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setRemoteVehicles(null);
      setVehicleSearching(false);
      return;
    }
    setVehicleSearching(true);
    searchTimer.current = window.setTimeout(() => {
      void searchVehiclesPickerAction(trimmed)
        .then((result) => {
          const next = result.items.map((vehicle) => ({
            id: vehicle.id,
            registrationNumber: vehicle.registrationNumber,
            make: vehicle.make,
            model: vehicle.model,
            odometer: vehicle.odometer,
            customerName: vehicle.customerName,
          }));
          if (vehicleId) {
            const selectedRow =
              next.find((item) => item.id === vehicleId) ??
              initialVehicles.find((item) => item.id === vehicleId) ??
              vehicles.find((item) => item.id === vehicleId);
            if (selectedRow && !next.some((item) => item.id === selectedRow.id)) {
              setRemoteVehicles([selectedRow, ...next]);
              return;
            }
          }
          setRemoteVehicles(next);
        })
        .finally(() => setVehicleSearching(false));
    }, 300);
  }

  return (
    <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start">
      <aside className="sticky top-0 z-20 w-full shrink-0 bg-background pb-1 lg:top-4 lg:w-[220px] lg:bg-transparent lg:pb-0 xl:w-[240px]">
        <JobCardSectionNav
          section="details"
          onSectionChange={() => undefined}
          sections={sections}
          lockedSections={lockedSections}
        />
      </aside>

      <div className="min-w-0 flex-1 overflow-hidden rounded-[14px] border border-[#d7deea] bg-white shadow-[0_3px_17px_rgba(36,58,99,0.06)]">
        <div className="flex items-start gap-3 border-b border-[#d7deea] bg-[#f8fafc] px-4 py-4 sm:px-5">
          <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[#e8efff] text-[13px] font-black text-[#1f5eff]">
            01
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 className="text-[17px] font-semibold tracking-tight text-[#152238]">
              {t("details")}
            </h2>
            <p className="mt-1 text-[12px] text-[#5c6b7e]">{t("detailsHint")}</p>
          </div>
        </div>
        <div className="space-y-6 px-5 py-5 sm:px-6">
          <ServiceOrderForm
            key={`${selected?.id ?? "new-job-card"}-${expectedCompletion}-${expectedCompletionSource ?? "none"}`}
            mode="create"
            vehicleId={selected?.id ?? ""}
            defaultOdometer={selected?.odometer ?? null}
            defaultExpectedCompletion={expectedCompletion}
            expectedCompletionHint={expectedCompletionHint}
            suggestedJobCardNumber={lockedJobCardNumber}
            technicians={technicians}
            bays={bays}
            lockTechnicianId={lockTechnicianId}
            inspectionId={inspectionId}
            vehiclePicker={
              <FormField
                id="vehicleId-picker"
                label={t("selectVehicle")}
                hint={t("selectVehicleHint")}
              >
                <SearchableSelect
                  id="vehicleId-picker"
                  value={vehicleId}
                  onChange={setVehicleId}
                  options={vehicleOptions}
                  filter={localVehicleList ? "local" : "remote"}
                  minQueryLength={localVehicleList ? 0 : 2}
                  requireSearch={!localVehicleList && initialVehicles.length === 0}
                  onQueryChange={onVehicleQueryChange}
                  onOpenChange={(open) => {
                    if (!open) setRemoteVehicles(null);
                  }}
                  loading={vehicleSearching}
                  clearable={false}
                  placeholder={t("selectVehiclePlaceholder")}
                  searchPlaceholder={t("selectVehicleSearchPlaceholder")}
                  emptyLabel={t("selectVehicleEmpty")}
                  loadingLabel={t("searchingVehicles")}
                />
              </FormField>
            }
          />
        </div>
      </div>
    </div>
  );
}
