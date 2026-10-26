"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle2, PackagePlus, Plus } from "lucide-react";
import {
  createPartsRequestModalAction,
  type PurchasesActionState,
} from "@/app/actions/purchases";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import {
  CreatePartEmbedded,
  type CreatedPartSummary,
} from "@/modules/inventory/components/create-part-modal";
import { QuantityStepper } from "@/modules/inventory/components/quantity-stepper";

const initial: PurchasesActionState = { ok: false };

export type PartsRequestPartOption = {
  id: string;
  name: string;
  sku: string;
  unit: string;
};

type Props = {
  parts: PartsRequestPartOption[];
  defaultPartId?: string;
  defaultServiceOrderId?: string;
  defaultServiceOrderLineId?: string;
  defaultQuantity?: number;
  defaultOpen?: boolean;
  stayAndRefresh?: boolean;
  allowAddPart?: boolean;
  trigger?: React.ReactNode;
  size?: "sm" | "md";
};

export function CreatePartsRequestModal({
  parts,
  defaultPartId,
  defaultServiceOrderId,
  defaultServiceOrderLineId,
  defaultQuantity = 1,
  defaultOpen = false,
  stayAndRefresh = false,
  allowAddPart = false,
  trigger,
  size = "md",
}: Props) {
  const t = useTranslations("partsRequests");
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [step, setStep] = useState<"request" | "newPart">("request");
  const [extraParts, setExtraParts] = useState<PartsRequestPartOption[]>([]);
  const [selectedPartId, setSelectedPartId] = useState(defaultPartId ?? "");
  const [justAddedPartName, setJustAddedPartName] = useState<string | null>(
    null,
  );
  const [state, formAction, pending] = useActionState(
    createPartsRequestModalAction,
    initial,
  );
  const handled = useRef<string | null>(null);
  const refreshedForId = useRef<string | null>(null);

  const allParts = useMemo(() => {
    const byId = new Map<string, PartsRequestPartOption>();
    for (const part of parts) byId.set(part.id, part);
    for (const part of extraParts) byId.set(part.id, part);
    return Array.from(byId.values());
  }, [parts, extraParts]);

  useEffect(() => {
    if (!state.message || state.message === handled.current) return;
    handled.current = state.message;

    if (state.ok && state.id) {
      const createdId: string = state.id;
      toast.success(state.message);
      if (stayAndRefresh) {
        const id = window.setTimeout(() => {
          setOpen(false);
          if (refreshedForId.current !== createdId) {
            refreshedForId.current = createdId;
            router.refresh();
          }
        }, 0);
        return () => window.clearTimeout(id);
      }
      router.push("/parts-requests");
      return;
    }

    toast.error(state.message);
  }, [state, router, stayAndRefresh]);

  const partOptions = allParts.map((part) => ({
    value: part.id,
    label: `${part.name} (${part.sku})`,
  }));

  function handlePartCreated(part: CreatedPartSummary) {
    setExtraParts((prev) => [
      ...prev.filter((row) => row.id !== part.id),
      {
        id: part.id,
        name: part.name,
        sku: part.sku,
        unit: part.unit,
      },
    ]);
    setSelectedPartId(part.id);
    setJustAddedPartName(part.name);
    setStep("request");
  }

  const selectedPart = allParts.find((part) => part.id === selectedPartId);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          handled.current = null;
          setStep("request");
          setSelectedPartId(defaultPartId ?? "");
          setJustAddedPartName(null);
        } else {
          setStep("request");
          setExtraParts([]);
          setJustAddedPartName(null);
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" size={size}>
            <Plus className="size-4" aria-hidden />
            {t("add")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="gap-0 overflow-x-hidden p-0 sm:max-w-xl">
        {step === "newPart" ? (
          <CreatePartEmbedded
            onCreated={handlePartCreated}
            onCancel={() => setStep("request")}
          />
        ) : (
          <>
            <DialogHeader className="border-b border-border px-5 py-4 text-left sm:px-6">
              <DialogTitle>{t("newTitle")}</DialogTitle>
              <DialogDescription>{t("newSubtitle")}</DialogDescription>
            </DialogHeader>

            <form
              action={formAction}
              className="flex min-w-0 flex-col gap-5 px-5 py-5 sm:px-6"
            >
              <div className="grid min-w-0 grid-cols-1 items-end gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                <FormField id="modal-pr-part" label={t("part")}>
                  <FormSelect
                    id="modal-pr-part"
                    name="partId"
                    required
                    value={selectedPartId}
                    onValueChange={(value) => {
                      setSelectedPartId(value);
                      setJustAddedPartName(null);
                    }}
                    placeholder={t("partPlaceholder")}
                    triggerClassName="h-11 min-h-11 w-full min-w-0"
                    options={partOptions}
                  />
                </FormField>
                <FormField id="modal-pr-qty" label={t("quantity")}>
                  <QuantityStepper
                    id="modal-pr-qty"
                    name="quantity"
                    label={t("quantity")}
                    hideLabel
                    defaultValue={defaultQuantity}
                    min={1}
                    step={1}
                  />
                </FormField>
              </div>

              {justAddedPartName && selectedPart ? (
                <div
                  className="flex min-w-0 items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
                  role="status"
                >
                  <CheckCircle2
                    className="mt-0.5 size-5 shrink-0 text-emerald-600"
                    aria-hidden
                  />
                  <div className="min-w-0 break-words">
                    <p className="font-semibold">{t("partJustAddedTitle")}</p>
                    <p className="text-emerald-800/90">
                      {t("partJustAdded", {
                        name: selectedPart.name,
                        sku: selectedPart.sku,
                      })}
                    </p>
                  </div>
                </div>
              ) : null}

              {allowAddPart ? (
                <div className="min-w-0 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 via-sky-50 to-white p-4 shadow-xs">
                  <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                        <PackagePlus className="size-5" aria-hidden />
                      </span>
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-semibold text-slate-900">
                          {t("addNewPartTitle")}
                        </p>
                        <p className="text-sm leading-snug break-words text-slate-600">
                          {t("addNewPartHint")}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="md"
                      className="min-h-11 w-full shrink-0 gap-1.5 bg-blue-600 text-white hover:bg-blue-700 sm:w-auto"
                      onClick={() => setStep("newPart")}
                    >
                      <Plus className="size-4" aria-hidden />
                      {t("addNewPart")}
                    </Button>
                  </div>
                </div>
              ) : null}

              <FormField id="modal-pr-notes" label={t("notes")}>
                <Textarea
                  id="modal-pr-notes"
                  name="notes"
                  rows={2}
                  placeholder={t("notesPlaceholder")}
                  className="min-h-18 resize-y"
                />
              </FormField>
              {defaultServiceOrderId ? (
                <input
                  type="hidden"
                  name="serviceOrderId"
                  value={defaultServiceOrderId}
                />
              ) : null}
              {defaultServiceOrderLineId ? (
                <input
                  type="hidden"
                  name="serviceOrderLineId"
                  value={defaultServiceOrderLineId}
                />
              ) : null}

              <DialogFooter className="gap-2 border-t border-border px-0 pt-4 sm:justify-end">
                <DialogClose asChild>
                  <Button type="button" variant="secondary" size="md">
                    {t("cancel")}
                  </Button>
                </DialogClose>
                <Button type="submit" size="md" loading={pending}>
                  {pending ? t("saving") : t("create")}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
