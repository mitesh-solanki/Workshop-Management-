"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { FileText, Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { createVendorModalAction } from "@/app/actions/vendors";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { FormSelect } from "@/components/ui/form-select";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import {
  isValidEmail,
  isValidPhone,
  sanitizeEmailTyping,
  sanitizePhoneTyping,
} from "@/lib/contact";
import { cn } from "@/lib/utils";
import { sanitizeRupeesTyping } from "@/lib/money";
import { GST_RATE_OPTIONS } from "@/modules/estimates/schema";
import { ExpenseCategoryInput } from "@/modules/expenses/components/expense-category-input";
import {
  EXPENSE_METHODS,
  type ExpenseMethod,
  type ExpenseStatus,
} from "@/modules/expenses/schema";

export type ExpenseGstSplit = "CGST_SGST" | "IGST";

export type ExpenseVendorOption = {
  id: string;
  name: string;
  gstin?: string | null;
};

export type ExpenseFormValues = {
  amountRupees: string;
  spentAt: string;
  status: ExpenseStatus;
  method: ExpenseMethod | "";
  category: string;
  note: string;
  vendorId: string;
  gstSplit: ExpenseGstSplit;
  gstRatePercent: number;
  billFile: File | null;
};

type VendorDraft = {
  name: string;
  phone: string;
  email: string;
  address: string;
  gstin: string;
  notes: string;
};

const EMPTY_VENDOR: VendorDraft = {
  name: "",
  phone: "",
  email: "",
  address: "",
  gstin: "",
  notes: "",
};

type Props = {
  idPrefix: string;
  values: ExpenseFormValues;
  fieldErrors: Record<string, string>;
  usedCategories?: readonly string[];
  vendors?: readonly ExpenseVendorOption[];
  onChange: <K extends keyof ExpenseFormValues>(
    key: K,
    value: ExpenseFormValues[K],
  ) => void;
};

const controlClass =
  "h-11 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] shadow-xs outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/25";

