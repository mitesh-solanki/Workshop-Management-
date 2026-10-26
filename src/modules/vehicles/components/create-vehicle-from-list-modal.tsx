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
import { FormField } from "@/components/ui/form-field";
import { FormSelect } from "@/components/ui/form-select";
import { toast } from "@/components/ui/toast";
import { VehicleFields } from "@/modules/vehicles/components/vehicle-fields";

const initial: VehicleActionState = { ok: false };

type CustomerOption = {
  id: string;
  name: string;
  phone: string;
};

type Props = {
  customers: CustomerOption[];
  trigger?: React.ReactNode;
  size?: "sm" | "md";
};

export function CreateVehicleFromListModal({
  customers,
  trigger,
  size = "md",
}: Props) {
  const t = useTranslations("vehicles");
  const tc = useTranslations("customers");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
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
      router.refresh();
      const id = window.setTimeout(() => setOpen(false), 0);
      return () => window.clearTimeout(id);
    }

    toast.error(state.message);
  }, [state, router]);

  const noCustomers = customers.length === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          handled.current = null;
          setCustomerId(customers[0]?.id ?? "");
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            type="button"
            size={size}
            className="text-white"
            disabled={noCustomers}
          >
            <Plus className="size-4 text-white" aria-hidden />
            {t("add")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle>{t("newTitle")}</DialogTitle>
          <DialogDescription>{t("listNewSubtitle")}</DialogDescription>
        </DialogHeader>

        {noCustomers ? (
          <div className="space-y-4 px-5 py-4">
            <p className="text-sm text-slate-600">{t("needCustomerFirst")}</p>
            <DialogFooter className="gap-2 border-t border-border px-0 pt-4 sm:justify-end">
              <DialogClose asChild>
                <Button type="button" variant="secondary" size="md">
                  {tc("cancel")}
                </Button>
              </DialogClose>
            </DialogFooter>
          </div>
        ) : (
          <form action={formAction} className="flex flex-col gap-4 px-5 py-4">
            <FormField id="list-create-vehicle-customer" label={t("customer")}>
              <FormSelect
                id="list-create-vehicle-customer"
                name="customerId"
                value={customerId}
                onValueChange={setCustomerId}
                required
                options={customers.map((customer) => ({
                  value: customer.id,
                  label: `${customer.name} · ${customer.phone}`,
                }))}
              />
            </FormField>
            <VehicleFields idPrefix="list-create-vehicle" />
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
                {pending ? t("saving") : t("create")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
