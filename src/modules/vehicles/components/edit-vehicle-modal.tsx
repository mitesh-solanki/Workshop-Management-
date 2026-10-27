"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
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
  VehicleFields,
  type VehicleFieldValues,
} from "@/modules/vehicles/components/vehicle-fields";

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
  const router = useRouter();
  const [open, setOpen] = useState(false);
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

  useEffect(() => {
    if (!state.message || state.message === handled.current) return;
    handled.current = state.message;

    if (state.ok) {
      toast.success(state.message);
      router.refresh();
      const id = window.setTimeout(() => setOpen(false), 0);
      return () => window.clearTimeout(id);
    }

    toast.error(state.message);
  }, [state, router]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) handled.current = null;
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
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle>{t("editTitle")}</DialogTitle>
          <DialogDescription>{vehicle.registrationNumber}</DialogDescription>
        </DialogHeader>

        <form
          key={formKey}
          action={formAction}
          className="flex flex-col gap-4 px-5 py-4"
        >
          <VehicleFields
            idPrefix={`edit-vehicle-${vehicle.id}`}
            defaults={vehicle}
          />
          <DialogFooter className="gap-2 border-t border-border px-0 pt-4 sm:justify-end">
            <DialogClose asChild>
              <Button type="button" variant="secondary" size="md">
                {tc("cancel")}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              size="md"
              loading={pending}
              className="text-white"
            >
              {pending ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
