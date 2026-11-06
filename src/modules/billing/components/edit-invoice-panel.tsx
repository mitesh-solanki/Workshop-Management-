"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { FileText, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  updateInvoiceLinesAction,
  type BillingActionState,
} from "@/app/actions/billing";
import { getOutsideWorkBillDownloadUrlAction } from "@/app/actions/service-orders";
import { getVendorOptionsAction } from "@/app/actions/vendors";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { FormSelect } from "@/components/ui/form-select";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "@/components/ui/toast";
import { getPartPickerItemAction } from "@/app/actions/inventory";
import {
  CreatePartModal,
  type CreatedPartSummary,
} from "@/modules/inventory/components/create-part-modal";
import { QuantityStepper } from "@/modules/inventory/components/quantity-stepper";
import {
  PartPickerSelect,
  type PartPickerItem,
} from "@/modules/inventory/components/part-picker-select";
import { partRequiresWarrantyCard } from "@/modules/warranties/part-requires-warranty";
import { InvoiceLineWarrantyModal } from "@/modules/warranties/components/invoice-line-warranty-modal";
import type { InvoiceWarrantyDoc } from "@/modules/warranties/components/invoice-warranty-panel";
import { pendingBalancePaise } from "@/modules/billing/balance";
import { computeLineGst, sumLineGstSplit } from "@/lib/gst";
import {
  defaultInvoiceGstRatePercent,
  resolveInvoiceEditLineTax,
  type InvoiceLineTypeValue,
} from "@/modules/billing/schema";
import { GST_RATE_OPTIONS } from "@/modules/estimates/schema";
import { uploadOutsideWorkBillFile } from "@/modules/service-orders/components/upload-outside-work-bill";
import {
  CreateVendorModal,
  type CreatedVendorSummary,
} from "@/modules/vendors/components/create-vendor-modal";
import {
  formatRupees,
  isZeroRupeesInput,
  paiseToRupeesInput,
  sanitizeRupeesTyping,
  type Paise,
} from "@/lib/money";
import { cn } from "@/lib/utils";

type GstSplitValue = "CGST_SGST" | "IGST";
type VendorOption = { id: string; name: string };

