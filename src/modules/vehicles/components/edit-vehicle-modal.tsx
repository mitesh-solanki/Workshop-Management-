"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import {
  updateVehicleAction,
  type VehicleActionState,
} from "@/app/actions/vehicles";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import {
  firstVehicleFieldErrorId,
  validateVehicleFormFields,
  VehicleFields,
  type VehicleFieldValues,
  type VehicleFormFieldErrors,
} from "@/modules/vehicles/components/vehicle-fields";
import {
  getVehicleYearMax,
  VEHICLE_ODOMETER_MAX,
  VEHICLE_YEAR_MIN,
} from "@/modules/vehicles/schema";

const initial: VehicleActionState = { ok: false };

export type EditVehicleValues = VehicleFieldValues & {
  id: string;
  customerId: string;
};

type Props = {
  vehicle: EditVehicleValues;
  trigger?: React.ReactNode;
};

export function EditVehicleModal({ vehicle, trigger }: Props) {
  const t = useTranslations("vehicles");
  const tc = useTranslations("customers");
  const te = useTranslations("errors");
  const router = useRouter();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<VehicleFormFieldErrors>({});
  const boundUpdate = useMemo(
    () => updateVehicleAction.bind(null, vehicle.id, vehicle.customerId),
    [vehicle.id, vehicle.customerId],
  );
  const [state, formAction, pending] = useActionState(boundUpdate, initial);
  const handled = useRef<string | null>(null);
  const formKey = [
    vehicle.id,
    vehicle.registrationNumber,
    vehicle.make,
    vehicle.model,
    vehicle.stateCode,
    vehicle.year ?? "",
    vehicle.odometer ?? "",
  ].join("|");
  const idPrefix = `edit-vehicle-${vehicle.id}`;

  useEffect(() => {
    if (state.ok) {
      if (!state.message || state.message === handled.current) return;
      handled.current = state.message;
      toast.success(state.message);
      setFieldErrors({});
      setOpen(false);
      router.refresh();
      return;
    }

    if (state.fieldErrors && Object.keys(state.fieldErrors).length > 0) {
      const key = `fields:${Object.keys(state.fieldErrors).sort().join(",")}:${state.message ?? ""}`;
      if (key === handled.current) return;
      handled.current = key;
      setFieldErrors(state.fieldErrors as VehicleFormFieldErrors);
      const focusId = firstVehicleFieldErrorId(
        idPrefix,
        state.fieldErrors as VehicleFormFieldErrors,
      );
      window.setTimeout(() => {
        if (focusId) document.getElementById(focusId)?.focus();
      }, 50);
      return;
    }

    if (!state.message || state.message === handled.current) return;
    handled.current = state.message;
    toast.error(state.message);
  }, [state, router, idPrefix]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          handled.current = null;
          setFieldErrors({});
          return;
        }
        setFieldErrors({});
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={t("edit")}
          >
            <Pencil className="size-4" aria-hidden />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border px-5 py-4 pr-12 text-left">
          <DialogTitle>{t("editTitle")}</DialogTitle>
          <DialogDescription>{vehicle.registrationNumber}</DialogDescription>
        </DialogHeader>

        <DialogBody className="px-5 py-4">
          <form
            id={formId}
            key={formKey}
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const next = validateVehicleFormFields(form, {
                required: te("validation.required"),
                registrationTooShort: te("validation.registrationTooShort"),
                invalidYear: te("validation.invalidYear", {
                  min: VEHICLE_YEAR_MIN,
                  max: getVehicleYearMax(),
                }),
                invalidOdometer: te("validation.invalidOdometer", {
                  max: VEHICLE_ODOMETER_MAX.toLocaleString("en-IN"),
                }),
              });
              if (Object.keys(next).length > 0) {
                setFieldErrors(next);
                const focusId = firstVehicleFieldErrorId(idPrefix, next);
                window.setTimeout(() => {
                  if (focusId) document.getElementById(focusId)?.focus();
                }, 50);
                return;
              }
              setFieldErrors({});
              startTransition(() => {
                formAction(new FormData(form));
              });
            }}
            className="flex flex-col gap-4"
          >
            <VehicleFields
              key={formKey}
              idPrefix={idPrefix}
              defaults={vehicle}
              fieldErrors={fieldErrors}
              onFieldErrorsChange={setFieldErrors}
            />
          </form>
        </DialogBody>
        <DialogFooter className="gap-2 border-t border-border bg-background px-5 py-4 sm:justify-end">
          <DialogClose asChild>
            <Button type="button" variant="secondary" size="md">
              {tc("cancel")}
            </Button>
          </DialogClose>
          <Button
            type="submit"
            form={formId}
            size="md"
            loading={pending}
            className="text-white"
          >
            {pending ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
