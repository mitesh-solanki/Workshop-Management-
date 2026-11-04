"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { searchCustomersPickerAction } from "@/app/actions/customers";
import {
  createVehicleModalAction,
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
import { FormField } from "@/components/ui/form-field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "@/components/ui/toast";
import {
  firstVehicleFieldErrorId,
  validateVehicleFormFields,
  VehicleFields,
  type VehicleFormFieldErrors,
} from "@/modules/vehicles/components/vehicle-fields";
import { useStripCreateQuery } from "@/hooks/use-open-create-query";
import {
  getVehicleYearMax,
  VEHICLE_ODOMETER_MAX,
  VEHICLE_YEAR_MIN,
} from "@/modules/vehicles/schema";

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
  /** Open from sidebar Add (`?create=1`). */
  defaultOpen?: boolean;
};

export function CreateVehicleFromListModal({
  customers,
  trigger,
  size = "md",
  defaultOpen = false,
}: Props) {
  const t = useTranslations("vehicles");
  const tc = useTranslations("customers");
  const te = useTranslations("errors");
  const router = useRouter();
  const formId = useId();
  const [open, setOpen] = useState(defaultOpen);
  useStripCreateQuery(defaultOpen);
  const [formKey, setFormKey] = useState(0);
  const [customerId, setCustomerId] = useState("");
  const [searchResults, setSearchResults] = useState<CustomerOption[] | null>(
    null,
  );
  const [customerSearching, setCustomerSearching] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<VehicleFormFieldErrors>({});
  const [state, formAction, pending] = useActionState(
    createVehicleModalAction,
    initial,
  );
  const handled = useRef<string | null>(null);
  const customerSearchTimer = useRef<number | null>(null);
  const idPrefix = "list-create-vehicle";

  const selectedCustomer =
    customers.find((item) => item.id === customerId) ??
    searchResults?.find((item) => item.id === customerId) ??
    null;
  const customerOptions = (() => {
    const base = searchResults ?? customers;
    if (!selectedCustomer) return base;
    if (base.some((item) => item.id === selectedCustomer.id)) return base;
    return [selectedCustomer, ...base];
  })();

  function resetFormState() {
    setCustomerId("");
    setSearchResults(null);
    setCustomerSearching(false);
    setFieldErrors({});
    setFormKey((k) => k + 1);
  }

  useEffect(() => {
    return () => {
      if (customerSearchTimer.current != null) {
        window.clearTimeout(customerSearchTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (state.ok) {
      const successKey = `ok:${state.vehicleId ?? ""}:${state.message ?? ""}`;
      if (!state.message || successKey === handled.current) return;
      handled.current = successKey;
      toast.success(state.message);
      resetFormState();
      setOpen(false);
      if (state.vehicleId) {
        router.replace(`/vehicles/${state.vehicleId}?next=inspections`);
      } else {
        router.refresh();
      }
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

  const noCustomers = customers.length === 0;

  function onCustomerQueryChange(query: string) {
    if (customerSearchTimer.current != null) {
      window.clearTimeout(customerSearchTimer.current);
    }
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSearchResults(null);
      setCustomerSearching(false);
      return;
    }
    setCustomerSearching(true);
    customerSearchTimer.current = window.setTimeout(() => {
      void searchCustomersPickerAction(trimmed)
        .then((result) => {
          let next = result.items;
          if (customerId && !next.some((item) => item.id === customerId)) {
            const kept = customers.find((item) => item.id === customerId);
            if (kept) next = [kept, ...next];
          }
          setSearchResults(next);
        })
        .finally(() => setCustomerSearching(false));
    }, 300);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          handled.current = null;
          resetFormState();
          setOpen(true);
          return;
        }
        // Clear before close animation so Cancel does not flash the last selection.
        resetFormState();
        setOpen(false);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" size={size} className="text-white">
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
          <>
            <DialogBody className="px-5 py-4">
              <p className="text-sm text-slate-600">{t("needCustomerFirst")}</p>
            </DialogBody>
            <DialogFooter className="gap-2 border-t border-border bg-background px-5 py-4 sm:justify-end">
              <DialogClose asChild>
                <Button type="button" variant="secondary" size="md">
                  {tc("cancel")}
                </Button>
              </DialogClose>
              <Button asChild size="md" className="text-white">
                <Link href="/customers?create=1">{t("addCustomerFirst")}</Link>
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogBody className="px-5 py-4">
              <form
                id={formId}
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
                  if (!customerId) {
                    next.customerId = te("validation.required");
                  }
                  if (Object.keys(next).length > 0) {
                    setFieldErrors(next);
                    const focusId = firstVehicleFieldErrorId(idPrefix, next);
                    window.setTimeout(() => {
                      if (focusId) document.getElementById(focusId)?.focus();
                      else if (!customerId) {
                        document
                          .getElementById("list-create-vehicle-customer")
                          ?.focus();
                      }
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
                <FormField
                  id="list-create-vehicle-customer"
                  label={t("customer")}
                  error={fieldErrors.customerId}
                >
                  <SearchableSelect
                    key={`customer-${formKey}`}
                    id="list-create-vehicle-customer"
                    name="customerId"
                    value={customerId}
                    onChange={(value) => {
                      setCustomerId(value);
                      if (fieldErrors.customerId) {
                        setFieldErrors((prev) => {
                          const next = { ...prev };
                          delete next.customerId;
                          return next;
                        });
                      }
                    }}
                    options={customerOptions.map((customer) => ({
                      value: customer.id,
                      label: `${customer.name} · ${customer.phone}`,
                      keywords: `${customer.name} ${customer.phone}`,
                    }))}
                    filter="remote"
                    minQueryLength={2}
                    onQueryChange={onCustomerQueryChange}
                    loading={customerSearching}
                    clearable={false}
                    placeholder={t("selectCustomerPlaceholder")}
                    searchPlaceholder={t("selectCustomerSearchPlaceholder")}
                    emptyLabel={t("selectCustomerEmpty")}
                    loadingLabel={tc("searching")}
                  />
                </FormField>
                <VehicleFields
                  key={formKey}
                  idPrefix={idPrefix}
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
                {pending ? t("saving") : t("create")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