export function ExpenseFormFields({
  idPrefix,
  values,
  fieldErrors,
  usedCategories = [],
  vendors: vendorsProp = [],
  onChange,
}: Props) {
  const t = useTranslations("expenses");
  const tb = useTranslations("billing");
  const ti = useTranslations("inventory");
  const tv = useTranslations("vendors");
  const te = useTranslations("errors");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const newVendorPanelRef = useRef<HTMLDivElement | null>(null);
  const [billPreviewUrl, setBillPreviewUrl] = useState<string | null>(null);
  const [vendors, setVendors] = useState<ExpenseVendorOption[]>(() => [
    ...vendorsProp,
  ]);
  const [vendorQuery, setVendorQuery] = useState("");
  const [addingVendor, setAddingVendor] = useState(false);
  const [vendorDraft, setVendorDraft] = useState<VendorDraft>(EMPTY_VENDOR);
  const [vendorFieldErrors, setVendorFieldErrors] = useState<
    Record<string, string>
  >({});
  const [pendingVendor, startVendorTransition] = useTransition();
  const needsBill = values.gstRatePercent > 0;

  useEffect(() => {
    setVendors((prev) => {
      const byId = new Map(prev.map((vendor) => [vendor.id, vendor]));
      for (const vendor of vendorsProp) {
        byId.set(vendor.id, vendor);
      }
      return Array.from(byId.values());
    });
  }, [vendorsProp]);

  useEffect(() => {
    if (!addingVendor || !newVendorPanelRef.current) return;
    window.setTimeout(() => {
      newVendorPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
      document.getElementById(`${idPrefix}-new-vendor-name`)?.focus();
    }, 50);
  }, [addingVendor, idPrefix]);

  const vendorSelectOptions = useMemo(() => {
    const q = vendorQuery.trim().toLowerCase();
    const matched = q
      ? vendors.filter((vendor) => vendor.name.toLowerCase().includes(q))
      : vendors;
    const selected = vendors.find((vendor) => vendor.id === values.vendorId);
    const rows =
      selected && !matched.some((vendor) => vendor.id === selected.id)
        ? [selected, ...matched]
        : matched;
    return rows.map((vendor) => ({
      value: vendor.id,
      label: vendor.name,
      keywords: vendor.name,
    }));
  }, [vendorQuery, vendors, values.vendorId]);

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

  useEffect(() => {
    if (!values.billFile || !values.billFile.type.startsWith("image/")) {
      setBillPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(values.billFile);
    setBillPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [values.billFile]);

  function clearBill() {
    onChange("billFile", null);
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

  function openCreateVendor(name = "") {
    setVendorDraft({ ...EMPTY_VENDOR, name: name.trim() });
    setVendorFieldErrors({});
    setAddingVendor(true);
  }

  function closeNewVendorForm() {
    setAddingVendor(false);
    setVendorDraft(EMPTY_VENDOR);
    setVendorFieldErrors({});
  }

  function setVendorField<K extends keyof VendorDraft>(
    key: K,
    value: VendorDraft[K],
  ) {
    setVendorDraft((prev) => ({ ...prev, [key]: value }));
    setVendorFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function validateVendorDraft(): boolean {
    const next: Record<string, string> = {};
    if (!vendorDraft.name.trim()) {
      next.name = te("validation.required");
    }
    if (vendorDraft.phone.trim() && !isValidPhone(vendorDraft.phone)) {
      next.phone = te("validation.invalidPhone");
    }
    if (vendorDraft.email.trim() && !isValidEmail(vendorDraft.email)) {
      next.email = te("validation.invalidEmail");
    }
    if (!vendorDraft.phone.trim() && !vendorDraft.email.trim()) {
      next.phone = te("validation.phoneOrEmail");
    }
    if (
      vendorDraft.gstin.trim() &&
      !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(
        vendorDraft.gstin.trim().toUpperCase(),
      )
    ) {
      next.gstin = te("validation.invalidGstin");
    }
    setVendorFieldErrors(next);
    if (Object.keys(next).length === 0) return true;
    const first = Object.keys(next)[0];
    window.setTimeout(() => {
      document.getElementById(`${idPrefix}-new-vendor-${first}`)?.focus();
    }, 50);
    return false;
  }

  function saveNewVendor() {
    if (!validateVendorDraft()) return;

    const formData = new FormData();
    formData.set("name", vendorDraft.name.trim());
    formData.set("phone", vendorDraft.phone.trim());
    formData.set("email", vendorDraft.email.trim());
    formData.set("address", vendorDraft.address.trim());
    formData.set("gstin", vendorDraft.gstin.trim());
    formData.set("notes", vendorDraft.notes.trim());

    startVendorTransition(async () => {
      const result = await createVendorModalAction({ ok: false }, formData);
      if (!result.ok || !result.vendorId) {
        if (result.fieldErrors) {
          setVendorFieldErrors(result.fieldErrors);
        }
        toast.error(result.message ?? tv("error"));
        return;
      }
      const created = {
        id: result.vendorId,
        name: vendorDraft.name.trim(),
        gstin: vendorDraft.gstin.trim() || null,
      };
      setVendors((prev) =>
        prev.some((row) => row.id === created.id)
          ? prev
          : [created, ...prev.filter((row) => row.id !== created.id)],
      );
      onChange("vendorId", created.id);
      closeNewVendorForm();
      toast.success(result.message);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id={`${idPrefix}-amount`}
          label={t("amount")}
          error={fieldErrors.amountRupees}
        >
          <Input
            id={`${idPrefix}-amount`}
            name="amountRupees"
            inputMode="decimal"
            value={values.amountRupees}
            onChange={(e) =>
              onChange("amountRupees", sanitizeRupeesTyping(e.target.value))
            }
            placeholder={t("amountPlaceholder")}
            aria-invalid={Boolean(fieldErrors.amountRupees)}
            className={controlClass}
            autoFocus
          />
        </FormField>
        <FormField
          id={`${idPrefix}-spentAt`}
          label={t("date")}
          error={fieldErrors.spentAt}
        >
          <Input
            id={`${idPrefix}-spentAt`}
            name="spentAt"
            type="date"
            value={values.spentAt}
            onChange={(e) => onChange("spentAt", e.target.value)}
            aria-invalid={Boolean(fieldErrors.spentAt)}
            className={controlClass}
          />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id={`${idPrefix}-category`}
          label={t("category")}
          error={fieldErrors.category}
        >
          <ExpenseCategoryInput
            id={`${idPrefix}-category`}
            value={values.category}
            onValueChange={(value) => onChange("category", value)}
            usedCategories={usedCategories}
            placeholder={t("categoryPlaceholder")}
            aria-invalid={Boolean(fieldErrors.category)}
          />
        </FormField>
        <FormField
          id={`${idPrefix}-status`}
          label={t("status")}
          error={fieldErrors.status}
        >
          <input type="hidden" name="status" value={values.status} />
          <div
            role="group"
            aria-label={t("status")}
            className="grid grid-cols-2 gap-1.5 rounded-lg border border-border bg-muted/40 p-1"
          >
            {(["PAID", "UNPAID"] as const).map((status) => {
              const active = values.status === status;
              return (
                <button
                  key={status}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    onChange("status", status);
                    if (status === "UNPAID") {
                      onChange("method", "");
                    } else if (!values.method) {
                      onChange("method", "CASH");
                    }
                  }}
                  className={cn(
                    "inline-flex min-h-10 items-center justify-center rounded-md px-3 text-sm font-semibold transition-colors",
                    active
                      ? status === "PAID"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-amber-500 text-white shadow-sm"
                      : "text-muted-foreground hover:bg-background hover:text-foreground",
                  )}
                >
                  {t(`statuses.${status}`)}
                </button>
              );
            })}
          </div>
        </FormField>
      </div>

      <div className="space-y-3">
        <FormField
          id={`${idPrefix}-vendor`}
          label={t("vendor")}
          error={fieldErrors.vendorId}
        >
          <input type="hidden" name="vendorId" value={values.vendorId} />
          <SearchableSelect
            id={`${idPrefix}-vendor`}
            value={values.vendorId}
            onChange={(value) => onChange("vendorId", value)}
            clearable
            filter="remote"
            minQueryLength={0}
            onQueryChange={setVendorQuery}
            placeholder={t("vendorPlaceholder")}
            searchPlaceholder={t("vendorPlaceholder")}
            emptyLabel={ti("emptyVendorSearchQuickCreate")}
            options={vendorSelectOptions}
            createFromQueryLabel={(query) =>
              ti("quickAddVendor", { name: query })
            }
            onCreateFromQuery={(query) => openCreateVendor(query)}
          />
        </FormField>

        <div
          ref={newVendorPanelRef}
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-out",
            addingVendor ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="space-y-3 rounded-xl border border-border bg-card p-3 shadow-xs">
              <p className="text-caption text-muted-foreground">
                {tv("contactRequiredHint")}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  id={`${idPrefix}-new-vendor-name`}
                  label={tv("nameRequired")}
                  error={vendorFieldErrors.name}
                >
                  <Input
                    id={`${idPrefix}-new-vendor-name`}
                    value={vendorDraft.name}
                    onChange={(e) => setVendorField("name", e.target.value)}
                    className="h-11 min-h-11"
                    disabled={pendingVendor}
                    placeholder={tv("namePlaceholder")}
                    aria-invalid={Boolean(vendorFieldErrors.name)}
                  />
                </FormField>
                <FormField
                  id={`${idPrefix}-new-vendor-phone`}
                  label={tv("phone")}
                  error={vendorFieldErrors.phone}
                >
                  <Input
                    id={`${idPrefix}-new-vendor-phone`}
                    type="tel"
                    inputMode="tel"
                    value={vendorDraft.phone}
                    onChange={(e) =>
                      setVendorField(
                        "phone",
                        sanitizePhoneTyping(e.target.value),
                      )
                    }
                    className="h-11 min-h-11"
                    disabled={pendingVendor}
                    placeholder={tv("phonePlaceholder")}
                    aria-invalid={Boolean(vendorFieldErrors.phone)}
                  />
                </FormField>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  id={`${idPrefix}-new-vendor-email`}
                  label={tv("email")}
                  error={vendorFieldErrors.email}
                >
                  <Input
                    id={`${idPrefix}-new-vendor-email`}
                    type="email"
                    value={vendorDraft.email}
                    onChange={(e) =>
                      setVendorField(
                        "email",
                        sanitizeEmailTyping(e.target.value),
                      )
                    }
                    className="h-11 min-h-11"
                    disabled={pendingVendor}
                    placeholder={tv("emailPlaceholder")}
                    aria-invalid={Boolean(vendorFieldErrors.email)}
                  />
                </FormField>
                <FormField
                  id={`${idPrefix}-new-vendor-gstin`}
                  label={tv("gstin")}
                  error={vendorFieldErrors.gstin}
                >
                  <Input
                    id={`${idPrefix}-new-vendor-gstin`}
                    value={vendorDraft.gstin}
                    onChange={(e) =>
                      setVendorField(
                        "gstin",
                        e.target.value
                          .toUpperCase()
                          .replace(/[^0-9A-Z]/g, "")
                          .slice(0, 15),
                      )
                    }
                    className="h-11 min-h-11 uppercase"
                    disabled={pendingVendor}
                    placeholder={tv("gstinPlaceholder")}
                    maxLength={15}
                    autoCapitalize="characters"
                    spellCheck={false}
                    aria-invalid={Boolean(vendorFieldErrors.gstin)}
                  />
                </FormField>
              </div>
              <FormField
                id={`${idPrefix}-new-vendor-address`}
                label={tv("address")}
              >
                <Textarea
                  id={`${idPrefix}-new-vendor-address`}
                  rows={2}
                  value={vendorDraft.address}
                  onChange={(e) => setVendorField("address", e.target.value)}
                  disabled={pendingVendor}
                  placeholder={tv("addressPlaceholder")}
                />
              </FormField>
              <FormField
                id={`${idPrefix}-new-vendor-notes`}
                label={tv("notes")}
              >
                <Textarea
                  id={`${idPrefix}-new-vendor-notes`}
                  rows={2}
                  value={vendorDraft.notes}
                  onChange={(e) => setVendorField("notes", e.target.value)}
                  disabled={pendingVendor}
                  placeholder={tv("notesPlaceholder")}
                />
              </FormField>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  className="h-11 min-h-11"
                  disabled={pendingVendor}
                  onClick={closeNewVendorForm}
                >
                  {tv("cancel")}
                </Button>
                <Button
                  type="button"
                  size="md"
                  className="h-11 min-h-11"
                  loading={pendingVendor}
                  disabled={pendingVendor}
                  onClick={saveNewVendor}
                >
                  {tv("create")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {values.status === "PAID" ? (
          <FormField
            id={`${idPrefix}-method`}
            label={t("method")}
            error={fieldErrors.method}
          >
            <FormSelect
              id={`${idPrefix}-method`}
              name="method"
              value={values.method}
              onValueChange={(value) =>
                onChange("method", value as ExpenseMethod | "")
              }
              placeholder={t("methodPlaceholder")}
              options={EXPENSE_METHODS.map((method) => ({
                value: method,
                label: t(`methods.${method}`),
              }))}
              triggerClassName={controlClass}
            />
          </FormField>
        ) : (
          <input type="hidden" name="method" value="" />
        )}
        <FormField
          id={`${idPrefix}-gstSplit`}
          label={t("gstSplit")}
          error={fieldErrors.gstSplit}
          className={values.status === "PAID" ? undefined : "sm:col-span-2"}
        >
          <FormSelect
            id={`${idPrefix}-gstSplit`}
            name="gstSplit"
            value={values.gstSplit}
            options={gstSplitOptions}
            triggerClassName={controlClass}
            onValueChange={(value) =>
              onChange("gstSplit", value as ExpenseGstSplit)
            }
          />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id={`${idPrefix}-gstRatePercent`}
          label={t("gstRate")}
          error={fieldErrors.gstRatePercent}
        >
          <FormSelect
            id={`${idPrefix}-gstRatePercent`}
            name="gstRatePercent"
            value={String(values.gstRatePercent)}
            options={gstRateOptions}
            triggerClassName={controlClass}
            onValueChange={(value) => {
              const next = Number(value);
              onChange("gstRatePercent", next);
              if (next === 0) clearBill();
            }}
          />
        </FormField>
        <FormField
          id={`${idPrefix}-bill`}
          label={t("bill")}
          error={fieldErrors.billFile}
        >
          <input
            ref={fileInputRef}
            id={`${idPrefix}-bill`}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            capture="environment"
            className="hidden"
            disabled={!needsBill}
            onChange={(event) => {
              onChange("billFile", event.target.files?.[0] ?? null);
            }}
          />
          {values.billFile && needsBill ? (
            <div className="relative inline-flex max-w-full">
              <div
                className="inline-flex h-11 max-w-full items-stretch overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs"
                title={values.billFile.name}
              >
                {billFileKind(values.billFile) === "image" && billPreviewUrl ? (
                  <div className="size-11 shrink-0 border-r border-slate-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={billPreviewUrl}
                      alt={values.billFile.name}
                      className="size-full object-cover"
                    />
                  </div>
                ) : (
                  <span className="inline-flex size-11 shrink-0 items-center justify-center border-r border-slate-200 bg-blue-50 text-blue-700">
                    <FileText className="size-4" aria-hidden />
                  </span>
                )}
                <span className="min-w-0 max-w-[9rem] self-center px-2.5 py-1">
                  <span className="block truncate text-xs font-semibold text-slate-800">
                    {billFileKind(values.billFile) === "pdf"
                      ? ti("shopBillPdf")
                      : billFileKind(values.billFile) === "image"
                        ? ti("shopBillAttached")
                        : ti("shopBillFile")}
                  </span>
                  <span className="block truncate text-[10px] text-slate-500">
                    {values.billFile.name}
                  </span>
                </span>
              </div>
              <button
                type="button"
                aria-label={ti("shopBillClear")}
                title={ti("shopBillClear")}
                className="absolute -top-1.5 -right-1.5 z-10 flex size-5 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm hover:bg-slate-800"
                onClick={clearBill}
              >
                <X className="size-3" aria-hidden />
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={!needsBill}
              aria-label={ti("shopBillChoose")}
              title={ti("shopBillChoose")}
              className={cn(
                "inline-flex h-11 max-w-full items-stretch overflow-hidden rounded-lg border border-slate-300 bg-white text-left shadow-xs transition-colors",
                needsBill
                  ? "hover:border-blue-600 hover:bg-blue-50/40"
                  : "cursor-not-allowed opacity-50",
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <span className="inline-flex size-11 shrink-0 items-center justify-center border-r border-slate-200 bg-slate-50 text-slate-600">
                <Upload className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 max-w-[9rem] self-center px-2.5 py-1">
                <span className="block truncate text-xs font-semibold text-slate-800">
                  {ti("shopBillChoose")}
                </span>
                <span className="block truncate text-[10px] text-slate-500">
                  {t("billChooseHint")}
                </span>
              </span>
            </button>
          )}
        </FormField>
      </div>

      <FormField id={`${idPrefix}-note`} label={t("note")}>
        <Textarea
          id={`${idPrefix}-note`}
          name="note"
          rows={2}
          value={values.note}
          onChange={(e) => onChange("note", e.target.value)}
          placeholder={t("notePlaceholder")}
          className="min-h-18 rounded-lg border-slate-300 shadow-xs"
        />
      </FormField>
    </div>
  );
}

export function todayDateInput(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
