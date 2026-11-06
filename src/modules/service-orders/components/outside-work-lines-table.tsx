"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Check, FileText, Pencil, Trash2, Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  deleteServiceOrderLineAction,
  getOutsideWorkBillDownloadUrlAction,
  updateServiceOrderLineAction,
  type ServiceOrderActionState,
} from "@/app/actions/service-orders";
import { getVendorOptionsAction } from "@/app/actions/vendors";
import {
  SyncInvoicePrompt,
  useInvoiceSyncPrompt,
  type BillSyncMode,
} from "@/modules/billing/components/sync-invoice-prompt";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormSelect } from "@/components/ui/form-select";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { computeLineGst } from "@/lib/gst";
import {
  formatRupees,
  isZeroRupeesInput,
  paiseToRupeesInput,
  parseRupeesToPaise,
  sanitizeRupeesTyping,
  type Paise,
} from "@/lib/money";
import { cn } from "@/lib/utils";
import { GST_RATE_OPTIONS } from "@/modules/estimates/schema";
import { uploadOutsideWorkBillFile } from "@/modules/service-orders/components/upload-outside-work-bill";
import {
  CreateVendorModal,
  type CreatedVendorSummary,
} from "@/modules/vendors/components/create-vendor-modal";

type GstSplitValue = "CGST_SGST" | "IGST";
type VendorOption = { id: string; name: string };

type Line = {
  id: string;
  description: string;
  unitPricePaise: number;
  vendorId: string | null;
  vendorName: string | null;
  gstSplit: GstSplitValue | null;
  gstRatePercent: number | null;
  billStorageKey: string | null;
  billFileName: string | null;
};

type Props = {
  orderId: string;
  canMutate: boolean;
  lines: Line[];
  billSyncMode?: BillSyncMode;
};

const initial: ServiceOrderActionState = { ok: false };

const controlClass =
  "h-11 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] shadow-xs outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/25";

const actionBtnClass =
  "inline-flex size-11 min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-300 bg-white p-0 leading-none shadow-xs [&_svg]:size-5 [&_svg]:shrink-0";

function Dash() {
  return <span className="text-slate-400">—</span>;
}

function BillLink({
  orderId,
  lineId,
  hasBill,
  fileName,
}: {
  orderId: string;
  lineId: string;
  hasBill: boolean;
  fileName: string | null;
}) {
  const t = useTranslations("orders");
  const [pending, startTransition] = useTransition();

  if (!hasBill) return <Dash />;

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      loading={pending}
      className="size-11 min-h-11 min-w-11"
      title={fileName ?? t("outsideWorkBill")}
      aria-label={fileName ?? t("outsideWorkBill")}
      onClick={() => {
        startTransition(async () => {
          const result = await getOutsideWorkBillDownloadUrlAction(
            orderId,
            lineId,
          );
          if (!result.ok) {
            toast.error(result.message);
            return;
          }
          window.open(result.url, "_blank", "noopener,noreferrer");
        });
      }}
    >
      <FileText className="size-4" aria-hidden />
    </Button>
  );
}

