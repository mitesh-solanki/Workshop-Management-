"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import {
  createVehicleModalAction,
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
import { VehicleFields } from "@/modules/vehicles/components/vehicle-fields";

const initial: VehicleActionState = { ok: false };

type Props = {
  customerId: string;
  customerName?: string;
  trigger?: React.ReactNode;
  onCreated?: () => void;
};

export function CreateVehicleModal({
  customerId,
  customerName,
  trigger,
  onCreated,
}: Props) {
  const t = useTranslations("vehicles");
  const tc = useTranslations("customers");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    createVehicleModalAction,
    initial,
  );
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!state.message || state.message === handled.current) return;
    handled.current = state.message;

    if (state.ok) {
      toast.success(state.message);
      onCreated?.();
      router.refresh();
      const id = window.setTimeout(() => setOpen(false), 0);
      return () => window.clearTimeout(id);
    }

    toast.error(state.message);
  }, [state, router, onCreated]);

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
          <Button type="button" size="md" className="text-white">
            <Plus className="size-4 text-white" aria-hidden />
            {t("add")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle>{t("newTitle")}</DialogTitle>
          <DialogDescription>
            {customerName
              ? t("newSubtitle", { customer: customerName })
              : t("add")}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4 px-5 py-4">
          <VehicleFields idPrefix="create-vehicle" customerId={customerId} />
          <DialogFooter className="gap-2 border-t border-border px-0 pt-4 sm:justify-end">
            <DialogClose asChild>
              <Button type="button" variant="secondary" size="md">
                {tc("cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" size="md" loading={pending} className="text-white">
              {pending ? t("saving") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
