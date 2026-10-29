"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { createVehicleWarrantyAction } from "@/app/actions/warranties";
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
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "@/components/ui/toast";
import {
  PartPickerSelect,
  type PartPickerItem,
} from "@/modules/inventory/components/part-picker-select";
import { partRequiresWarrantyCard } from "@/modules/warranties/part-requires-warranty";
import { WarrantyCardPhotoField } from "@/modules/warranties/components/warranty-card-photo-field";
import { uploadWarrantyCardFile } from "@/modules/warranties/components/upload-warranty-file";

export type WarrantyVehicleOption = {
  id: string;
  registrationNumber: string;
  make: string;
  model: string;
};

type Props = {
  customerId: string;
  /** When set, warranty is locked to this vehicle (vehicle detail page). */
  vehicleId?: string;
  /** Customer vehicles — shown as a searchable select when vehicleId is not locked. */
  vehicles?: WarrantyVehicleOption[];
  /** When set from a draft invoice, links the card to that bill. */
  invoiceId?: string;
  orderId?: string;
  trigger?: React.ReactNode;
};

export function AddWarrantyCardModal({
  customerId,
  vehicleId: lockedVehicleId,
  vehicles = [],
  invoiceId,
  orderId,
  trigger,
}: Props) {
  const t = useTranslations("warranties");
  const idPrefix = useId();
  const [open, setOpen] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [partId, setPartId] = useState("");
  const [partName, setPartName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();

  const needsVehicleSelect = !lockedVehicleId;
  const vehicleId = lockedVehicleId || selectedVehicleId;
  const required = partRequiresWarrantyCard(partName);

  const vehicleOptions = useMemo(
    () =>
      vehicles.map((vehicle) => ({
        value: vehicle.id,
        label: `${vehicle.registrationNumber} · ${vehicle.make} ${vehicle.model}`.trim(),
        keywords: `${vehicle.registrationNumber} ${vehicle.make} ${vehicle.model}`,
      })),
    [vehicles],
  );

  function reset() {
    setSelectedVehicleId("");
    setPartId("");
    setPartName("");
    setExpiry("");
    setFile(null);
  }

  function handlePartChange(_nextId: string, part: PartPickerItem | null) {
    setPartId(part?.id ?? "");
    setPartName(part?.name ?? "");
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      try {
        if (!vehicleId) {
          toast.error(t("errors.vehicleRequired"));
          return;
        }
        if (required && !file) {
          toast.error(t("errors.batteryPhotoRequired"));
          return;
        }
        if (required && !expiry) {
          toast.error(t("errors.batteryExpiryRequired"));
          return;
        }
        if (!file && !expiry) {
          toast.error(t("errors.emptyDocument"));
          return;
        }

        let uploaded: {
          storageKey: string;
          contentType: string;
          byteSize: number;
          fileName: string;
        } | null = null;

        if (file) {
          uploaded = await uploadWarrantyCardFile({
            vehicleId,
            file,
            uploadFailedMessage: t("uploadFailed"),
          });
        }

        const result = await createVehicleWarrantyAction({
          vehicleId,
          customerId,
          partName,
          invoiceId,
          orderId,
          warrantyExpiresAt: expiry || undefined,
          storageKey: uploaded?.storageKey ?? null,
          contentType: uploaded?.contentType ?? null,
          byteSize: uploaded?.byteSize ?? null,
          fileName: uploaded?.fileName ?? null,
        });

        if (!result.ok) {
          toast.error(result.message ?? t("error"));
          return;
        }
        toast.success(t("created"));
        reset();
        setOpen(false);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t("uploadFailed"),
        );
      }
    });
  }

  const canSave = Boolean(vehicleId && partName.trim());

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" size="md">
            <Plus className="size-4" aria-hidden />
            {t("add")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className="gap-0 p-0 sm:max-w-md"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader className="border-b border-border px-5 py-4 pr-12 text-left">
          <DialogTitle>{t("addTitle")}</DialogTitle>
          <DialogDescription>
            {needsVehicleSelect ? t("addSubtitleCustomer") : t("addSubtitle")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="px-5 py-4">
          <form
            id={`${idPrefix}-form`}
            onSubmit={onSubmit}
            className="flex flex-col gap-4"
          >
            {needsVehicleSelect ? (
              <FormField id={`${idPrefix}-vehicle`} label={t("vehicle")}>
                <SearchableSelect
                  id={`${idPrefix}-vehicle`}
                  value={selectedVehicleId}
                  onChange={setSelectedVehicleId}
                  options={vehicleOptions}
                  disabled={pending || vehicles.length === 0}
                  placeholder={t("selectVehiclePlaceholder")}
                  searchPlaceholder={t("selectVehicleSearchPlaceholder")}
                  emptyLabel={
                    vehicles.length === 0
                      ? t("selectVehicleNoVehicles")
                      : t("selectVehicleEmpty")
                  }
                  className="w-full min-w-0"
                />
              </FormField>
            ) : null}
            <FormField id={`${idPrefix}-part`} label={t("partName")}>
              <PartPickerSelect
                id={`${idPrefix}-part`}
                value={partId}
                onChange={handlePartChange}
                disabled={pending}
                className="w-full min-w-0"
              />
            </FormField>
            {required ? (
              <p className="text-caption text-amber-800">{t("batteryHint")}</p>
            ) : null}
            <FormField
              id={`${idPrefix}-expiry`}
              label={required ? `${t("expiry")} *` : t("expiry")}
            >
              <Input
                id={`${idPrefix}-expiry`}
                type="date"
                value={expiry}
                onChange={(event) => setExpiry(event.target.value)}
                required={required}
                disabled={pending}
                className="h-11 min-h-11"
              />
            </FormField>
            <WarrantyCardPhotoField
              id={`${idPrefix}-file`}
              label={required ? `${t("cardPhoto")} *` : t("cardPhoto")}
              file={file}
              onChange={setFile}
              required={required}
              disabled={pending}
            />
          </form>
        </DialogBody>
        <DialogFooter className="gap-2 border-t border-border bg-background px-5 py-4 sm:justify-end">
          <DialogClose asChild>
            <Button type="button" variant="outline" size="md" disabled={pending}>
              {t("cancel")}
            </Button>
          </DialogClose>
          <Button
            type="submit"
            form={`${idPrefix}-form`}
            size="md"
            disabled={pending || !canSave}
            className="text-white"
          >
            {pending ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
