"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import {
  createPurchaseOrderModalAction,
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

const initial: PurchasesActionState = { ok: false };

export type OpenPartsRequestOption = {
  id: string;
  quantity: number;
  part: { id: string; name: string; sku: string; unit: string };
};

type Props = {
  vendors: { id: string; name: string }[];
  openRequests: OpenPartsRequestOption[];
  preselectedRequestIds?: string[];
  defaultVendorId?: string;
  stayAndRefresh?: boolean;
  defaultOpen?: boolean;
  trigger?: React.ReactNode;
  size?: "sm" | "md";
};

export function CreatePurchaseOrderModal({
  vendors,
  openRequests,
  preselectedRequestIds = [],
  defaultVendorId,
  stayAndRefresh = false,
  defaultOpen = false,
  trigger,
  size = "md",
}: Props) {
  const t = useTranslations("purchaseOrders");
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [state, formAction, pending] = useActionState(
    createPurchaseOrderModalAction,
    initial,
  );
  const handled = useRef<string | null>(null);
  const refreshedForId = useRef<string | null>(null);
  const preselected = new Set(preselectedRequestIds);

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
      const id = window.setTimeout(() => setOpen(false), 0);
      router.push(`/purchase-orders/${createdId}`);
      return () => window.clearTimeout(id);
    }

    toast.error(state.message);
  }, [state, router, stayAndRefresh]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          handled.current = null;
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
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle>{t("newTitle")}</DialogTitle>
          <DialogDescription>{t("newSubtitle")}</DialogDescription>
        </DialogHeader>

        <form
          action={formAction}
          className="flex max-h-[min(80vh,40rem)] flex-col gap-4 overflow-y-auto px-5 py-4"
        >
          {defaultVendorId ? (
            <input type="hidden" name="vendorId" value={defaultVendorId} />
          ) : (
            <FormField id="modal-po-vendor" label={t("vendor")}>
              <FormSelect
                id="modal-po-vendor"
                name="vendorId"
                required
                placeholder={t("vendorPlaceholder")}
                triggerClassName="h-11 min-h-11"
                options={vendors.map((vendor) => ({
                  value: vendor.id,
                  label: vendor.name,
                }))}
              />
            </FormField>
          )}

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">
              {t("openRequests")}
            </legend>
            {openRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("noOpenRequests")}
              </p>
            ) : (
              <ul className="space-y-2">
                {openRequests.map((request) => (
                  <li key={request.id}>
                    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-2.5 hover:bg-muted/40">
                      <input
                        type="checkbox"
                        name="partsRequestIds"
                        value={request.id}
                        defaultChecked={preselected.has(request.id)}
                        className="mt-1 size-4 shrink-0"
                      />
                      <span className="min-w-0">
                        <span className="block font-medium text-foreground">
                          {request.part.name}
                        </span>
                        <span className="block text-caption text-muted-foreground">
                          {request.part.sku} · {request.quantity}{" "}
                          {request.part.unit}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>

          <FormField id="modal-po-notes" label={t("notes")}>
            <Textarea id="modal-po-notes" name="notes" rows={2} />
          </FormField>

          <DialogFooter className="gap-2 border-t border-border px-0 pt-4 sm:justify-end">
            <DialogClose asChild>
              <Button type="button" variant="secondary" size="md">
                {t("cancel")}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              size="md"
              loading={pending}
              disabled={openRequests.length === 0}
            >
              {pending ? t("saving") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
