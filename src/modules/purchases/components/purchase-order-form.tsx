"use client";

import {
  useActionState,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import {
  cancelPurchaseOrderAction,
  createPurchaseOrderPageAction,
  updatePurchaseOrderPageAction,
  type PurchasesActionState,
} from "@/app/actions/purchases";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormActionBar } from "@/components/ui/form-action-bar";
import { FormField } from "@/components/ui/form-field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  CreatePartModal,
  type CreatedPartSummary,
} from "@/modules/inventory/components/create-part-modal";
import {
  PartPickerSelect,
  type PartPickerItem,
} from "@/modules/inventory/components/part-picker-select";
import { QuantityStepper } from "@/modules/inventory/components/quantity-stepper";

const initial: PurchasesActionState = { ok: false };

const qtyColClass = "w-[14rem] min-w-[14rem] max-w-[14rem]";
const deleteBtnClass =
  "size-11 min-h-11 min-w-11 shrink-0 rounded-lg border border-slate-300 bg-white text-red-600 shadow-xs hover:border-red-300 hover:bg-red-50 hover:text-red-700";

type LineDraft = {
  key: string;
  partId: string;
  partLabel: string;
  quantity: number;
};

export type PurchaseOrderFormVendor = { id: string; name: string };

export type PurchaseOrderFormDefaults = {
  purchaseOrderId?: string;
  number?: string;
  vendorId?: string | null;
  notes?: string | null;
  lines?: Array<{ partId: string; partName: string; quantity: number }>;
  serviceOrderId?: string | null;
  canDelete?: boolean;
};

type Props = {
  mode: "create" | "edit";
  vendors: PurchaseOrderFormVendor[];
  defaults?: PurchaseOrderFormDefaults;
};

function newLine(partId = "", partLabel = "", quantity = 1): LineDraft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    partId,
    partLabel,
    quantity,
  };
}