export function OutsideWorkLinesTable({
  orderId,
  canMutate,
  lines,
  billSyncMode = "none",
}: Props) {
  const t = useTranslations("orders");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { syncOpen, setSyncOpen, offerSync } = useInvoiceSyncPrompt(
    orderId,
    billSyncMode,
  );

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-slate-300">
        <Table className="w-full table-fixed">
          <colgroup>
            <col className="w-[24%]" />
            <col className="w-[29%]" />
            <col className="w-[6.5rem]" />
            <col className="w-36" />
            <col className="w-24" />
            <col className="w-16" />
            <col className="w-28" />
            {canMutate ? <col className="w-32" /> : null}
          </colgroup>
          <TableHeader>
            <TableRow className="border-b border-slate-200 bg-slate-100 hover:bg-slate-100">
              <TableHead className="px-3 py-2.5 text-[13px] font-semibold text-slate-700">
                {t("outsideWorkVendor")}
              </TableHead>
              <TableHead className="px-3 py-2.5 text-[13px] font-semibold text-slate-700">
                {t("lineDescription")}
              </TableHead>
              <TableHead className="px-3 py-2.5 text-[13px] font-semibold text-slate-700">
                {t("outsideWorkAmount")}
              </TableHead>
              <TableHead className="px-3 py-2.5 text-[13px] font-semibold text-slate-700">
                {t("outsideWorkGstSplit")}
              </TableHead>
              <TableHead className="px-3 py-2.5 text-[13px] font-semibold text-slate-700">
                {t("outsideWorkGstRate")}
              </TableHead>
              <TableHead className="px-2 py-2.5 text-center text-[13px] font-semibold text-slate-700">
                {t("outsideWorkBill")}
              </TableHead>
              <TableHead className="px-3 py-2.5 text-[13px] font-semibold text-slate-700">
                {t("outsideWorkTotal")}
              </TableHead>
              {canMutate ? (
                <TableHead className="px-3 py-2.5">
                  <span className="sr-only">{t("actions")}</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => (
              <OutsideWorkLineRow
                key={line.id}
                orderId={orderId}
                line={line}
                canMutate={canMutate}
                editing={editingId === line.id}
                onEdit={() => setEditingId(line.id)}
                onCancelEdit={() => setEditingId(null)}
                onAskDelete={() => setDeleteId(line.id)}
                onSaved={() => {
                  setEditingId(null);
                  offerSync();
                }}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      <DeleteOutsideWorkDialog
        orderId={orderId}
        lineId={deleteId}
        open={deleteId != null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        onDeleted={() => {
          setDeleteId(null);
          setEditingId(null);
          offerSync();
        }}
      />

      <SyncInvoicePrompt
        orderId={orderId}
        open={syncOpen}
        onOpenChange={setSyncOpen}
      />
    </>
  );
}

function OutsideWorkLineRow({
  orderId,
  line,
  canMutate,
  editing,
  onEdit,
  onCancelEdit,
  onAskDelete,
  onSaved,
}: {
  orderId: string;
  line: Line;
  canMutate: boolean;
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onAskDelete: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("orders");
  const tb = useTranslations("billing");
  const ti = useTranslations("inventory");
  const bound = useMemo(
    () => updateServiceOrderLineAction.bind(null, orderId, line.id),
    [orderId, line.id],
  );
  const [state, formAction, pending] = useActionState(bound, initial);
  const wasPending = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingFileRef = useRef<File | null>(null);
  const successHandled = useRef<string | null>(null);
  const [description, setDescription] = useState(line.description);
  const [priceText, setPriceText] = useState(
    paiseToRupeesInput(line.unitPricePaise as Paise),
  );
  const [vendorId, setVendorId] = useState(line.vendorId ?? "");
  const [vendors, setVendors] = useState<VendorOption[]>(() =>
    line.vendorId && line.vendorName
      ? [{ id: line.vendorId, name: line.vendorName }]
      : [],
  );
  const [vendorQuery, setVendorQuery] = useState("");
  const [loadingVendors, startLoadVendors] = useTransition();
  const [createVendorOpen, setCreateVendorOpen] = useState(false);
  const [createVendorName, setCreateVendorName] = useState("");
  const [gstSplit, setGstSplit] = useState<GstSplitValue>(
    line.gstSplit ?? "CGST_SGST",
  );
  const [gstRatePercent, setGstRatePercent] = useState(
    line.gstRatePercent ?? 0,
  );
  const [billFile, setBillFile] = useState<File | null>(null);
  const [billPreviewUrl, setBillPreviewUrl] = useState<string | null>(null);
  const [existingBillPreviewUrl, setExistingBillPreviewUrl] = useState<
    string | null
  >(null);
  const [clearedExistingBill, setClearedExistingBill] = useState(false);
  const [uploading, setUploading] = useState(false);

  const needsBill = gstRatePercent > 0;
  const hasExistingBill =
    Boolean(line.billStorageKey) && !clearedExistingBill && !billFile;
  const editTotals = computeLineGst({
    quantity: 1,
    unitPricePaise: (parseRupeesToPaise(priceText) ??
      line.unitPricePaise) as Paise,
    gstRatePercent,
  });
  const viewTotals = computeLineGst({
    quantity: 1,
    unitPricePaise: line.unitPricePaise as Paise,
    gstRatePercent: line.gstRatePercent ?? 0,
  });

  const gstSplitOptions = useMemo(
    () => [
      { value: "CGST_SGST", label: tb("gstSplit.CGST_SGST") },
      { value: "IGST", label: tb("gstSplit.IGST") },
    ],
    [tb],
  );

  const gstRateOptions = useMemo(
    () =>
      GST_RATE_OPTIONS.map((rate) => ({
        value: String(rate),
        label: `${rate}%`,
      })),
    [],
  );

  const vendorOptions = useMemo(() => {
    const q = vendorQuery.trim().toLowerCase();
    return vendors
      .filter((vendor) => !q || vendor.name.toLowerCase().includes(q))
      .map((vendor) => ({
        value: vendor.id,
        label: vendor.name,
        keywords: vendor.name,
      }));
  }, [vendors, vendorQuery]);

  useEffect(() => {
    if (!editing) return;
    startLoadVendors(() => {
      void getVendorOptionsAction().then((rows) => {
        setVendors((prev) => {
          const map = new Map(rows.map((row) => [row.id, row]));
          for (const row of prev) {
            if (!map.has(row.id)) map.set(row.id, row);
          }
          return [...map.values()].sort((a, b) =>
            a.name.localeCompare(b.name),
          );
        });
      });
    });
  }, [editing]);

  useEffect(() => {
    if (!editing) return;
    setDescription(line.description);
    setPriceText(paiseToRupeesInput(line.unitPricePaise as Paise));
    setVendorId(line.vendorId ?? "");
    setGstSplit(line.gstSplit ?? "CGST_SGST");
    setGstRatePercent(
      typeof line.gstRatePercent === "number" ? line.gstRatePercent : 0,
    );
    setBillFile(null);
    setClearedExistingBill(false);
    pendingFileRef.current = null;
    successHandled.current = null;
    if (line.vendorId && line.vendorName) {
      setVendors((prev) => {
        if (prev.some((row) => row.id === line.vendorId)) return prev;
        return [...prev, { id: line.vendorId!, name: line.vendorName! }].sort(
          (a, b) => a.name.localeCompare(b.name),
        );
      });
    }
  }, [
    editing,
    line.description,
    line.unitPricePaise,
    line.vendorId,
    line.vendorName,
    line.gstSplit,
    line.gstRatePercent,
  ]);

  useEffect(() => {
    if (!billFile || !billFile.type.startsWith("image/")) {
      setBillPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(billFile);
    setBillPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [billFile]);

  useEffect(() => {
    if (!editing || !hasExistingBill || billFile) {
      setExistingBillPreviewUrl(null);
      return;
    }
    const name = line.billFileName ?? "";
    if (!/\.(jpe?g|png|webp)$/i.test(name)) {
      setExistingBillPreviewUrl(null);
      return;
    }
    let cancelled = false;
    void getOutsideWorkBillDownloadUrlAction(orderId, line.id).then(
      (result) => {
        if (cancelled || !result.ok) return;
        setExistingBillPreviewUrl(result.url);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [
    editing,
    hasExistingBill,
    billFile,
    orderId,
    line.id,
    line.billFileName,
  ]);

  useEffect(() => {
    const finished = wasPending.current && !pending;
    wasPending.current = pending;
    if (!finished || !state.message) return;

    if (state.ok) {
      const handleKey = `${line.id}:${state.message}`;
      if (successHandled.current === handleKey) return;
      successHandled.current = handleKey;
      const selected = pendingFileRef.current;

      void (async () => {
        if (selected) {
          setUploading(true);
          try {
            await uploadOutsideWorkBillFile({
              serviceOrderId: orderId,
              lineId: line.id,
              file: selected,
              uploadFailedMessage: t("outsideWorkBillUploadFailed"),
            });
            toast.success(t("lineUpdated"));
          } catch (err) {
            const message =
              err instanceof Error
                ? err.message
                : t("outsideWorkBillUploadFailed");
            toast.error(
              t("outsideWorkAddedButUploadFailed", { reason: message }),
            );
          } finally {
            setUploading(false);
          }
        } else {
          toast.success(t("lineUpdated"));
        }
        pendingFileRef.current = null;
        onSaved();
      })();
      return;
    }
    toast.error(state.message);
  }, [pending, state, t, onSaved, orderId, line.id]);

  function clearBill() {
    setBillFile(null);
    setClearedExistingBill(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function openCreateVendor(name = "") {
    setCreateVendorName(name.trim());
    setCreateVendorOpen(true);
  }

  function handleVendorCreated(vendor: CreatedVendorSummary) {
    setVendors((prev) => {
      if (prev.some((row) => row.id === vendor.id)) return prev;
      return [...prev, { id: vendor.id, name: vendor.name }].sort((a, b) =>
        a.name.localeCompare(b.name),
      );
    });
    setVendorId(vendor.id);
    setVendorQuery("");
    setCreateVendorOpen(false);
    setCreateVendorName("");
  }

  function handleSave(formData: FormData) {
    if (!vendorId) {
      toast.error(ti("shopVendorRequired"));
      return;
    }
    if (!description.trim()) {
      toast.error(t("outsideWorkDescriptionRequired"));
      return;
    }
    const pricePaise = parseRupeesToPaise(priceText) ?? 0;
    if (pricePaise <= 0) {
      toast.error(t("outsideWorkAmountRequired"));
      return;
    }
    if (needsBill && !billFile && !hasExistingBill) {
      toast.error(t("outsideWorkBillRequired"));
      return;
    }

    pendingFileRef.current = billFile;
    const clean = new FormData();
    clean.set("type", "OUTSIDE");
    clean.set("partId", "");
    clean.set("quantity", "1");
    clean.set("description", description.trim());
    clean.set("unitPriceRupees", priceText.trim());
    clean.set("vendorId", vendorId);
    clean.set("gstSplit", gstSplit);
    clean.set("gstRatePercent", String(gstRatePercent));
    if (clearedExistingBill && !billFile) {
      clean.set("clearBill", "1");
    }
    for (const [key, value] of formData.entries()) {
      if (!clean.has(key)) clean.set(key, value);
    }
    formAction(clean);
  }

  const busy = pending || uploading;
  const cellPad = "align-middle px-3 py-2.5";

  if (editing && canMutate) {
    return (
      <>
        <TableRow className="bg-blue-50/40 hover:bg-blue-50/40">
          <TableCell className={cn(cellPad, "min-w-0")}>
            <form
              id={`outside-edit-${line.id}`}
              action={handleSave}
              className="contents"
            >
              <input type="hidden" name="type" value="OUTSIDE" />
              <input type="hidden" name="partId" value="" />
              <input type="hidden" name="quantity" value="1" />
              <input type="hidden" name="vendorId" value={vendorId} />
              <input type="hidden" name="gstSplit" value={gstSplit} />
              <input
                type="hidden"
                name="gstRatePercent"
                value={String(gstRatePercent)}
              />
              <input type="hidden" name="description" value={description} />
              <input type="hidden" name="unitPriceRupees" value={priceText} />
            </form>
            <SearchableSelect
              id={`outside-edit-vendor-${line.id}`}
              value={vendorId}
              onChange={setVendorId}
              clearable
              filter="remote"
              minQueryLength={0}
              onQueryChange={setVendorQuery}
              placeholder={ti("boughtFromPlaceholder")}
              searchPlaceholder={ti("boughtFromPlaceholder")}
              emptyLabel={ti("emptyVendorSearchQuickCreate")}
              disabled={busy || loadingVendors}
              options={vendorOptions}
              createFromQueryLabel={(query) =>
                ti("quickAddVendor", { name: query })
              }
              onCreateFromQuery={(query) => openCreateVendor(query)}
            />
          </TableCell>
          <TableCell className={cn(cellPad, "min-w-0")}>
            <Input
              required
              maxLength={500}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className={controlClass}
              placeholder={t("outsideWorkDescriptionPlaceholder")}
              disabled={busy}
            />
          </TableCell>
          <TableCell className={cn(cellPad, "min-w-0")}>
            <Input
              type="text"
              inputMode="decimal"
              required
              value={priceText}
              className={cn(controlClass, "tabular-nums")}
              disabled={busy}
              onFocus={(event) => {
                if (isZeroRupeesInput(event.currentTarget.value)) {
                  event.currentTarget.select();
                }
              }}
              onChange={(event) => {
                setPriceText(sanitizeRupeesTyping(event.target.value));
              }}
            />
          </TableCell>
          <TableCell className={cn(cellPad, "min-w-0")}>
            <FormSelect
              id={`outside-edit-gst-split-${line.id}`}
              value={gstSplit}
              options={gstSplitOptions}
              triggerClassName={cn(controlClass, "min-w-0")}
              disabled={busy}
              onValueChange={(value) => setGstSplit(value as GstSplitValue)}
            />
          </TableCell>
          <TableCell className={cn(cellPad, "min-w-0")}>
            <FormSelect
              id={`outside-edit-gst-rate-${line.id}`}
              value={String(gstRatePercent)}
              options={gstRateOptions}
              triggerClassName={cn(controlClass, "min-w-0")}
              disabled={busy}
              onValueChange={(value) => {
                if (
                  !GST_RATE_OPTIONS.includes(
                    Number(value) as (typeof GST_RATE_OPTIONS)[number],
                  )
                ) {
                  return;
                }
                const next = Number(value);
                setGstRatePercent(next);
                if (next === 0) clearBill();
              }}
            />
          </TableCell>
          <TableCell className={cn(cellPad, "text-center")}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              capture="environment"
              className="hidden"
              disabled={busy || !needsBill}
              onChange={(event) => {
                setBillFile(event.target.files?.[0] ?? null);
              }}
            />
            {(billFile || hasExistingBill) && needsBill ? (
              <div className="relative inline-flex size-11 shrink-0 items-center justify-center">
                {(billFile?.type.startsWith("image/") && billPreviewUrl) ||
                existingBillPreviewUrl ? (
                  <div className="size-11 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={billPreviewUrl ?? existingBillPreviewUrl ?? ""}
                      alt={billFile?.name ?? line.billFileName ?? t("outsideWorkBill")}
                      className="size-full object-cover"
                    />
                  </div>
                ) : (
                  <div
                    className="inline-flex size-11 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700 shadow-xs"
                    title={billFile?.name ?? line.billFileName ?? undefined}
                  >
                    <FileText className="size-4" aria-hidden />
                  </div>
                )}
                <button
                  type="button"
                  disabled={busy}
                  aria-label={ti("shopBillClear")}
                  title={ti("shopBillClear")}
                  className="absolute -top-1.5 -right-1.5 z-10 flex size-5 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm hover:bg-slate-800"
                  onClick={clearBill}
                >
                  <X className="size-3" aria-hidden />
                </button>
              </div>
            ) : (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                disabled={busy || !needsBill}
                aria-label={ti("shopBillChoose")}
                title={ti("shopBillChoose")}
                className="size-11 min-h-11 min-w-11 shrink-0 rounded-lg"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="size-4" aria-hidden />
              </Button>
            )}
          </TableCell>
          <TableCell
            className={cn(cellPad, "tabular-nums font-extrabold text-slate-950")}
          >
            {formatRupees(editTotals.totalPaise)}
          </TableCell>
          <TableCell className={cellPad}>
            <div className="flex items-center justify-end gap-3">
              <Button
                type="submit"
                form={`outside-edit-${line.id}`}
                variant="primary"
                size="icon"
                loading={busy}
                aria-label={t("saveLine")}
                title={t("saveLine")}
                className="size-11 min-h-11 min-w-11 shrink-0"
              >
                <Check className="size-5" strokeWidth={2.5} />
              </Button>
              <button
                type="button"
                className={actionBtnClass}
                aria-label={t("cancelEdit")}
                title={t("cancelEdit")}
                disabled={busy}
                onClick={onCancelEdit}
              >
                <X />
              </button>
            </div>
          </TableCell>
        </TableRow>

        <CreateVendorModal
          trigger={null}
          open={createVendorOpen}
          onOpenChange={setCreateVendorOpen}
          initialName={createVendorName}
          navigateOnSuccess={false}
          onCreated={handleVendorCreated}
        />
      </>
    );
  }

  return (
    <TableRow>
      <TableCell className={cellPad}>
        {line.vendorName?.trim() ? (
          <span className="font-medium text-slate-900">{line.vendorName}</span>
        ) : (
          <Dash />
        )}
      </TableCell>
      <TableCell className={cn(cellPad, "font-medium text-slate-900")}>
        {line.description}
      </TableCell>
      <TableCell className={cn(cellPad, "tabular-nums text-slate-800")}>
        {formatRupees(line.unitPricePaise as Paise)}
      </TableCell>
      <TableCell className={cellPad}>
        {line.gstSplit ? tb(`gstSplit.${line.gstSplit}`) : <Dash />}
      </TableCell>
      <TableCell className={cellPad}>
        {line.gstRatePercent != null ? `${line.gstRatePercent}%` : <Dash />}
      </TableCell>
      <TableCell className={cn(cellPad, "text-center")}>
        <BillLink
          orderId={orderId}
          lineId={line.id}
          hasBill={Boolean(line.billStorageKey)}
          fileName={line.billFileName}
        />
      </TableCell>
      <TableCell
        className={cn(cellPad, "tabular-nums font-extrabold text-slate-950")}
      >
        {formatRupees(viewTotals.totalPaise)}
      </TableCell>
      {canMutate ? (
        <TableCell className={cellPad}>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              className={actionBtnClass}
              aria-label={t("edit")}
              onClick={onEdit}
            >
              <Pencil />
            </button>
            <button
              type="button"
              className={cn(
                actionBtnClass,
                "border-red-200 text-red-700 hover:bg-red-50",
              )}
              aria-label={t("delete")}
              onClick={onAskDelete}
            >
              <Trash2 />
            </button>
          </div>
        </TableCell>
      ) : null}
    </TableRow>
  );
}

function DeleteOutsideWorkDialog({
  orderId,
  lineId,
  open,
  onOpenChange,
  onDeleted,
}: {
  orderId: string;
  lineId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const t = useTranslations("orders");
  const tc = useTranslations("common");
  const [removing, startRemove] = useTransition();

  function onConfirmDelete() {
    if (!lineId) return;
    startRemove(async () => {
      const result = await deleteServiceOrderLineAction(orderId, lineId);
      if (result.ok) {
        toast.success(result.message ?? t("lineRemoved"));
        onDeleted();
        return;
      }
      toast.error(result.message ?? t("errors.deleteFailed"));
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (removing) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle>{t("deleteLineTitle")}</DialogTitle>
          <DialogDescription>{t("deleteLineConfirm")}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 px-5 py-4 sm:justify-end">
          <DialogClose asChild>
            <Button
              type="button"
              variant="secondary"
              size="md"
              disabled={removing}
            >
              {tc("cancel")}
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="danger"
            size="md"
            loading={removing}
            onClick={onConfirmDelete}
          >
            {t("removeLine")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
