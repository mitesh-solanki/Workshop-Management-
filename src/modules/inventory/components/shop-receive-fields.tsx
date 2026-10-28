"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ImageIcon, Plus, Trash2, Upload, X } from "lucide-react";
import {
  createVendorModalAction,
  getVendorOptionsAction,
} from "@/app/actions/vendors";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
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
import { QuantityStepper } from "@/modules/inventory/components/quantity-stepper";

export type ShopReceiveVendor = { id: string; name: string };

export type ShopReceiveLine = {
  key: string;
  vendorId: string;
  quantity: number;
  file: File | null;
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
  disabled?: boolean;
  lines: ShopReceiveLine[];
  onLinesChange: (lines: ShopReceiveLine[]) => void;
};

function newLine(): ShopReceiveLine {
  return {
    key: `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    vendorId: "",
    quantity: 1,
    file: null,
  };
}

export function ShopReceiveFields({
  idPrefix,
  disabled = false,
  lines,
  onLinesChange,
}: Props) {
  const t = useTranslations("inventory");
  const tv = useTranslations("vendors");
  const te = useTranslations("errors");
  const [vendors, setVendors] = useState<ShopReceiveVendor[]>([]);
  const [vendorQueries, setVendorQueries] = useState<Record<string, string>>(
    {},
  );
  const [addingVendor, setAddingVendor] = useState(false);
  const [vendorDraft, setVendorDraft] = useState<VendorDraft>(EMPTY_VENDOR);
  const [vendorFieldErrors, setVendorFieldErrors] = useState<
    Record<string, string>
  >({});
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [pendingVendor, startVendorTransition] = useTransition();
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(
    () => new Set(lines[0]?.key ? [lines[0].key] : []),
  );
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const previewUrlsRef = useRef<Record<string, string>>({});
  const newVendorPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getVendorOptionsAction().then((rows) => {
      if (!cancelled) setVendors(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      for (const url of Object.values(previewUrlsRef.current)) {
        URL.revokeObjectURL(url);
      }
      previewUrlsRef.current = {};
    };
  }, []);

  useEffect(() => {
    const nextUrls: Record<string, string> = { ...previewUrlsRef.current };
    const keep = new Set(lines.map((line) => line.key));

    for (const key of Object.keys(nextUrls)) {
      if (!keep.has(key)) {
        URL.revokeObjectURL(nextUrls[key]!);
        delete nextUrls[key];
      }
    }

    for (const line of lines) {
      const existing = nextUrls[line.key];
      if (!line.file || !line.file.type.startsWith("image/")) {
        if (existing) {
          URL.revokeObjectURL(existing);
          delete nextUrls[line.key];
        }
        continue;
      }
      if (existing) continue;
      nextUrls[line.key] = URL.createObjectURL(line.file);
    }

    previewUrlsRef.current = nextUrls;
    setPreviewUrls({ ...nextUrls });
  }, [lines]);

  useEffect(() => {
    const keep = new Set(lines.map((line) => line.key));
    setExpandedKeys((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const key of prev) {
        if (keep.has(key)) next.add(key);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [lines]);

  useEffect(() => {
    if (!addingVendor) return;
    const scrollIn = () => {
      newVendorPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
        inline: "nearest",
      });
    };
    const early = window.setTimeout(scrollIn, 40);
    const afterOpen = window.setTimeout(scrollIn, 320);
    const focusName = window.setTimeout(() => {
      document.getElementById(`${idPrefix}-new-vendor-name`)?.focus();
    }, 340);
    return () => {
      window.clearTimeout(early);
      window.clearTimeout(afterOpen);
      window.clearTimeout(focusName);
    };
  }, [addingVendor, idPrefix]);

  const busy = disabled || pendingVendor;

  function updateLine(key: string, patch: Partial<ShopReceiveLine>) {
    onLinesChange(
      lines.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function addLine() {
    const line = newLine();
    onLinesChange([...lines, line]);
    setExpandedKeys((prev) => new Set(prev).add(line.key));
    setAddingVendor(false);
  }

  function toggleExpanded(key: string) {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function removeLine(key: string) {
    if (lines.length <= 1) {
      const reset = newLine();
      onLinesChange([reset]);
      setExpandedKeys(new Set());
      return;
    }
    const next = lines.filter((line) => line.key !== key);
    onLinesChange(next);
    setExpandedKeys((prev) => {
      if (!prev.has(key)) return prev;
      const nextKeys = new Set(prev);
      nextKeys.delete(key);
      return nextKeys;
    });
  }

  function optionsForLine(line: ShopReceiveLine) {
    const q = (vendorQueries[line.key] ?? "").trim().toLowerCase();
    const matched = q
      ? vendors.filter((vendor) => vendor.name.toLowerCase().includes(q))
      : vendors;
    const selected = vendors.find((vendor) => vendor.id === line.vendorId);
    const rows =
      selected && !matched.some((vendor) => vendor.id === selected.id)
        ? [selected, ...matched]
        : matched;
    return rows.map((vendor) => ({
      value: vendor.id,
      label: vendor.name,
      keywords: vendor.name,
    }));
  }

  function vendorName(line: ShopReceiveLine) {
    return vendors.find((vendor) => vendor.id === line.vendorId)?.name ?? "";
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
      };
      setVendors((prev) =>
        prev.some((row) => row.id === created.id)
          ? prev
          : [created, ...prev.filter((row) => row.id !== created.id)],
      );
      const targetKey =
        [...expandedKeys].find((key) => lines.some((line) => line.key === key)) ??
        lines[lines.length - 1]?.key;
      if (targetKey) {
        updateLine(targetKey, { vendorId: created.id });
        setExpandedKeys((prev) => new Set(prev).add(targetKey));
      }
      setAddingVendor(false);
      setVendorDraft(EMPTY_VENDOR);
      setVendorFieldErrors({});
      toast.success(result.message);
    });
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name="shopLineCount" value={lines.length} />

      <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
            {t("boughtFrom")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("boughtFromMultiHint")}
          </p>
        </div>
        <button
          type="button"
          className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-1.5 rounded-xl border border-dashed border-blue-300 bg-blue-50/60 px-3 text-sm font-medium text-blue-700 hover:bg-blue-50 sm:w-auto"
          disabled={busy}
          onClick={addLine}
        >
          <Plus className="size-4" strokeWidth={2.5} aria-hidden />
          {t("addAnotherPurchaseLine")}
        </button>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        {lines.map((line, index) => {
          const expanded = expandedKeys.has(line.key);
          const name = vendorName(line);
          const hasVendor = Boolean(name);

          return (
            <div
              key={line.key}
              className={cn(
                "overflow-hidden rounded-xl border bg-card shadow-xs transition-[border-color,box-shadow] duration-300 ease-out",
                expanded
                  ? "border-blue-200 ring-1 ring-blue-100"
                  : "border-border hover:border-slate-300",
              )}
            >
              <div className="flex items-stretch">
                <button
                  type="button"
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left"
                  disabled={busy}
                  aria-expanded={expanded}
                  aria-label={expanded ? t("collapseShop") : t("expandShop")}
                  onClick={() => toggleExpanded(line.key)}
                >
                  <span
                    className={cn(
                      "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors duration-300",
                      expanded
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-700",
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {hasVendor ? name : t("shopLineLabel", { number: index + 1 })}
                    </span>
                    {hasVendor ? (
                      <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          {t("shopCollapsedQty", { count: line.quantity })}
                        </span>
                        {line.file ? (
                          <span className="inline-flex items-center gap-1 text-blue-700">
                            <ImageIcon className="size-3" aria-hidden />
                            {t("shopBillAttached")}
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-slate-500 transition-transform duration-300 ease-out",
                      expanded && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>
                {lines.length > 1 ? (
                  <button
                    type="button"
                    className="inline-flex w-11 shrink-0 items-stretch self-stretch justify-center border-l border-border text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                    aria-label={t("removeShopLine")}
                    disabled={busy}
                    onClick={() => removeLine(line.key)}
                  >
                    <span className="inline-flex flex-1 items-center justify-center">
                      <Trash2 className="size-4" aria-hidden />
                    </span>
                  </button>
                ) : null}
              </div>

              <div
                className={cn(
                  "grid transition-[grid-template-rows] duration-300 ease-out",
                  expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
              >
                <div className="min-h-0 overflow-hidden">
                  <div className="space-y-3 border-t border-border bg-slate-50/60 px-3 py-3">
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
                      <FormField
                        id={`${idPrefix}-vendor-${line.key}`}
                        label={t("vendor")}
                      >
                        <SearchableSelect
                          id={`${idPrefix}-vendor-${line.key}`}
                          name={`shopVendorId_${index}`}
                          value={line.vendorId}
                          onChange={(next) => {
                            setExpandedKeys((prev) => new Set(prev).add(line.key));
                            updateLine(line.key, { vendorId: next });
                          }}
                          clearable
                          filter="remote"
                          minQueryLength={0}
                          onQueryChange={(q) =>
                            setVendorQueries((prev) => ({
                              ...prev,
                              [line.key]: q,
                            }))
                          }
                          onOpenChange={(next) => {
                            if (next) {
                              setExpandedKeys((prev) =>
                                new Set(prev).add(line.key),
                              );
                              setVendorQueries((prev) => ({
                                ...prev,
                                [line.key]: "",
                              }));
                            }
                          }}
                          placeholder={t("boughtFromPlaceholder")}
                          searchPlaceholder={t("boughtFromPlaceholder")}
                          emptyLabel={t("noVendorsHint")}
                          disabled={busy}
                          options={optionsForLine(line)}
                        />
                      </FormField>

                      <QuantityStepper
                        id={`${idPrefix}-qty-${line.key}`}
                        name={`shopQty_${index}`}
                        label={t("qtyFromShop")}
                        defaultValue={line.quantity}
                        min={1}
                        onValueChange={(quantity) =>
                          updateLine(line.key, { quantity })
                        }
                      />
                    </div>

                    <FormField
                      id={`${idPrefix}-bill-${line.key}`}
                      label={t("shopBillPhoto")}
                      hint={t("shopBillPhotoHint")}
                    >
                      <input
                        ref={(el) => {
                          fileInputRefs.current[line.key] = el;
                        }}
                        id={`${idPrefix}-bill-${line.key}`}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        capture="environment"
                        className="hidden"
                        disabled={busy}
                        onChange={(event) => {
                          updateLine(line.key, {
                            file: event.target.files?.[0] ?? null,
                          });
                        }}
                      />
                      <div className="flex flex-col items-start gap-2">
                        {line.file ? (
                          <div className="relative size-16 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white sm:size-20">
                            {previewUrls[line.key] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={previewUrls[line.key]}
                                alt={line.file.name}
                                className="size-full object-cover"
                              />
                            ) : (
                              <div className="flex size-full items-center justify-center px-1 text-center text-[10px] leading-tight text-slate-600">
                                {line.file.name}
                              </div>
                            )}
                            <button
                              type="button"
                              disabled={busy}
                              aria-label={t("shopBillClear")}
                              className="absolute top-0.5 right-0.5 flex size-5 items-center justify-center rounded-full bg-slate-900/80 text-white"
                              onClick={() => {
                                updateLine(line.key, { file: null });
                                const input = fileInputRefs.current[line.key];
                                if (input) input.value = "";
                              }}
                            >
                              <X className="size-3" aria-hidden />
                            </button>
                          </div>
                        ) : null}
                        <Button
                          type="button"
                          variant="secondary"
                          size="md"
                          disabled={busy}
                          className="h-11 min-h-11 shrink-0"
                          onClick={() =>
                            fileInputRefs.current[line.key]?.click()
                          }
                        >
                          <Upload className="size-4" aria-hidden />
                          {line.file ? t("shopBillChange") : t("shopBillChoose")}
                        </Button>
                      </div>
                    </FormField>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex w-full justify-center">
        <p className="text-center text-sm text-slate-600">
          <span className="mr-1">{t("vendorMissingFromList")}</span>
          <button
            type="button"
            className="inline-flex items-center gap-1 font-medium text-blue-700 hover:text-blue-800 hover:underline"
            onClick={() => {
              setAddingVendor((prev) => {
                const next = !prev;
                if (!next) {
                  setVendorDraft(EMPTY_VENDOR);
                  setVendorFieldErrors({});
                }
                return next;
              });
            }}
            disabled={busy}
          >
            <Plus className="size-3.5" strokeWidth={2.5} aria-hidden />
            {t("createNewVendor")}
          </button>
        </p>
      </div>

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
                  disabled={busy}
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
                    setVendorField("phone", sanitizePhoneTyping(e.target.value))
                  }
                  className="h-11 min-h-11"
                  disabled={busy}
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
                    setVendorField("email", sanitizeEmailTyping(e.target.value))
                  }
                  className="h-11 min-h-11"
                  disabled={busy}
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
                  disabled={busy}
                  placeholder={tv("gstinPlaceholder")}
                  maxLength={15}
                  autoCapitalize="characters"
                  spellCheck={false}
                  aria-invalid={Boolean(vendorFieldErrors.gstin)}
                />
              </FormField>
            </div>
            <FormField id={`${idPrefix}-new-vendor-address`} label={tv("address")}>
              <Textarea
                id={`${idPrefix}-new-vendor-address`}
                rows={2}
                value={vendorDraft.address}
                onChange={(e) => setVendorField("address", e.target.value)}
                disabled={busy}
                placeholder={tv("addressPlaceholder")}
              />
            </FormField>
            <FormField id={`${idPrefix}-new-vendor-notes`} label={tv("notes")}>
              <Textarea
                id={`${idPrefix}-new-vendor-notes`}
                rows={2}
                value={vendorDraft.notes}
                onChange={(e) => setVendorField("notes", e.target.value)}
                disabled={busy}
                placeholder={tv("notesPlaceholder")}
              />
            </FormField>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="md"
                className="h-11 min-h-11"
                disabled={busy}
                onClick={() => {
                  setAddingVendor(false);
                  setVendorDraft(EMPTY_VENDOR);
                  setVendorFieldErrors({});
                }}
              >
                {tv("cancel")}
              </Button>
              <Button
                type="button"
                size="md"
                className="h-11 min-h-11"
                loading={pendingVendor}
                disabled={busy}
                onClick={saveNewVendor}
              >
                {tv("create")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function createEmptyShopReceiveLines(): ShopReceiveLine[] {
  return [newLine()];
}

/** Files in the same order as shop lines that have vendor + qty (for post-save upload). */
export function shopReceiveFilesForUpload(
  lines: ShopReceiveLine[],
): Array<File | null> {
  return lines
    .filter((line) => line.vendorId.trim() && line.quantity > 0)
    .map((line) => line.file);
}
