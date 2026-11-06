"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { FileText, Plus, Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  addServiceOrderLineAction,
  type ServiceOrderActionState,
} from "@/app/actions/service-orders";
import { getVendorOptionsAction } from "@/app/actions/vendors";
import {
  SyncInvoicePrompt,
  useInvoiceSyncPrompt,
  type BillSyncMode,
} from "@/modules/billing/components/sync-invoice-prompt";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
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

const initial: ServiceOrderActionState = { ok: false };

const controlClass =
  "h-11 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] shadow-xs outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/25";

type GstSplitValue = "CGST_SGST" | "IGST";

type VendorOption = { id: string; name: string };

type Props = {
  orderId: string;
  billSyncMode?: BillSyncMode;
};

export function OutsideWorkForm({ orderId, billSyncMode = "none" }: Props) {
  const t = useTranslations("orders");
  const tb = useTranslations("billing");
  const ti = useTranslations("inventory");
  const bound = useMemo(
    () => addServiceOrderLineAction.bind(null, orderId),
    [orderId],
  );
  const [state, formAction, pending] = useActionState(bound, initial);
  const wasPending = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [description, setDescription] = useState("");
  const [priceText, setPriceText] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [vendorQuery, setVendorQuery] = useState("");
  const [loadingVendors, startLoadVendors] = useTransition();
  const [createVendorOpen, setCreateVendorOpen] = useState(false);
  const [createVendorName, setCreateVendorName] = useState("");
  const [gstSplit, setGstSplit] = useState<GstSplitValue>("CGST_SGST");
  const [gstRatePercent, setGstRatePercent] = useState(0);
  const [billFile, setBillFile] = useState<File | null>(null);
  const [billPreviewUrl, setBillPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const pendingFileRef = useRef<File | null>(null);
  const successHandled = useRef<string | null>(null);
  const { syncOpen, setSyncOpen, offerSync } = useInvoiceSyncPrompt(
    orderId,
    billSyncMode,
  );

  const pricePaise = (parseRupeesToPaise(priceText) ?? 0) as Paise;
  const totals = computeLineGst({
    quantity: 1,
    unitPricePaise: pricePaise,
    gstRatePercent,
  });
  const needsBill = gstRatePercent > 0;

  useEffect(() => {
    startLoadVendors(() => {
      void getVendorOptionsAction().then(setVendors);
    });
  }, []);

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
    const finished = wasPending.current && !pending;
    wasPending.current = pending;
    if (!finished || !state.message) return;

    if (state.ok && state.lineId) {
      const handleKey = `${state.lineId}:${state.message}`;
      if (successHandled.current === handleKey) return;
      successHandled.current = handleKey;
      const lineId = state.lineId;
      const selected = pendingFileRef.current;

      void (async () => {
        if (selected) {
          setUploading(true);
          try {
            await uploadOutsideWorkBillFile({
              serviceOrderId: orderId,
              lineId,
              file: selected,
              uploadFailedMessage: t("outsideWorkBillUploadFailed"),
            });
            toast.success(t("outsideWorkAddedWithBill"));
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
          toast.success(t("outsideWorkAdded"));
        }
        pendingFileRef.current = null;
        setDescription("");
        setPriceText("");
        setVendorId("");
        setVendorQuery("");
        setGstSplit("CGST_SGST");
        setGstRatePercent(0);
        setBillFile(null);
        setFormKey((key) => key + 1);
        offerSync();
      })();
      return;
    }

    if (state.ok) {
      toast.success(t("outsideWorkAdded"));
      setDescription("");
      setPriceText("");
      setVendorId("");
      setVendorQuery("");
      setGstSplit("CGST_SGST");
      setGstRatePercent(0);
      setBillFile(null);
      setFormKey((key) => key + 1);
      offerSync();
      return;
    }
    toast.error(state.message);
  }, [pending, state, t, offerSync, orderId]);

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

  function clearBill() {
    setBillFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function billFileKind(file: File): "image" | "pdf" | "file" {
    if (file.type.startsWith("image/")) return "image";
    if (
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf")
    ) {
      return "pdf";
    }
    return "file";
  }

  function handleSubmit(formData: FormData) {
    if (!vendorId) {
      toast.error(ti("shopVendorRequired"));
      return;
    }
    if (!description.trim()) {
      toast.error(t("outsideWorkDescriptionRequired"));
      return;
    }
    if (pricePaise <= 0) {
      toast.error(t("outsideWorkAmountRequired"));
      return;
    }
    if (needsBill && !billFile) {
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
    formAction(clean);
  }

  const busy = pending || uploading;

  const vendorSelect = (
    <SearchableSelect
      id="outside-work-vendor"
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
      createFromQueryLabel={(query) => ti("quickAddVendor", { name: query })}
      onCreateFromQuery={(query) => openCreateVendor(query)}
    />
  );

  const billControl = (
    <>
      <input
        ref={fileInputRef}
        id="outside-work-bill"
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        capture="environment"
        className="hidden"
        disabled={busy || !needsBill}
        onChange={(event) => {
          setBillFile(event.target.files?.[0] ?? null);
        }}
      />
      {billFile && needsBill ? (
        <div className="relative inline-flex size-11 shrink-0 items-center justify-center">
          {billFileKind(billFile) === "image" && billPreviewUrl ? (
            <div className="size-11 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={billPreviewUrl}
                alt={billFile.name}
                className="size-full object-cover"
              />
            </div>
          ) : (
            <div
              className="inline-flex size-11 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700 shadow-xs"
              title={billFile.name}
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
    </>
  );

  return (
    <>
      <form
        key={formKey}
        action={handleSubmit}
        className="space-y-3"
      >
        <div className="hidden overflow-hidden rounded-xl border border-slate-300 lg:block">
          <Table className="w-full table-fixed">
            <colgroup>
              <col className="w-[24%]" />
              <col className="w-[29%]" />
              <col className="w-[6.5rem]" />
              <col className="w-36" />
              <col className="w-24" />
              <col className="w-16" />
              <col className="w-28" />
              <col className="w-16" />
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
                <TableHead className="px-2 py-2.5">
                  <span className="sr-only">{t("addLineAction")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-white hover:bg-white">
                <TableCell className="min-w-0 align-middle px-3 py-3">
                  <div className="min-w-0 w-full">{vendorSelect}</div>
                </TableCell>
                <TableCell className="min-w-0 align-middle px-3 py-3">
                  <Input
                    id="outside-work-description"
                    required
                    maxLength={500}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder={t("outsideWorkDescriptionPlaceholder")}
                    className={cn(controlClass, "min-w-0")}
                  />
                </TableCell>
                <TableCell className="min-w-0 align-middle px-3 py-3">
                  <Input
                    id="outside-work-unit-price"
                    type="text"
                    inputMode="decimal"
                    required
                    value={priceText}
                    placeholder="0"
                    className={cn(controlClass, "min-w-0 tabular-nums")}
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
                <TableCell className="min-w-0 align-middle px-3 py-3">
                  <FormSelect
                    id="outside-work-gst-split"
                    value={gstSplit}
                    options={gstSplitOptions}
                    triggerClassName={cn(controlClass, "min-w-0")}
                    onValueChange={(value) =>
                      setGstSplit(value as GstSplitValue)
                    }
                  />
                </TableCell>
                <TableCell className="min-w-0 align-middle px-3 py-3">
                  <FormSelect
                    id="outside-work-gst-rate"
                    value={String(gstRatePercent)}
                    options={gstRateOptions}
                    triggerClassName={cn(controlClass, "min-w-0")}
                    onValueChange={(value) => {
                      if (!GST_RATE_OPTIONS.includes(Number(value) as (typeof GST_RATE_OPTIONS)[number])) {
                        return;
                      }
                      const next = Number(value);
                      setGstRatePercent(next);
                      if (next === 0) clearBill();
                    }}
                  />
                </TableCell>
                <TableCell className="align-middle px-2 py-3">
                  <div className="flex h-11 min-h-11 items-center justify-center">
                    {billControl}
                  </div>
                </TableCell>
                <TableCell className="min-w-0 align-middle px-3 py-3">
                  <p className="flex h-11 min-h-11 items-center truncate text-[15px] font-extrabold tabular-nums text-slate-950">
                    {formatRupees(totals.totalPaise)}
                  </p>
                </TableCell>
                <TableCell className="align-middle px-2 py-3">
                  <div className="flex h-11 min-h-11 items-center justify-center">
                    <Button
                      type="submit"
                      variant="primary"
                      size="icon"
                      loading={busy}
                      aria-label={t("addLineAction")}
                      title={t("addLineAction")}
                      className="size-11 min-h-11 min-w-11 shrink-0"
                    >
                      <Plus className="size-5" strokeWidth={2.5} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-300 bg-white p-4 lg:hidden">
          <FormField id="outside-work-vendor-m" label={t("outsideWorkVendor")}>
            {vendorSelect}
          </FormField>
          <FormField
            id="outside-work-description-m"
            label={t("lineDescription")}
          >
            <Input
              id="outside-work-description-m"
              required
              maxLength={500}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t("outsideWorkDescriptionPlaceholder")}
              className={controlClass}
            />
          </FormField>
          <FormField
            id="outside-work-unit-price-m"
            label={t("outsideWorkAmount")}
          >
            <Input
              id="outside-work-unit-price-m"
              type="text"
              inputMode="decimal"
              required
              value={priceText}
              placeholder="0"
              className={cn(controlClass, "tabular-nums")}
              onFocus={(event) => {
                if (isZeroRupeesInput(event.currentTarget.value)) {
                  event.currentTarget.select();
                }
              }}
              onChange={(event) => {
                setPriceText(sanitizeRupeesTyping(event.target.value));
              }}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              id="outside-work-gst-split-m"
              label={t("outsideWorkGstSplit")}
            >
              <FormSelect
                id="outside-work-gst-split-m"
                value={gstSplit}
                options={gstSplitOptions}
                triggerClassName={controlClass}
                onValueChange={(value) => setGstSplit(value as GstSplitValue)}
              />
            </FormField>
            <FormField
              id="outside-work-gst-rate-m"
              label={t("outsideWorkGstRate")}
            >
              <FormSelect
                id="outside-work-gst-rate-m"
                value={String(gstRatePercent)}
                options={gstRateOptions}
                triggerClassName={controlClass}
                onValueChange={(value) => {
                  if (!GST_RATE_OPTIONS.includes(Number(value) as (typeof GST_RATE_OPTIONS)[number])) {
                    return;
                  }
                  const next = Number(value);
                  setGstRatePercent(next);
                  if (next === 0) clearBill();
                }}
              />
            </FormField>
          </div>
          <FormField id="outside-work-bill-m" label={t("outsideWorkBill")}>
            {billControl}
          </FormField>
          <div className="flex items-end justify-between gap-3 border-t border-slate-200 pt-3">
            <div>
              <p className="text-[13px] font-semibold text-slate-600">
                {t("outsideWorkTotal")}
              </p>
              <p className="mt-1 text-[18px] font-extrabold tabular-nums text-slate-950">
                {formatRupees(totals.totalPaise)}
              </p>
            </div>
            <Button
              type="submit"
              variant="primary"
              size="icon"
              loading={busy}
              aria-label={t("addLineAction")}
              title={t("addLineAction")}
              className="size-11 min-h-11 min-w-11 shrink-0"
            >
              <Plus className="size-5" strokeWidth={2.5} />
            </Button>
          </div>
        </div>
      </form>

      <CreateVendorModal
        trigger={null}
        open={createVendorOpen}
        onOpenChange={setCreateVendorOpen}
        initialName={createVendorName}
        navigateOnSuccess={false}
        onCreated={handleVendorCreated}
      />

      <SyncInvoicePrompt
        orderId={orderId}
        open={syncOpen}
        onOpenChange={setSyncOpen}
      />
    </>
  );
}