export function PurchaseOrderForm({ mode, vendors, defaults }: Props) {
  const t = useTranslations("purchaseOrders");
  const router = useRouter();
  const formId = useId();
  const isEdit = mode === "edit";
  const action = isEdit
    ? updatePurchaseOrderPageAction
    : createPurchaseOrderPageAction;
  const [state, formAction, pending] = useActionState(action, initial);
  const handled = useRef<string | null>(null);
  const [deletePending, startDelete] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [vendorId, setVendorId] = useState(defaults?.vendorId ?? "");
  const [lines, setLines] = useState<LineDraft[]>(() => {
    if (defaults?.lines && defaults.lines.length > 0) {
      return defaults.lines.map((line) =>
        newLine(line.partId, line.partName, line.quantity),
      );
    }
    return [newLine()];
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [createInitialName, setCreateInitialName] = useState("");
  const [createForLineKey, setCreateForLineKey] = useState<string | null>(null);

  const vendorOptions = useMemo(
    () =>
      vendors.map((vendor) => ({
        value: vendor.id,
        label: vendor.name,
        keywords: vendor.name,
      })),
    [vendors],
  );

  const busy = pending || deletePending;

  useEffect(() => {
    if (!state.message || state.message === handled.current) return;
    handled.current = state.message;
    if (state.ok && state.id) {
      toast.success(state.message);
      router.push(`/purchase-orders/${state.id}`);
      return;
    }
    toast.error(state.message);
  }, [state, router]);

  function updateLine(key: string, patch: Partial<LineDraft>) {
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function handlePartChange(
    key: string,
    partId: string,
    part: PartPickerItem | null,
  ) {
    if (
      partId &&
      lines.some((line) => line.key !== key && line.partId === partId)
    ) {
      toast.error(t("duplicatePart"));
      return;
    }
    updateLine(key, {
      partId,
      partLabel: part?.name ?? "",
    });
  }

  function openCreatePart(lineKey: string, name = "") {
    setCreateForLineKey(lineKey);
    setCreateInitialName(name.trim());
    setCreateOpen(true);
  }

  function handlePartCreated(part: CreatedPartSummary) {
    if (
      createForLineKey &&
      lines.some(
        (line) => line.key !== createForLineKey && line.partId === part.id,
      )
    ) {
      toast.error(t("duplicatePart"));
      setCreateOpen(false);
      setCreateInitialName("");
      setCreateForLineKey(null);
      return;
    }
    if (createForLineKey) {
      updateLine(createForLineKey, {
        partId: part.id,
        partLabel: part.name,
      });
    }
    setCreateOpen(false);
    setCreateInitialName("");
    setCreateForLineKey(null);
  }

  function handleDelete() {
    if (!defaults?.purchaseOrderId) return;
    startDelete(async () => {
      const result = await cancelPurchaseOrderAction(defaults.purchaseOrderId!);
      if (result.ok) {
        toast.success(result.message ?? t("cancelled"));
        setDeleteOpen(false);
        router.push("/purchase-orders");
        return;
      }
      toast.error(result.message ?? t("error"));
    });
  }

  return (
    <div className="max-w-2xl pb-28">
      <form id={formId} action={formAction}>
        {isEdit && defaults?.purchaseOrderId ? (
          <input
            type="hidden"
            name="purchaseOrderId"
            value={defaults.purchaseOrderId}
          />
        ) : null}
        {defaults?.serviceOrderId ? (
          <input
            type="hidden"
            name="serviceOrderId"
            value={defaults.serviceOrderId}
          />
        ) : null}
        <input type="hidden" name="notes" value={defaults?.notes ?? ""} />

        <Card className="gap-0 overflow-hidden py-0 shadow-sm">
          <div className="px-4 py-4 sm:px-5">
            <FormField id="po-vendor" label={t("vendor")} className="max-w-sm">
              <SearchableSelect
                id="po-vendor"
                name="vendorId"
                value={vendorId}
                onChange={setVendorId}
                options={vendorOptions}
                filter="local"
                trigger="field"
                clearable
                disabled={busy}
                placeholder={t("vendorSearchPlaceholder")}
                searchPlaceholder={t("vendorSearchPlaceholder")}
                emptyLabel={t("vendorEmptySearch")}
                clearLabel={t("vendorSkip")}
              />
            </FormField>
          </div>

          <Separator />

          <div className="space-y-3 px-4 py-4 sm:px-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900">
                {t("linesTitle")}
              </h2>
              <Button
                type="button"
                size="sm"
                className="min-h-11 gap-1.5 bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => setLines((prev) => [...prev, newLine()])}
                disabled={busy}
              >
                <Plus className="size-4" aria-hidden />
                {t("addLine")}
              </Button>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200">
              <Table className="table-fixed">
                <TableHeader className="bg-slate-100 [&_tr]:border-border">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="min-w-0 text-slate-700">
                      {t("part")}
                    </TableHead>
                    <TableHead
                      className={cn(
                        qtyColClass,
                        "whitespace-nowrap text-slate-700",
                      )}
                    >
                      {t("quantity")}
                      <span className="sr-only"> · {t("removeLine")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => (
                    <TableRow key={line.key} className="align-middle">
                      <TableCell className="min-w-0 py-2">
                        <PartPickerSelect
                          id={`po-part-${line.key}`}
                          value={line.partId}
                          initialLabel={line.partLabel || undefined}
                          onChange={(partId, part) =>
                            handlePartChange(line.key, partId, part)
                          }
                          onCreateFromQuery={(name) =>
                            openCreatePart(line.key, name)
                          }
                          disabled={busy}
                        />
                        <input
                          type="hidden"
                          name="partId"
                          value={line.partId}
                        />
                      </TableCell>
                      <TableCell className={cn(qtyColClass, "py-2")}>
                        <div className="flex items-center justify-start gap-2">
                          <QuantityStepper
                            id={`po-qty-${line.key}`}
                            name="quantity"
                            label={t("quantity")}
                            hideLabel
                            defaultValue={line.quantity}
                            min={1}
                            compact
                            disabled={busy}
                            onValueChange={(quantity) =>
                              updateLine(line.key, { quantity })
                            }
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className={deleteBtnClass}
                            disabled={busy || lines.length <= 1}
                            onClick={() =>
                              setLines((prev) =>
                                prev.filter((row) => row.key !== line.key),
                              )
                            }
                            aria-label={t("removeLine")}
                            title={t("removeLine")}
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </Card>
      </form>

      <FormActionBar
        summary={
          <p className="hidden truncate text-sm font-medium text-muted-foreground sm:block">
            {isEdit ? t("editTitle") : t("newTitle")}
            {isEdit && defaults?.number ? (
              <>
                {" · "}
                <span className="text-foreground">{defaults.number}</span>
              </>
            ) : null}
          </p>
        }
        actions={
          <>
            {isEdit && defaults?.canDelete ? (
              <ConfirmDialog
                open={deleteOpen}
                onOpenChange={(next) => {
                  if (deletePending && !next) return;
                  setDeleteOpen(next);
                }}
                title={t("cancelOrderTitle")}
                description={t("cancelOrderConfirm", {
                  number: defaults.number ?? "",
                })}
                confirmLabel={t("delete")}
                variant="danger"
                loading={deletePending && deleteOpen}
                onConfirm={handleDelete}
                trigger={
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    disabled={busy}
                    className="text-danger hover:bg-danger/5 hover:text-danger"
                  >
                    <Trash2 className="size-4" aria-hidden />
                    {t("delete")}
                  </Button>
                }
              />
            ) : null}
            <Button asChild type="button" variant="secondary" size="md">
              <Link
                href={
                  isEdit && defaults?.purchaseOrderId
                    ? `/purchase-orders/${defaults.purchaseOrderId}`
                    : "/purchase-orders"
                }
              >
                {t("cancel")}
              </Link>
            </Button>
            <Button type="submit" form={formId} size="md" loading={pending}>
              {pending
                ? t("saving")
                : isEdit
                  ? t("saveChanges")
                  : t("create")}
            </Button>
          </>
        }
      />

      <CreatePartModal
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setCreateInitialName("");
            setCreateForLineKey(null);
          }
        }}
        initialName={createInitialName}
        onCreated={handlePartCreated}
        trigger={null}
        shopReceive={false}
        nameOnly
      />
    </div>
  );
}