type OutsideWorkLineRef = {
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

type EditLine = {
  key: string;
  id?: string;
  type: InvoiceLineTypeValue;
  description: string;
  quantity: number;
  unitPricePaise: number;
  gstRatePercent: number;
  partId: string;
  vendorId: string;
  vendorName: string;
  gstSplit: GstSplitValue;
  billFile: File | null;
  billStorageKey: string | null;
  billFileName: string | null;
  orderLineId: string | null;
  priceKey: number;
};

export type InvoiceDraftTotals = {
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
  pendingBalancePaise: number;
};

type Props = {
  orderId: string;
  invoiceId: string;
  vehicleId: string;
  notes: string | null;
  gstSplit: "CGST_SGST" | "IGST";
  amountPaidPaise: number;
  creditNotesTotalPaise: number;
  lines: Array<{
    id: string;
    type: InvoiceLineTypeValue;
    description: string;
    quantity: number;
    unitPricePaise: number;
    gstRatePercent: number;
  }>;
  outsideWorkLines?: OutsideWorkLineRef[];
  warrantyDocs: InvoiceWarrantyDoc[];
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onDraftTotalsChange?: (totals: InvoiceDraftTotals | null) => void;
};

const initial: BillingActionState = { ok: false };

const controlClass =
  "h-11 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] shadow-xs focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/25";

function nextKey() {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function linesFromProps(
  lines: Props["lines"],
  outsideWorkLines: OutsideWorkLineRef[],
): EditLine[] {
  const pool = outsideWorkLines.map((line) => ({ ...line, claimed: false }));
  return lines.map((line) => {
    let matched: OutsideWorkLineRef | null = null;
    if (line.type === "OUTSIDE") {
      const hit =
        pool.find(
          (row) =>
            !row.claimed &&
            row.description === line.description &&
            row.unitPricePaise === line.unitPricePaise,
        ) ??
        pool.find(
          (row) => !row.claimed && row.description === line.description,
        );
      if (hit) {
        hit.claimed = true;
        matched = hit;
      }
    }
    return {
      key: line.id,
      id: line.id,
      type: line.type,
      description: line.description,
      quantity: line.quantity,
      unitPricePaise: line.unitPricePaise,
      gstRatePercent: resolveInvoiceEditLineTax({
        type: line.type,
        gstRatePercent:
          line.type === "OUTSIDE"
            ? line.gstRatePercent > 0
              ? line.gstRatePercent
              : (matched?.gstRatePercent ?? 0)
            : line.gstRatePercent,
      }).gstRatePercent,
      partId: "",
      vendorId: matched?.vendorId ?? "",
      vendorName: matched?.vendorName ?? "",
      gstSplit: matched?.gstSplit ?? "CGST_SGST",
      billFile: null,
      billStorageKey: matched?.billStorageKey ?? null,
      billFileName: matched?.billFileName ?? null,
      orderLineId: matched?.id ?? null,
      priceKey: 0,
    };
  });
}

function parseRupeesField(value: string): number {
  const cleaned = value.trim().replace(/,/g, "");
  if (cleaned === "") return 0;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function formatExpiryDate(
  value: Date | string | null,
  locale: string,
): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function docSignature(doc: InvoiceWarrantyDoc | null | undefined) {
  if (!doc) return "";
  const expiry =
    doc.warrantyExpiresAt instanceof Date
      ? doc.warrantyExpiresAt.toISOString()
      : (doc.warrantyExpiresAt ?? "");
  return `${doc.id}:${expiry}:${doc.storageKey ?? ""}`;
}

export function EditInvoiceTrigger({
  editing,
  onEditingChange,
  disabled,
  iconOnly = false,
}: {
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  disabled?: boolean;
  iconOnly?: boolean;
}) {
  const t = useTranslations("billing");
  return (
    <Button
      type="button"
      variant="outline"
      size={iconOnly ? "icon-sm" : "md"}
      className={iconOnly ? undefined : "min-h-11"}
      disabled={disabled}
      aria-label={editing ? t("cancelEditInvoice") : t("editInvoice")}
      onClick={() => onEditingChange(!editing)}
    >
      {iconOnly ? (
        editing ? (
          <X className="size-4" aria-hidden />
        ) : (
          <Pencil className="size-4" aria-hidden />
        )
      ) : editing ? (
        t("cancelEditInvoice")
      ) : (
        t("editInvoice")
      )}
    </Button>
  );
}

export function EditInvoicePanel({
  orderId,
  invoiceId,
  vehicleId,
  notes,
  gstSplit,
  amountPaidPaise,
  creditNotesTotalPaise,
  lines: initialLines,
  outsideWorkLines = [],
  warrantyDocs,
  editing,
  onEditingChange,
  onDraftTotalsChange,
}: Props) {
  const t = useTranslations("billing");
  const to = useTranslations("orders");
  const tw = useTranslations("warranties");
  const ti = useTranslations("inventory");
  const locale = useLocale();
  const router = useRouter();
  const formId = `edit-invoice-form-${invoiceId}`;
  const bound = useMemo(
    () => updateInvoiceLinesAction.bind(null, orderId, invoiceId),
    [orderId, invoiceId],
  );
  const [state, formAction, pending] = useActionState(bound, initial);
  const handled = useRef<string | null>(null);
  const pendingBillsRef = useRef<Array<File | null>>([]);
  const [rows, setRows] = useState<EditLine[]>(() =>
    linesFromProps(initialLines, outsideWorkLines),
  );
  const [addType, setAddType] = useState<InvoiceLineTypeValue>("PART");
  const [addDescription, setAddDescription] = useState("");
  const [addPartId, setAddPartId] = useState("");
  const [addGstRatePercent, setAddGstRatePercent] = useState(
    defaultInvoiceGstRatePercent("PART"),
  );
  const [addVendorId, setAddVendorId] = useState("");
  const [addGstSplit, setAddGstSplit] = useState<GstSplitValue>("CGST_SGST");
  const [addBillFile, setAddBillFile] = useState<File | null>(null);
  const [addQty, setAddQty] = useState(1);
  const [addPriceText, setAddPriceText] = useState("");
  const [addPriceKey, setAddPriceKey] = useState(0);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [vendorQuery, setVendorQuery] = useState("");
  const [loadingVendors, startLoadVendors] = useTransition();
  const [uploadingBills, setUploadingBills] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createInitialName, setCreateInitialName] = useState("");
  const [createForKey, setCreateForKey] = useState<string | null>(null);
  const [createVendorOpen, setCreateVendorOpen] = useState(false);
  const [createVendorName, setCreateVendorName] = useState("");
  const [createVendorForKey, setCreateVendorForKey] = useState<string | null>(
    null,
  );
  const [modalLineId, setModalLineId] = useState<string | null>(null);
  const [savingLineId, setSavingLineId] = useState<string | null>(null);
  const [savingBaseline, setSavingBaseline] = useState("");
  const pendingWarrantyRef = useRef<{
    description: string;
    quantity: number;
    unitPricePaise: number;
  } | null>(null);
  const addBillInputRef = useRef<HTMLInputElement | null>(null);

  const addRowKey = "__add__";

  const docsByLine = useMemo(() => {
    const map = new Map<string, InvoiceWarrantyDoc>();
    for (const doc of warrantyDocs) {
      if (doc.invoiceLineId) map.set(doc.invoiceLineId, doc);
    }
    return map;
  }, [warrantyDocs]);

  const gstSplitOptions = useMemo(
    () => [
      { value: "CGST_SGST", label: t("gstSplit.CGST_SGST") },
      { value: "IGST", label: t("gstSplit.IGST") },
    ],
    [t],
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
          for (const line of outsideWorkLines) {
            if (line.vendorId && line.vendorName && !map.has(line.vendorId)) {
              map.set(line.vendorId, {
                id: line.vendorId,
                name: line.vendorName,
              });
            }
          }
          return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
        });
      });
    });
  }, [editing, outsideWorkLines]);

  useEffect(() => {
    if (!editing) {
      onDraftTotalsChange?.(null);
      return;
    }
    setRows(linesFromProps(initialLines, outsideWorkLines));
    setAddType("PART");
    setAddDescription("");
    setAddPartId("");
    setAddVendorId("");
    setAddGstSplit("CGST_SGST");
    setAddBillFile(null);
    setAddGstRatePercent(defaultInvoiceGstRatePercent("PART"));
    setAddQty(1);
    setAddPriceText("");
    setAddPriceKey((key) => key + 1);
    setModalLineId(null);
    handled.current = null;
  }, [editing, initialLines, outsideWorkLines, onDraftTotalsChange]);

  useEffect(() => {
    if (!editing) return;
    const sameState = gstSplit === "CGST_SGST";
    const gst = sumLineGstSplit(
      rows.map((row) => ({
        quantity: row.type === "PART" ? row.quantity : 1,
        unitPricePaise: row.unitPricePaise as Paise,
        gstRatePercent: row.gstRatePercent,
      })),
      sameState,
    );
    onDraftTotalsChange?.({
      taxablePaise: gst.taxablePaise,
      cgstPaise: gst.cgstPaise,
      sgstPaise: gst.sgstPaise,
      igstPaise: gst.igstPaise,
      totalPaise: gst.totalPaise,
      pendingBalancePaise: pendingBalancePaise({
        totalPaise: gst.totalPaise,
        amountPaidPaise: amountPaidPaise as Paise,
        creditNotesTotalPaise: creditNotesTotalPaise as Paise,
      }),
    });
  }, [
    editing,
    rows,
    gstSplit,
    amountPaidPaise,
    creditNotesTotalPaise,
    onDraftTotalsChange,
  ]);

  useEffect(() => {
    if (!state.message || state.message === handled.current) return;
    handled.current = state.message;
    if (state.ok) {
      const pendingWarranty = pendingWarrantyRef.current;
      pendingWarrantyRef.current = null;
      const billFiles = pendingBillsRef.current;
      pendingBillsRef.current = [];

      void (async () => {
        if (state.savedLines && billFiles.some(Boolean)) {
          setUploadingBills(true);
          try {
            for (let index = 0; index < state.savedLines.length; index += 1) {
              const saved = state.savedLines[index]!;
              const file = billFiles[index] ?? null;
              if (
                !file ||
                saved.type !== "OUTSIDE" ||
                !saved.orderLineId
              ) {
                continue;
              }
              try {
                await uploadOutsideWorkBillFile({
                  serviceOrderId: orderId,
                  lineId: saved.orderLineId,
                  file,
                  uploadFailedMessage: to("outsideWorkBillUploadFailed"),
                });
              } catch (err) {
                const message =
                  err instanceof Error
                    ? err.message
                    : to("outsideWorkBillUploadFailed");
                toast.error(
                  to("outsideWorkAddedButUploadFailed", { reason: message }),
                );
              }
            }
          } finally {
            setUploadingBills(false);
          }
        }

        toast.success(
          state.message === "invoiceUpdated"
            ? t("invoiceUpdated")
            : state.message,
        );

        if (
          pendingWarranty &&
          state.savedLines &&
          state.savedLines.length > 0
        ) {
          const partMatches = state.savedLines.filter(
            (line) =>
              line.type === "PART" &&
              line.description === pendingWarranty.description,
          );
          const match =
            partMatches.find(
              (line) =>
                line.quantity === pendingWarranty.quantity &&
                line.unitPricePaise === pendingWarranty.unitPricePaise,
            ) ?? partMatches[partMatches.length - 1];
          setRows(
            state.savedLines.map((line) => ({
              key: line.id,
              id: line.id,
              type: line.type as InvoiceLineTypeValue,
              description: line.description,
              quantity: line.quantity,
              unitPricePaise: line.unitPricePaise,
              gstRatePercent: resolveInvoiceEditLineTax({
                type: line.type,
                gstRatePercent: line.gstRatePercent,
              }).gstRatePercent,
              partId: "",
              vendorId: "",
              vendorName: "",
              gstSplit: "CGST_SGST" as GstSplitValue,
              billFile: null,
              billStorageKey: null,
              billFileName: null,
              orderLineId: line.orderLineId ?? null,
              priceKey: 0,
            })),
          );
          if (match) {
            setModalLineId(match.id);
          }
          router.refresh();
          return;
        }
        onEditingChange(false);
        router.refresh();
      })();
      return;
    }
    pendingWarrantyRef.current = null;
    pendingBillsRef.current = [];
    toast.error(state.message);
  }, [state, t, to, onEditingChange, router, orderId]);

  useEffect(() => {
    if (!savingLineId) return;
    const next = docSignature(docsByLine.get(savingLineId));
    if (next !== savingBaseline) {
      setSavingLineId(null);
      setSavingBaseline("");
    }
  }, [docsByLine, savingLineId, savingBaseline]);

  const typeOptions = useMemo(
    () => [
      { value: "PART", label: t("lineTypes.PART") },
      { value: "LABOUR", label: t("lineTypes.LABOUR") },
      { value: "OUTSIDE", label: t("lineTypes.OUTSIDE") },
    ],
    [t],
  );

  const modalLine = rows.find((row) => row.id === modalLineId) ?? null;
  const modalDoc = modalLine?.id
    ? (docsByLine.get(modalLine.id) ?? null)
    : null;

  if (!editing) {
    return null;
  }

  function updateRow(key: string, patch: Partial<EditLine>) {
    setRows((prev) =>
      prev.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }

  function removeRow(key: string) {
    setRows((prev) =>
      prev.length <= 1 ? prev : prev.filter((row) => row.key !== key),
    );
  }

  function onPartPicked(key: string, partId: string, part: PartPickerItem | null) {
    if (!part) {
      updateRow(key, { partId: "", description: "" });
      return;
    }
    const current = rows.find((row) => row.key === key);
    const type = current?.type ?? "PART";
    updateRow(key, {
      partId,
      description: part.name,
      unitPricePaise:
        part.sellingPricePaise > 0
          ? part.sellingPricePaise
          : current?.unitPricePaise ?? 0,
      gstRatePercent: resolveInvoiceEditLineTax({
        type,
        part: {
          gstRatePercent:
            "gstRatePercent" in part &&
            typeof part.gstRatePercent === "number"
              ? part.gstRatePercent
              : null,
        },
      }).gstRatePercent,
      priceKey: (current?.priceKey ?? 0) + 1,
    });
  }

  function openCreatePart(lineKey: string, name = "") {
    setCreateForKey(lineKey);
    setCreateInitialName(name.trim());
    setCreateOpen(true);
  }

  function openCreateVendor(lineKey: string | null, name = "") {
    setCreateVendorForKey(lineKey);
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
    if (createVendorForKey === addRowKey) {
      setAddVendorId(vendor.id);
    } else if (createVendorForKey) {
      updateRow(createVendorForKey, {
        vendorId: vendor.id,
        vendorName: vendor.name,
      });
    }
    setCreateVendorOpen(false);
    setCreateVendorName("");
    setCreateVendorForKey(null);
  }

  function handleSave(formData: FormData) {
    for (const row of rows) {
      if (row.type !== "OUTSIDE") continue;
      if (!row.vendorId) {
        toast.error(ti("shopVendorRequired"));
        return;
      }
      if (row.gstRatePercent > 0 && !row.billFile && !row.billStorageKey) {
        toast.error(to("outsideWorkBillRequired"));
        return;
      }
    }
    pendingBillsRef.current = rows.map((row) =>
      row.type === "OUTSIDE" ? row.billFile : null,
    );
    formAction(formData);
  }

  async function handlePartCreated(part: CreatedPartSummary) {
    const full = await getPartPickerItemAction(part.id);
    const sellingPricePaise = full?.sellingPricePaise ?? 0;
    const gstRatePercent =
      full && typeof full.gstRatePercent === "number"
        ? full.gstRatePercent
        : defaultInvoiceGstRatePercent("PART");
    if (createForKey === addRowKey) {
      setAddType("PART");
      setAddPartId(part.id);
      setAddDescription(part.name);
      setAddGstRatePercent(gstRatePercent);
      if (sellingPricePaise > 0) {
        setAddPriceText(paiseToRupeesInput(sellingPricePaise as Paise));
      }
      setAddPriceKey((key) => key + 1);
    } else if (createForKey) {
      onPartPicked(createForKey, part.id, {
        id: part.id,
        name: part.name,
        sku: part.sku,
        unit: part.unit,
        sellingPricePaise,
        gstRatePercent,
        quantityOnHand: full?.quantityOnHand ?? 0,
      });
    }
    setCreateOpen(false);
    setCreateInitialName("");
    setCreateForKey(null);
  }

  function addRow() {
    const description = addDescription.trim();
    if (addType === "PART" && !addPartId) {
      toast.error(ti("errors.partRequired"));
      return;
    }
    if (addType === "OUTSIDE" && !addVendorId) {
      toast.error(ti("shopVendorRequired"));
      return;
    }
    if (!description) {
      toast.error(t("errors.editNeedItem"));
      return;
    }
    if (
      addType === "OUTSIDE" &&
      addGstRatePercent > 0 &&
      !addBillFile
    ) {
      toast.error(to("outsideWorkBillRequired"));
      return;
    }
    const vendorName =
      vendors.find((vendor) => vendor.id === addVendorId)?.name ?? "";
    setRows((prev) => [
      ...prev,
      {
        key: nextKey(),
        type: addType,
        description,
        quantity: addType === "PART" ? addQty : 1,
        unitPricePaise: parseRupeesField(addPriceText) as Paise,
        gstRatePercent:
          addType === "PART" || addType === "OUTSIDE"
            ? addGstRatePercent
            : defaultInvoiceGstRatePercent(addType),
        partId: addType === "PART" ? addPartId : "",
        vendorId: addType === "OUTSIDE" ? addVendorId : "",
        vendorName: addType === "OUTSIDE" ? vendorName : "",
        gstSplit: addType === "OUTSIDE" ? addGstSplit : "CGST_SGST",
        billFile: addType === "OUTSIDE" ? addBillFile : null,
        billStorageKey: null,
        billFileName: null,
        orderLineId: null,
        priceKey: 0,
      },
    ]);
    setAddDescription("");
    setAddPartId("");
    setAddVendorId("");
    setAddGstSplit("CGST_SGST");
    setAddBillFile(null);
    setAddGstRatePercent(defaultInvoiceGstRatePercent("PART"));
    setAddQty(1);
    setAddPriceText("");
    setAddPriceKey((key) => key + 1);
  }

  const busy = pending || uploadingBills;

  function warrantyButton(row: EditLine) {
    if (row.type !== "PART") {
      return (
        <span className="inline-flex h-11 min-h-11 items-center justify-center text-slate-400">
          —
        </span>
      );
    }
    const doc = row.id ? (docsByLine.get(row.id) ?? null) : null;
    const required = partRequiresWarrantyCard(row.description);
    const hasCard = Boolean(doc && (doc.storageKey || doc.warrantyExpiresAt));
    const incomplete =
      required && !(doc?.storageKey && doc.warrantyExpiresAt);
    const expiryLabel = formatExpiryDate(doc?.warrantyExpiresAt ?? null, locale);
    const saving = Boolean(row.id && savingLineId === row.id);

    return (
      <div className="space-y-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={saving || pending}
          className={cn(
            "h-9 min-h-9 w-full min-w-28 px-2 text-[12px]",
            incomplete && !saving && "border-amber-300 text-amber-900",
          )}
          onClick={() => {
            if (saving || pending) return;
            if (row.id) {
              setModalLineId(row.id);
              return;
            }
            if (!row.description.trim()) {
              toast.error(t("errors.editNeedItem"));
              return;
            }
            pendingWarrantyRef.current = {
              description: row.description.trim(),
              quantity: row.quantity,
              unitPricePaise: row.unitPricePaise,
            };
            const form = document.getElementById(formId);
            if (form instanceof HTMLFormElement) {
              form.requestSubmit();
            }
          }}
        >
          {saving || pending
            ? tw("saving")
            : hasCard
              ? tw("editLine")
              : tw("addLine")}
        </Button>
        {expiryLabel ? (
          <p className="text-[11px] leading-snug text-slate-600">
            {tw("lineExpiresOn", { date: expiryLabel })}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4 border-b border-slate-200 bg-white px-4 py-4">
      <p className="text-[13px] text-slate-600">{t("editInvoiceHint")}</p>

      <div className="overflow-hidden rounded-xl border border-slate-300">
        <form action={handleSave} id={formId}>
          <input type="hidden" name="notes" value={notes ?? ""} />

          <div className="hidden border-b border-slate-200 bg-slate-100 px-4 py-2.5 lg:grid lg:grid-cols-[8rem_minmax(0,1fr)_9rem_9.5rem_8.5rem_2.75rem] lg:gap-3">
            <p className="text-[13px] font-semibold text-slate-700">
              {t("lineType")}
            </p>
            <p className="text-[13px] font-semibold text-slate-700">
              {t("lineDescription")}
            </p>
            <p className="text-center text-[13px] font-semibold text-slate-700">
              {t("quantity")}
            </p>
            <p className="text-[13px] font-semibold text-slate-700">
              {t("unitPrice")}
            </p>
            <p className="text-[13px] font-semibold text-slate-700">
              {tw("columnWarranty")}
            </p>
            <span className="sr-only">{t("removeLine")}</span>
          </div>

          <ul className="divide-y divide-slate-200">
            {rows.map((row) => (
              <li key={row.key} className="space-y-3 bg-white px-4 py-3">
                <input type="hidden" name="lineId" value={row.id ?? ""} />
                <input
                  type="hidden"
                  name="partId"
                  value={row.type === "PART" ? row.partId : ""}
                />
                <input
                  type="hidden"
                  name="vendorId"
                  value={row.type === "OUTSIDE" ? row.vendorId : ""}
                />
                <input
                  type="hidden"
                  name="gstSplit"
                  value={row.type === "OUTSIDE" ? row.gstSplit : ""}
                />
                <input
                  type="hidden"
                  name="gstRatePercent"
                  value={String(row.gstRatePercent)}
                />
                {row.type === "OUTSIDE" ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-end gap-3">
                      <FormField
                        id={`edit-type-${row.key}`}
                        label={t("lineType")}
                        className="w-full min-w-0 sm:w-40"
                      >
                        <FormSelect
                          id={`edit-type-${row.key}`}
                          name="type"
                          required
                          value={row.type}
                          options={typeOptions}
                          triggerClassName={controlClass}
                          disabled={busy}
                          onValueChange={(value) => {
                            const next = value as InvoiceLineTypeValue;
                            updateRow(row.key, {
                              type: next,
                              quantity: next === "PART" ? row.quantity : 1,
                              partId: next === "PART" ? row.partId : "",
                              vendorId: next === "OUTSIDE" ? row.vendorId : "",
                              gstSplit:
                                next === "OUTSIDE" ? row.gstSplit : "CGST_SGST",
                              gstRatePercent:
                                defaultInvoiceGstRatePercent(next),
                              billFile:
                                next === "OUTSIDE" ? row.billFile : null,
                            });
                          }}
                        />
                      </FormField>
                      <input type="hidden" name="quantity" value="1" />
                      <input
                        type="hidden"
                        name="description"
                        value={row.description}
                      />
                      <input
                        type="hidden"
                        name="unitPriceRupees"
                        value={paiseToRupeesInput(row.unitPricePaise as Paise)}
                      />
                      <div className="ml-auto flex items-end pb-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={rows.length <= 1 || busy}
                          onClick={() => removeRow(row.key)}
                          aria-label={t("removeLine")}
                          className="text-red-700 hover:bg-red-50 hover:text-red-800"
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                      <FormField
                        id={`edit-outside-vendor-${row.key}`}
                        label={to("outsideWorkVendor")}
                        className="w-full min-w-0 sm:w-56 sm:max-w-56"
                      >
                        <SearchableSelect
                          id={`edit-outside-vendor-${row.key}`}
                          value={row.vendorId}
                          onChange={(vendorId) =>
                            updateRow(row.key, {
                              vendorId,
                              vendorName:
                                vendors.find((vendor) => vendor.id === vendorId)
                                  ?.name ?? row.vendorName,
                            })
                          }
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
                          onCreateFromQuery={(query) =>
                            openCreateVendor(row.key, query)
                          }
                        />
                      </FormField>
                      <FormField
                        id={`edit-outside-desc-${row.key}`}
                        label={t("lineDescription")}
                        className="min-w-0 flex-1 sm:min-w-[12rem]"
                      >
                        <Input
                          id={`edit-outside-desc-${row.key}`}
                          required
                          maxLength={500}
                          value={row.description}
                          onChange={(event) =>
                            updateRow(row.key, {
                              description: event.target.value,
                            })
                          }
                          className={controlClass}
                          placeholder={to("outsideWorkDescriptionPlaceholder")}
                          disabled={busy}
                        />
                      </FormField>
                      <FormField
                        id={`edit-outside-price-${row.key}`}
                        label={to("outsideWorkAmount")}
                        className="w-full min-w-0 sm:w-28"
                      >
                        <Input
                          key={`price-${row.key}-${row.priceKey}`}
                          id={`edit-outside-price-${row.key}`}
                          type="text"
                          inputMode="decimal"
                          required
                          defaultValue={paiseToRupeesInput(
                            row.unitPricePaise as Paise,
                          )}
                          className={cn(controlClass, "tabular-nums")}
                          disabled={busy}
                          onFocus={(event) => {
                            if (isZeroRupeesInput(event.currentTarget.value)) {
                              event.currentTarget.select();
                            }
                          }}
                          onChange={(event) => {
                            event.currentTarget.value = sanitizeRupeesTyping(
                              event.currentTarget.value,
                            );
                            updateRow(row.key, {
                              unitPricePaise: parseRupeesField(
                                event.currentTarget.value,
                              ),
                            });
                          }}
                        />
                      </FormField>
                      <FormField
                        id={`edit-outside-gst-split-${row.key}`}
                        label={to("outsideWorkGstSplit")}
                        className="w-full min-w-0 sm:w-36 sm:max-w-36"
                      >
                        <FormSelect
                          id={`edit-outside-gst-split-${row.key}`}
                          value={row.gstSplit}
                          options={gstSplitOptions}
                          triggerClassName={controlClass}
                          disabled={busy}
                          onValueChange={(value) =>
                            updateRow(row.key, {
                              gstSplit: value as GstSplitValue,
                            })
                          }
                        />
                      </FormField>
                      <FormField
                        id={`edit-outside-gst-rate-${row.key}`}
                        label={to("outsideWorkGstRate")}
                        className="w-full min-w-0 sm:w-24 sm:max-w-24"
                      >
                        <FormSelect
                          id={`edit-outside-gst-rate-${row.key}`}
                          value={String(row.gstRatePercent)}
                          options={gstRateOptions}
                          triggerClassName={controlClass}
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
                            updateRow(row.key, {
                              gstRatePercent: next,
                              ...(next === 0
                                ? {
                                    billFile: null,
                                    billStorageKey: null,
                                    billFileName: null,
                                  }
                                : {}),
                            });
                          }}
                        />
                      </FormField>
                      <FormField
                        id={`edit-outside-bill-${row.key}`}
                        label={to("outsideWorkBill")}
                        className="w-auto shrink-0"
                      >
                        <OutsideBillControl
                          disabled={busy || row.gstRatePercent <= 0}
                          file={row.billFile}
                          existingName={row.billFileName}
                          hasExisting={Boolean(row.billStorageKey)}
                          existingOrderId={orderId}
                          existingLineId={row.orderLineId}
                          onPick={(file) =>
                            updateRow(row.key, {
                              billFile: file,
                              billStorageKey: file ? null : row.billStorageKey,
                            })
                          }
                          onClear={() =>
                            updateRow(row.key, {
                              billFile: null,
                              billStorageKey: null,
                              billFileName: null,
                            })
                          }
                          chooseLabel={ti("shopBillChoose")}
                          clearLabel={ti("shopBillClear")}
                        />
                      </FormField>
                      <div className="ml-auto w-full min-w-0 text-right sm:w-28">
                        <p className="mb-1.5 text-[13px] font-semibold text-slate-600">
                          {to("outsideWorkTotal")}
                        </p>
                        <p className="flex h-11 min-h-11 items-center justify-end text-[15px] font-extrabold tabular-nums text-slate-950">
                          {formatRupees(
                            computeLineGst({
                              quantity: 1,
                              unitPricePaise: row.unitPricePaise as Paise,
                              gstRatePercent: row.gstRatePercent,
                            }).totalPaise,
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[8rem_minmax(0,1fr)_9rem_9.5rem_8.5rem_2.75rem]">
                    <FormField
                      id={`edit-type-${row.key}`}
                      label={t("lineType")}
                      className="lg:[&>label]:sr-only"
                    >
                      <FormSelect
                        id={`edit-type-${row.key}`}
                        name="type"
                        required
                        value={row.type}
                        options={typeOptions}
                        triggerClassName={controlClass}
                        disabled={busy}
                        onValueChange={(value) => {
                          const next = value as InvoiceLineTypeValue;
                          updateRow(row.key, {
                            type: next,
                            quantity: next === "PART" ? row.quantity : 1,
                            partId: next === "PART" ? row.partId : "",
                            vendorId: next === "OUTSIDE" ? row.vendorId : "",
                            gstSplit:
                              next === "OUTSIDE" ? row.gstSplit : "CGST_SGST",
                            gstRatePercent: defaultInvoiceGstRatePercent(next),
                            billFile: next === "OUTSIDE" ? row.billFile : null,
                          });
                        }}
                      />
                    </FormField>

                    <FormField
                      id={`edit-desc-${row.key}`}
                      label={
                        row.type === "PART" ? ti("part") : t("lineDescription")
                      }
                      className="sm:col-span-2 lg:col-span-1 lg:[&>label]:sr-only"
                    >
                      {row.type === "PART" ? (
                        <>
                          <PartPickerSelect
                            id={`edit-part-${row.key}`}
                            value={row.partId}
                            initialLabel={row.description}
                            clearable={false}
                            disabled={pending}
                            onChange={(partId, part) =>
                              onPartPicked(row.key, partId, part)
                            }
                            onCreateFromQuery={(name) =>
                              openCreatePart(row.key, name)
                            }
                          />
                          <input
                            type="hidden"
                            name="description"
                            value={row.description}
                          />
                        </>
                      ) : (
                        <Input
                          id={`edit-desc-${row.key}`}
                          name="description"
                          required
                          maxLength={500}
                          value={row.description}
                          onChange={(event) =>
                            updateRow(row.key, {
                              description: event.target.value,
                            })
                          }
                          className={controlClass}
                          placeholder={to("lineDescriptionPlaceholder")}
                        />
                      )}
                    </FormField>

                    {row.type === "PART" ? (
                      <QuantityStepper
                        key={`qty-${row.key}-${row.quantity}`}
                        id={`edit-qty-${row.key}`}
                        name="quantity"
                        label={t("quantity")}
                        defaultValue={row.quantity}
                        min={1}
                        form={formId}
                        onValueChange={(quantity) =>
                          updateRow(row.key, { quantity })
                        }
                        className="lg:[&>label]:sr-only"
                      />
                    ) : (
                      <>
                        <input type="hidden" name="quantity" value="1" />
                        <div className="hidden h-11 min-h-11 items-center justify-center text-[14px] text-slate-400 lg:flex">
                          —
                        </div>
                      </>
                    )}

                    <FormField
                      id={`edit-price-${row.key}`}
                      label={t("unitPrice")}
                      className="lg:[&>label]:sr-only"
                    >
                      <Input
                        key={`price-${row.key}-${row.priceKey}`}
                        id={`edit-price-${row.key}`}
                        name="unitPriceRupees"
                        type="text"
                        inputMode="decimal"
                        required
                        defaultValue={paiseToRupeesInput(
                          row.unitPricePaise as Paise,
                        )}
                        className={cn(controlClass, "tabular-nums")}
                        onFocus={(event) => {
                          if (isZeroRupeesInput(event.currentTarget.value)) {
                            event.currentTarget.select();
                          }
                        }}
                        onChange={(event) => {
                          event.currentTarget.value = sanitizeRupeesTyping(
                            event.currentTarget.value,
                          );
                          updateRow(row.key, {
                            unitPricePaise: parseRupeesField(
                              event.currentTarget.value,
                            ),
                          });
                        }}
                      />
                    </FormField>

                    <div>
                      <p className="mb-1.5 text-[13px] font-semibold text-slate-600 lg:hidden">
                        {tw("columnWarranty")}
                      </p>
                      {warrantyButton(row)}
                    </div>

                    <div className="flex items-end justify-end pb-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={rows.length <= 1 || busy}
                        onClick={() => removeRow(row.key)}
                        aria-label={t("removeLine")}
                        className="text-red-700 hover:bg-red-50 hover:text-red-800"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </form>

        <div className="space-y-3 border-t border-slate-200 bg-[#fafcff] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className="text-[14px] font-semibold text-slate-900">
              {t("addInvoiceLine")}
            </strong>
            <small className="text-[13px] text-slate-500">
              {t("editInvoiceAddHint")}
            </small>
          </div>
          {addType === "OUTSIDE" ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <FormField
                  id="add-type"
                  label={t("lineType")}
                  className="w-full min-w-0 sm:w-40"
                >
                  <FormSelect
                    id="add-type"
                    required
                    value={addType}
                    options={typeOptions}
                    triggerClassName={controlClass}
                    disabled={busy}
                    onValueChange={(value) => {
                      const next = value as InvoiceLineTypeValue;
                      setAddType(next);
                      setAddPartId("");
                      setAddDescription("");
                      setAddVendorId("");
                      setAddGstSplit("CGST_SGST");
                      setAddBillFile(null);
                      setAddGstRatePercent(defaultInvoiceGstRatePercent(next));
                      if (next !== "PART") setAddQty(1);
                      setAddPriceKey((key) => key + 1);
                    }}
                  />
                </FormField>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  className="ml-auto h-11 min-h-11 gap-1.5 px-4"
                  disabled={busy || !addVendorId || !addDescription.trim()}
                  onClick={addRow}
                >
                  <Plus className="size-4" strokeWidth={2.5} aria-hidden />
                  {t("addInvoiceLine")}
                </Button>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <FormField
                  id="add-outside-vendor"
                  label={to("outsideWorkVendor")}
                  className="w-full min-w-0 sm:w-56 sm:max-w-56"
                >
                  <SearchableSelect
                    id="add-outside-vendor"
                    value={addVendorId}
                    onChange={setAddVendorId}
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
                    onCreateFromQuery={(query) =>
                      openCreateVendor(addRowKey, query)
                    }
                  />
                </FormField>
                <FormField
                  id="add-description"
                  label={t("lineDescription")}
                  className="min-w-0 flex-1 sm:min-w-[12rem]"
                >
                  <Input
                    id="add-description"
                    maxLength={500}
                    value={addDescription}
                    disabled={busy}
                    onChange={(event) => setAddDescription(event.target.value)}
                    placeholder={to("outsideWorkDescriptionPlaceholder")}
                    className={controlClass}
                  />
                </FormField>
                <FormField
                  id="add-unit-price"
                  label={to("outsideWorkAmount")}
                  className="w-full min-w-0 sm:w-28"
                >
                  <Input
                    key={`add-price-${addPriceKey}`}
                    id="add-unit-price"
                    type="text"
                    inputMode="decimal"
                    value={addPriceText}
                    placeholder="0"
                    disabled={busy}
                    className={cn(controlClass, "tabular-nums")}
                    onFocus={(event) => {
                      if (isZeroRupeesInput(event.currentTarget.value)) {
                        event.currentTarget.select();
                      }
                    }}
                    onChange={(event) => {
                      setAddPriceText(sanitizeRupeesTyping(event.target.value));
                    }}
                  />
                </FormField>
                <FormField
                  id="add-outside-gst-split"
                  label={to("outsideWorkGstSplit")}
                  className="w-full min-w-0 sm:w-36 sm:max-w-36"
                >
                  <FormSelect
                    id="add-outside-gst-split"
                    value={addGstSplit}
                    options={gstSplitOptions}
                    triggerClassName={controlClass}
                    disabled={busy}
                    onValueChange={(value) =>
                      setAddGstSplit(value as GstSplitValue)
                    }
                  />
                </FormField>
                <FormField
                  id="add-outside-gst-rate"
                  label={to("outsideWorkGstRate")}
                  className="w-full min-w-0 sm:w-24 sm:max-w-24"
                >
                  <FormSelect
                    id="add-outside-gst-rate"
                    value={String(addGstRatePercent)}
                    options={gstRateOptions}
                    triggerClassName={controlClass}
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
                      setAddGstRatePercent(next);
                      if (next === 0) setAddBillFile(null);
                    }}
                  />
                </FormField>
                <FormField
                  id="add-outside-bill"
                  label={to("outsideWorkBill")}
                  className="w-auto shrink-0"
                >
                  <input
                    ref={addBillInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    capture="environment"
                    className="hidden"
                    disabled={busy || addGstRatePercent <= 0}
                    onChange={(event) => {
                      setAddBillFile(event.target.files?.[0] ?? null);
                    }}
                  />
                  <OutsideBillControl
                    disabled={busy || addGstRatePercent <= 0}
                    file={addBillFile}
                    existingName={null}
                    hasExisting={false}
                    onPick={(file) => setAddBillFile(file)}
                    onClear={() => {
                      setAddBillFile(null);
                      if (addBillInputRef.current) {
                        addBillInputRef.current.value = "";
                      }
                    }}
                    onBrowse={() => addBillInputRef.current?.click()}
                    chooseLabel={ti("shopBillChoose")}
                    clearLabel={ti("shopBillClear")}
                  />
                </FormField>
                <div className="ml-auto w-full min-w-0 text-right sm:w-28">
                  <p className="mb-1.5 text-[13px] font-semibold text-slate-600">
                    {to("outsideWorkTotal")}
                  </p>
                  <p className="flex h-11 min-h-11 items-center justify-end text-[15px] font-extrabold tabular-nums text-slate-950">
                    {formatRupees(
                      computeLineGst({
                        quantity: 1,
                        unitPricePaise: parseRupeesField(addPriceText) as Paise,
                        gstRatePercent: addGstRatePercent,
                      }).totalPaise,
                    )}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div
              className={cn(
                "grid grid-cols-1 items-end gap-3 sm:grid-cols-2",
                addType === "PART"
                  ? "lg:grid-cols-[8rem_minmax(0,1fr)_9rem_9.5rem_auto]"
                  : "lg:grid-cols-[8rem_minmax(0,1fr)_9.5rem_auto]",
              )}
            >
              <FormField id="add-type" label={t("lineType")}>
                <FormSelect
                  id="add-type"
                  required
                  value={addType}
                  options={typeOptions}
                  triggerClassName={controlClass}
                  disabled={busy}
                  onValueChange={(value) => {
                    const next = value as InvoiceLineTypeValue;
                    setAddType(next);
                    setAddPartId("");
                    setAddDescription("");
                    setAddVendorId("");
                    setAddGstSplit("CGST_SGST");
                    setAddBillFile(null);
                    setAddGstRatePercent(defaultInvoiceGstRatePercent(next));
                    if (next !== "PART") setAddQty(1);
                    setAddPriceKey((key) => key + 1);
                  }}
                />
              </FormField>
              <FormField
                id="add-description"
                label={addType === "PART" ? ti("part") : t("lineDescription")}
                className="sm:col-span-2 lg:col-span-1"
              >
                {addType === "PART" ? (
                  <PartPickerSelect
                    key={`add-part-${addPriceKey}`}
                    id="add-part"
                    value={addPartId}
                    clearable={false}
                    disabled={busy}
                    onChange={(partId, part) => {
                      setAddPartId(partId);
                      setAddDescription(part?.name ?? "");
                      const partGst =
                        part &&
                        "gstRatePercent" in part &&
                        typeof part.gstRatePercent === "number"
                          ? part.gstRatePercent
                          : null;
                      setAddGstRatePercent(
                        partGst ?? defaultInvoiceGstRatePercent("PART"),
                      );
                      if (part && part.sellingPricePaise > 0) {
                        setAddPriceText(
                          paiseToRupeesInput(part.sellingPricePaise as Paise),
                        );
                      }
                    }}
                    onCreateFromQuery={(name) =>
                      openCreatePart(addRowKey, name)
                    }
                  />
                ) : (
                  <Input
                    id="add-description"
                    maxLength={500}
                    value={addDescription}
                    disabled={busy}
                    onChange={(event) => setAddDescription(event.target.value)}
                    placeholder={to("lineDescriptionPlaceholder")}
                    className={controlClass}
                  />
                )}
              </FormField>
              {addType === "PART" ? (
                <QuantityStepper
                  key={`add-qty-${addPriceKey}`}
                  id="add-quantity"
                  label={t("quantity")}
                  defaultValue={addQty}
                  min={1}
                  onValueChange={setAddQty}
                />
              ) : null}
              <FormField id="add-unit-price" label={t("unitPrice")}>
                <Input
                  key={`add-price-${addPriceKey}`}
                  id="add-unit-price"
                  type="text"
                  inputMode="decimal"
                  value={addPriceText}
                  placeholder="0"
                  disabled={busy}
                  className={cn(controlClass, "tabular-nums")}
                  onFocus={(event) => {
                    if (isZeroRupeesInput(event.currentTarget.value)) {
                      event.currentTarget.select();
                    }
                  }}
                  onChange={(event) => {
                    setAddPriceText(sanitizeRupeesTyping(event.target.value));
                  }}
                />
              </FormField>
              <Button
                type="button"
                variant="primary"
                size="md"
                className="h-11 min-h-11 gap-1.5 px-4"
                disabled={busy || (addType === "PART" && !addPartId)}
                onClick={addRow}
              >
                <Plus className="size-4" strokeWidth={2.5} aria-hidden />
                {t("addInvoiceLine")}
              </Button>
            </div>
          )}
          {addType === "PART" ? (
            <p className="text-[12px] text-slate-500">
              {tw("invoicePanelHint")}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={busy}
          onClick={() => onEditingChange(false)}
        >
          {t("cancelEditInvoice")}
        </Button>
        <Button
          type="submit"
          form={formId}
          variant="primary"
          className="min-h-11"
          loading={busy}
        >
          {busy ? t("saving") : t("saveInvoice")}
        </Button>
      </div>

      {modalLine?.id ? (
        <InvoiceLineWarrantyModal
          open
          onOpenChange={(open) => {
            if (!open) setModalLineId(null);
          }}
          orderId={orderId}
          invoiceId={invoiceId}
          vehicleId={vehicleId}
          lineId={modalLine.id}
          lineDescription={modalLine.description}
          doc={modalDoc}
          onSaveStart={() => {
            setSavingLineId(modalLine.id!);
            setSavingBaseline(docSignature(modalDoc));
          }}
          onSaveSuccess={() => {
            setModalLineId(null);
            router.refresh();
          }}
          onSaveError={() => {
            setSavingLineId(null);
            setSavingBaseline("");
          }}
        />
      ) : null}

      <CreatePartModal
        trigger={null}
        open={createOpen}
        onOpenChange={(next) => {
          setCreateOpen(next);
          if (!next) {
            setCreateInitialName("");
            setCreateForKey(null);
          }
        }}
        navigateOnSuccess={false}
        shopReceive
        initialName={createInitialName}
        onCreated={handlePartCreated}
      />

      <CreateVendorModal
        trigger={null}
        open={createVendorOpen}
        onOpenChange={(next) => {
          setCreateVendorOpen(next);
          if (!next) {
            setCreateVendorName("");
            setCreateVendorForKey(null);
          }
        }}
        initialName={createVendorName}
        navigateOnSuccess={false}
        onCreated={handleVendorCreated}
      />
    </div>
  );
}

function isLikelyImageBill(name: string | null | undefined) {
  if (!name) return false;
  return /\.(jpe?g|png|webp)$/i.test(name);
}

function OutsideBillControl({
  disabled,
  file,
  existingName,
  hasExisting,
  existingOrderId,
  existingLineId,
  onPick,
  onClear,
  onBrowse,
  chooseLabel,
  clearLabel,
}: {
  disabled: boolean;
  file: File | null;
  existingName: string | null;
  hasExisting: boolean;
  existingOrderId?: string | null;
  existingLineId?: string | null;
  onPick: (file: File | null) => void;
  onClear: () => void;
  onBrowse?: () => void;
  chooseLabel: string;
  clearLabel: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [existingPreviewUrl, setExistingPreviewUrl] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setFilePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setFilePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (file || !hasExisting || !existingOrderId || !existingLineId) {
      setExistingPreviewUrl(null);
      return;
    }
    if (!isLikelyImageBill(existingName)) {
      setExistingPreviewUrl(null);
      return;
    }
    let cancelled = false;
    void getOutsideWorkBillDownloadUrlAction(
      existingOrderId,
      existingLineId,
    ).then((result) => {
      if (cancelled || !result.ok) return;
      setExistingPreviewUrl(result.url);
    });
    return () => {
      cancelled = true;
    };
  }, [file, hasExisting, existingOrderId, existingLineId, existingName]);

  function browse() {
    if (onBrowse) {
      onBrowse();
      return;
    }
    inputRef.current?.click();
  }

  const previewUrl = filePreviewUrl ?? existingPreviewUrl ?? null;
  const previewTitle = file?.name ?? existingName ?? chooseLabel;
  const showAttached = Boolean(file) || hasExisting;

  return (
    <div className="flex items-center gap-2">
      {!onBrowse ? (
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          capture="environment"
          className="hidden"
          disabled={disabled}
          onChange={(event) => {
            onPick(event.target.files?.[0] ?? null);
          }}
        />
      ) : null}
      {showAttached ? (
        <div className="relative inline-flex size-11 shrink-0 items-center justify-center">
          {previewUrl ? (
            <div className="size-11 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt={previewTitle}
                className="size-full object-cover"
              />
            </div>
          ) : (
            <div
              className="inline-flex size-11 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700 shadow-xs"
              title={previewTitle}
            >
              <FileText className="size-4" aria-hidden />
            </div>
          )}
          <button
            type="button"
            disabled={disabled}
            aria-label={clearLabel}
            title={clearLabel}
            className="absolute -top-1.5 -right-1.5 z-10 flex size-5 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm hover:bg-slate-800"
            onClick={onClear}
          >
            <X className="size-3" aria-hidden />
          </button>
        </div>
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="icon"
          disabled={disabled}
          aria-label={chooseLabel}
          title={chooseLabel}
          className="size-11 min-h-11 min-w-11 shrink-0 rounded-lg"
          onClick={browse}
        >
          <Upload className="size-4" aria-hidden />
        </Button>
      )}
    </div>
  );
}
