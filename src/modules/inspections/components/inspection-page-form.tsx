"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  createInspectionItemAction,
  saveInspectionAction,
  startInspectionAction,
  type InspectionActionState,
} from "@/app/actions/inspections";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormActionBar } from "@/components/ui/form-action-bar";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { parseRupeesToPaise } from "@/lib/money";
import { cn } from "@/lib/utils";
import { PartNameSuggestInput } from "@/modules/inventory/components/part-name-suggest-input";
import {
  createDraftItem,
  draftItemFromServer,
  InspectionItemFields,
  linesPayloadForSave,
  type InspectionDraftItem,
} from "@/modules/inspections/components/inspection-item-fields";
import { InspectionEstimatePanel } from "@/modules/inspections/components/inspection-estimate-panel";
import { InspectionReportPanel } from "@/modules/inspections/components/inspection-report-panel";
import { InspectionSectionNav } from "@/modules/inspections/components/inspection-section-nav";
import {
  clampInspectionSection,
  type InspectionSection,
} from "@/modules/inspections/inspection-sections";
import { collectInspectionEstimateSources } from "@/modules/inspections/estimate-sources";
import type { InspectionItemResultValue } from "@/modules/inspections/schema";
import { filterInspectionMainPartNames } from "@/modules/inspections/sub-spare-suggestions";
import { datetimeLocalFromOrder } from "@/modules/service-orders/components/service-order-form";

export type InspectionVehicleOption = {
  id: string;
  registrationNumber: string;
  make: string;
  model: string;
  customerId: string;
  customerName: string;
};

type ServerItem = {
  id: string;
  key: string;
  label: string;
  result: InspectionItemResultValue | null;
  notes: string | null;
  quantity: number;
  unitPricePaise: number;
  externalCheck: boolean;
  media: InspectionDraftItem["media"];
};

type CreateProps = {
  mode: "create";
  vehicles: InspectionVehicleOption[];
  initialVehicleId?: string;
  initialCustomerId?: string;
  initialSection?: string | null;
};

type EditProps = {
  mode: "edit";
  canEdit: boolean;
  initialSection?: string | null;
  inspection: {
    id: string;
    complaint: string | null;
    recommendedNotes: string | null;
    expectedCompletion: Date | string | null;
    customerId: string;
    vehicleId: string;
    serviceOrderId: string | null;
    customer: { name: string };
    vehicle: {
      registrationNumber: string;
      make: string;
      model: string;
    };
  };
  items: ServerItem[];
  estimate?: {
    current: {
      id: string;
      revisionNumber: number;
      askPermission: boolean;
      permissionVia: "MANUAL" | "LIVE_LINK" | null;
      notes: string | null;
      lines: Array<{
        id: string;
        type: string;
        description: string;
        quantity: number;
        unitPricePaise: number;
        approvalState: "PENDING" | "APPROVED" | "REJECTED";
      }>;
      totals: {
        all: { taxablePaise: number; totalPaise: number };
        approved: { totalPaise: number };
        pending: { totalPaise: number };
      };
    } | null;
    liveLinkActive: { id: string; expiresAt: Date | string } | null;
    canEditLiveLink: boolean;
  };
};

type Props = CreateProps | EditProps;

type InspectionSaveFieldErrors = {
  vehicleId?: string;
  expectedCompletion?: string;
  complaint?: string;
  items?: string;
};

const initialState: InspectionActionState = { ok: false };

function firstInspectionSaveErrorId(
  errors: InspectionSaveFieldErrors,
): string | null {
  if (errors.vehicleId) return "inspection-vehicle";
  if (errors.expectedCompletion) return "inspection-expected-completion";
  if (errors.complaint) return "inspection-complaint";
  if (errors.items) return "inspection-add-spare";
  return null;
}

export function InspectionPageForm(props: Props) {
  const t = useTranslations("inspections");
  const router = useRouter();
  const pathname = usePathname();
  const formId = useId();
  const isCreate = props.mode === "create";
  const canEdit = isCreate || props.canEdit;
  const [liveInspectionId, setLiveInspectionId] = useState<string | null>(
    isCreate ? null : props.inspection.id,
  );
  const inspectionId = liveInspectionId;

  const boundSave = useMemo(
    () => saveInspectionAction.bind(null, inspectionId),
    [inspectionId],
  );
  const [state, formAction, pending] = useActionState(boundSave, initialState);
  const handled = useRef<string | null>(null);

  const [activeSection, setActiveSection] = useState<InspectionSection>(() =>
    clampInspectionSection(props.initialSection),
  );

  const filteredVehicles = useMemo(() => {
    if (!isCreate) return [];
    if (!props.initialCustomerId) return props.vehicles;
    return props.vehicles.filter(
      (vehicle) => vehicle.customerId === props.initialCustomerId,
    );
  }, [isCreate, props]);

  const defaultVehicle = useMemo(() => {
    if (!isCreate) return props.inspection.vehicleId;
    const preferred = props.initialVehicleId ?? "";
    if (preferred && filteredVehicles.some((v) => v.id === preferred)) {
      return preferred;
    }
    return "";
  }, [filteredVehicles, isCreate, props]);

  const [vehicleId, setVehicleId] = useState(defaultVehicle);
  const selectedVehicle = useMemo(() => {
    if (!isCreate) {
      return {
        id: props.inspection.vehicleId,
        customerId: props.inspection.customerId,
        customerName: props.inspection.customer.name,
        registrationNumber: props.inspection.vehicle.registrationNumber,
        make: props.inspection.vehicle.make,
        model: props.inspection.vehicle.model,
      };
    }
    return filteredVehicles.find((item) => item.id === vehicleId) ?? null;
  }, [filteredVehicles, isCreate, props, vehicleId]);

  const [complaint, setComplaint] = useState(
    isCreate ? "" : (props.inspection.complaint ?? ""),
  );
  const [recommendedNotes, setRecommendedNotes] = useState(
    isCreate ? "" : (props.inspection.recommendedNotes ?? ""),
  );
  const [expectedCompletion, setExpectedCompletion] = useState(() =>
    isCreate
      ? ""
      : datetimeLocalFromOrder(props.inspection.expectedCompletion),
  );
  const [items, setItems] = useState<InspectionDraftItem[]>(() =>
    isCreate ? [] : props.items.map(draftItemFromServer),
  );
  const [addLabel, setAddLabel] = useState("");
  const [addingItem, setAddingItem] = useState(false);
  const [highlightedClientId, setHighlightedClientId] = useState<string | null>(
    null,
  );
  const [vehicleQuery, setVehicleQuery] = useState("");
  const [fieldErrors, setFieldErrors] = useState<InspectionSaveFieldErrors>(
    {},
  );

  const allVehicleOptions = useMemo(
    () =>
      filteredVehicles.map((vehicle) => ({
        value: vehicle.id,
        label: `${vehicle.registrationNumber} — ${vehicle.make} ${vehicle.model}`,
        keywords: `${vehicle.registrationNumber} ${vehicle.make} ${vehicle.model} ${vehicle.customerName}`,
      })),
    [filteredVehicles],
  );

  const vehicleOptions = useMemo(() => {
    const q = vehicleQuery.trim().toLowerCase();
    if (!q) return allVehicleOptions;
    return allVehicleOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q) ||
        Boolean(opt.keywords?.toLowerCase().includes(q)),
    );
  }, [allVehicleOptions, vehicleQuery]);

  const itemsJson = useMemo(
    () =>
      JSON.stringify(
        items.map((item) => ({
          id: item.serverId ?? null,
          label: item.label,
          result: item.result ?? "",
          externalCheck: item.externalCheck ?? false,
          lines: linesPayloadForSave(item.noteLines),
        })),
      ),
    [items],
  );

  useEffect(() => {
    if (!state.message || state.message === handled.current) return;
    handled.current = state.message;
    if (state.ok && state.inspectionId) {
      toast.success(
        state.message === "created"
          ? t("created")
          : state.message === "updated"
            ? t("updated")
            : state.message,
      );
      if (isCreate) {
        router.push(`/inspections/${state.inspectionId}`);
      } else {
        router.refresh();
      }
      return;
    }
    toast.error(state.message);
  }, [state, router, t, isCreate]);

  const onSectionChange = useCallback(
    (section: InspectionSection) => {
      setActiveSection(section);
      const url =
        section === "info" ? pathname : `${pathname}?section=${section}`;
      router.replace(url, { scroll: false });
    },
    [pathname, router],
  );

  function validateBeforeSave(): InspectionSaveFieldErrors {
    const next: InspectionSaveFieldErrors = {};
    if (isCreate && !selectedVehicle) {
      next.vehicleId = t("errors.required");
    }
    if (!expectedCompletion.trim()) {
      next.expectedCompletion = t("errors.expectedCompletionRequired");
    }
    if (!complaint.trim()) {
      next.complaint = t("errors.complaintRequired");
    }
    if (items.length < 1) {
      next.items = t("errors.itemsRequired");
    }
    return next;
  }

  function focusFirstSaveError(errors: InspectionSaveFieldErrors) {
    const focusId = firstInspectionSaveErrorId(errors);
    if (!focusId) return;
    window.requestAnimationFrame(() => {
      const el = document.getElementById(focusId);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      if (typeof el.focus === "function") {
        el.focus();
      }
    });
  }

  // Browser back-forward cache can restore a filled create form. Clear it.
  useEffect(() => {
    if (!isCreate || pathname !== "/inspections/new") return;

    function onPageShow(event: PageTransitionEvent) {
      if (!event.persisted) return;
      setLiveInspectionId(null);
      setVehicleId(defaultVehicle);
      setComplaint("");
      setRecommendedNotes("");
      setExpectedCompletion("");
      setItems([]);
      setAddLabel("");
      setVehicleQuery("");
      setHighlightedClientId(null);
      setActiveSection(clampInspectionSection(props.initialSection));
    }

    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [defaultVehicle, isCreate, pathname, props.initialSection]);

  function revealAddedItem(clientId: string) {
    setHighlightedClientId(clientId);
    window.setTimeout(() => {
      setHighlightedClientId((current) =>
        current === clientId ? null : current,
      );
    }, 2200);
  }

  async function addItem() {
    const label = addLabel.trim();
    if (!label || addingItem) return;
    const alreadyAdded = items.some(
      (item) => item.label.trim().toLowerCase() === label.toLowerCase(),
    );
    if (alreadyAdded) {
      toast.error(t("itemAlreadyAdded", { label }));
      return;
    }

    if (isCreate && !selectedVehicle) {
      toast.error(t("selectVehicleFirst"));
      return;
    }

    // Persist item on the server so Proof can upload without waiting for Save.
    setAddingItem(true);
    try {
      let id = inspectionId;
      let justStarted = false;
      if (!id && selectedVehicle) {
        const started = await startInspectionAction({
          customerId: selectedVehicle.customerId,
          vehicleId: selectedVehicle.id,
          complaint,
          recommendedNotes,
          expectedCompletion,
        });
        if (!started.ok || !started.inspectionId) {
          toast.error(started.message ?? t("errors.createFailed"));
          return;
        }
        id = started.inspectionId;
        justStarted = true;
        setLiveInspectionId(id);
      }
      if (!id) {
        toast.error(t("selectVehicleFirst"));
        return;
      }

      const result = await createInspectionItemAction(id, label);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      // Leave /inspections/new via the Next router (not history.replaceState).
      // replaceState desyncs the App Router, so opening New Inspection again
      // reused this form and looked like the last draft came back.
      if (justStarted) {
        router.replace(`/inspections/${id}`);
        return;
      }

      const draft = createDraftItem(result.item.label);
      const next = {
        ...draft,
        serverId: result.item.id,
        key: result.item.key,
      };
      setItems((prev) => [next, ...prev]);
      setAddLabel("");
      setFieldErrors((prev) =>
        prev.items ? { ...prev, items: undefined } : prev,
      );
      revealAddedItem(next.clientId);
    } finally {
      setAddingItem(false);
    }
  }

  const serverItems = !isCreate && props.mode === "edit" ? props.items : null;

  // After Save + refresh, attach server ids to draft-only cards so Proof unlocks.
  useEffect(() => {
    if (!serverItems) return;
    setItems((prev) => {
      const usedIds = new Set(
        prev.map((row) => row.serverId).filter((id): id is string => Boolean(id)),
      );
      let changed = false;
      const next = prev.map((draft) => {
        if (draft.serverId) return draft;
        const match = serverItems.find(
          (server) =>
            !usedIds.has(server.id) &&
            server.label.trim().toLowerCase() ===
              draft.label.trim().toLowerCase(),
        );
        if (!match) return draft;
        usedIds.add(match.id);
        changed = true;
        return {
          ...draft,
          serverId: match.id,
          key: match.key,
          media: match.media.length > 0 ? match.media : draft.media,
        };
      });
      return changed ? next : prev;
    });
  }, [serverItems]);

  const cancelHref = "/inspections";
  const title = isCreate
    ? t("newTitle")
    : props.inspection.vehicle.registrationNumber;
  const vehicleLabel = selectedVehicle
    ? `${selectedVehicle.make} ${selectedVehicle.model}`
    : "";

  const checkedCount = items.filter((item) => item.result).length;
  const progressPercent =
    items.length === 0 ? 0 : Math.round((checkedCount / items.length) * 100);

  // Report tab reads live draft so Save / edits show without a full remount.
  const reportItems = useMemo(
    () =>
      items.map((item) => {
        const lines = item.noteLines
          .map((line) => ({
            note: line.text.trim(),
            quantity: line.quantity,
            unitPricePaise: parseRupeesToPaise(line.unitPriceRupees) ?? 0,
          }))
          .filter(
            (line) =>
              line.note.length > 0 ||
              line.quantity !== 1 ||
              line.unitPricePaise !== 0,
          );
        return {
          id: item.serverId ?? item.clientId,
          label: item.label,
          quantity:
            lines.length > 0
              ? lines.reduce((sum, line) => sum + line.quantity, 0)
              : 1,
          unitPricePaise:
            lines.length > 0
              ? lines.reduce((sum, line) => sum + line.unitPricePaise, 0)
              : 0,
          notes: lines.length > 0 ? JSON.stringify(lines) : null,
          externalCheck: item.externalCheck,
          result: item.result,
          media: item.media,
        };
      }),
    [items],
  );

  const draftEstimateSources = useMemo(
    () => collectInspectionEstimateSources(reportItems),
    [reportItems],
  );
  // Same priced findings the Report tab shows (live draft).
  const pricedLineCount = draftEstimateSources.length;
  const pendingEstimateSources = useMemo(() => {
    if (props.mode !== "edit" || !props.estimate?.current) return [];
    const existing = new Set(
      props.estimate.current.lines.map((line) =>
        line.description.trim().toLowerCase(),
      ),
    );
    return draftEstimateSources.filter(
      (source) => !existing.has(source.description.trim().toLowerCase()),
    );
  }, [props, draftEstimateSources]);
  const estimateDraft = useMemo(
    () => ({
      customerId: selectedVehicle?.customerId ?? "",
      vehicleId: selectedVehicle?.id ?? vehicleId,
      complaint,
      recommendedNotes,
      itemsJson,
    }),
    [
      selectedVehicle,
      vehicleId,
      complaint,
      recommendedNotes,
      itemsJson,
    ],
  );

  return (
    <div className="w-full space-y-4 pb-24 lg:pb-28">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-[clamp(24px,3.5vw,30px)] leading-tight font-semibold tracking-[0.02em] text-[#152238]">
            {title}
          </h1>
          {!isCreate && selectedVehicle ? (
            <p className="mt-1 truncate text-[14px] text-[#5c6b7e]">
              <Link
                href={`/customers/${selectedVehicle.customerId}`}
                className="font-medium text-[#1f5eff] underline-offset-4 hover:underline"
              >
                {selectedVehicle.customerName}
              </Link>
              <span className="text-slate-300"> · </span>
              <Link
                href={`/vehicles/${selectedVehicle.id}`}
                className="underline-offset-4 hover:text-blue-700 hover:underline"
              >
                {vehicleLabel}
              </Link>
            </p>
          ) : (
            <p className="mt-1 text-[14px] text-[#5c6b7e]">{t("newSubtitle")}</p>
          )}
        </div>
        {!isCreate && props.inspection.serviceOrderId ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge variant="success">{t("linked")}</Badge>
            <Button asChild variant="outline" size="md">
              <Link href={`/orders/${props.inspection.serviceOrderId}`}>
                {t("openJobCard")}
              </Link>
            </Button>
          </div>
        ) : null}
      </header>

      <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start">
        <aside className="sticky top-0 z-20 w-full shrink-0 bg-background pb-1 lg:top-4 lg:w-[220px] lg:bg-transparent lg:pb-0">
          <InspectionSectionNav
            section={activeSection}
            onSectionChange={onSectionChange}
          />
        </aside>

        <div className="min-w-0 flex-1">
          <section
            aria-labelledby="inspection-active-section-title"
            className="min-w-0 overflow-hidden rounded-[14px] border border-[#d7deea] bg-white shadow-[0_3px_17px_rgba(36,58,99,0.06)]"
          >
            <div className="flex flex-col gap-3 border-b border-[#d7deea] bg-[#f8fafc] px-4 py-4 sm:px-5">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[#e8efff] text-[13px] font-black text-[#1f5eff]">
                  {activeSection === "info" ? "01" : "02"}
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h2
                    id="inspection-active-section-title"
                    className="text-[17px] font-semibold tracking-tight text-[#152238]"
                  >
                    {activeSection === "info"
                      ? t("sections.info")
                      : t("sections.report")}
                  </h2>
                  <p className="mt-1 text-[13px] text-[#5c6b7e]">
                    {activeSection === "info"
                      ? t("sectionHints.info")
                      : t("sectionHints.report")}
                  </p>
                </div>
              </div>
            </div>

            <div className="min-w-0 px-4 py-5 sm:px-5">
              {activeSection === "report" && props.mode === "edit" ? (
                <div className="space-y-6">
                  <InspectionReportPanel
                    inspectionId={props.inspection.id}
                    customerName={props.inspection.customer.name}
                    vehicle={props.inspection.vehicle}
                    expectedCompletion={expectedCompletion}
                    complaint={complaint}
                    recommendedNotes={recommendedNotes}
                    items={reportItems}
                  />
                  <InspectionEstimatePanel
                    inspectionId={props.inspection.id}
                    canEdit={props.canEdit}
                    canEditLiveLink={props.estimate?.canEditLiveLink ?? false}
                    liveLinkActive={props.estimate?.liveLinkActive ?? null}
                    pricedLineCount={pricedLineCount}
                    draft={estimateDraft}
                    pendingSources={pendingEstimateSources}
                    current={props.estimate?.current ?? null}
                  />
                </div>
              ) : null}
              {activeSection === "report" && props.mode === "create" ? (
                <div className="rounded-[10px] border border-dashed border-slate-300 bg-slate-50/80 px-4 py-10 text-center">
                  <p className="text-sm font-medium text-slate-700">
                    {t("reportSaveFirstTitle")}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {t("reportSaveFirstBody")}
                  </p>
                </div>
              ) : null}

              <form
                id={formId}
                action={formAction}
                noValidate
                onSubmit={(event) => {
                  const next = validateBeforeSave();
                  if (Object.keys(next).length === 0) {
                    setFieldErrors({});
                    return;
                  }
                  event.preventDefault();
                  setFieldErrors(next);
                  onSectionChange("info");
                  focusFirstSaveError(next);
                }}
                className={
                  activeSection === "info" ? "space-y-5" : "hidden"
                }
              >
                <input
                  type="hidden"
                  name="customerId"
                  value={selectedVehicle?.customerId ?? ""}
                />
                <input
                  type="hidden"
                  name="vehicleId"
                  value={selectedVehicle?.id ?? vehicleId}
                />
                <input type="hidden" name="itemsJson" value={itemsJson} />

                <div className="grid gap-4 sm:grid-cols-2">
                  {isCreate ? (
                    <FormField
                      id="inspection-vehicle"
                      label={t("selectVehicle")}
                      hint={
                        vehicleId || fieldErrors.vehicleId
                          ? undefined
                          : t("selectVehicleHint")
                      }
                      error={fieldErrors.vehicleId}
                    >
                      <SearchableSelect
                        id="inspection-vehicle"
                        value={vehicleId}
                        onChange={(value) => {
                          setVehicleId(value);
                          if (fieldErrors.vehicleId) {
                            setFieldErrors((prev) => ({
                              ...prev,
                              vehicleId: undefined,
                            }));
                          }
                        }}
                        options={vehicleOptions}
                        filter="remote"
                        minQueryLength={0}
                        onQueryChange={setVehicleQuery}
                        onOpenChange={(open) => {
                          if (!open) setVehicleQuery("");
                        }}
                        clearable={false}
                        disabled={Boolean(liveInspectionId)}
                        placeholder={t("selectVehiclePlaceholder")}
                        searchPlaceholder={t(
                          "selectVehicleSearchPlaceholder",
                        )}
                        emptyLabel={t("selectVehicleEmpty")}
                      />
                    </FormField>
                  ) : (
                    <FormField
                      id="inspection-vehicle"
                      label={t("selectVehicle")}
                    >
                      <Input
                        id="inspection-vehicle"
                        value={`${props.inspection.vehicle.registrationNumber} — ${vehicleLabel}`}
                        disabled
                        readOnly
                        className="h-11 min-h-11"
                      />
                    </FormField>
                  )}
                  <FormField
                    id="inspection-expected-completion"
                    label={t("expectedCompletion")}
                    error={fieldErrors.expectedCompletion}
                  >
                    <Input
                      id="inspection-expected-completion"
                      name="expectedCompletion"
                      type="datetime-local"
                      value={expectedCompletion}
                      onChange={(event) => {
                        setExpectedCompletion(event.target.value);
                        if (fieldErrors.expectedCompletion) {
                          setFieldErrors((prev) => ({
                            ...prev,
                            expectedCompletion: undefined,
                          }));
                        }
                      }}
                      disabled={!canEdit}
                      className="h-11 min-h-11"
                    />
                  </FormField>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    id="inspection-complaint"
                    label={t("complaint")}
                    error={fieldErrors.complaint}
                  >
                    <Textarea
                      id="inspection-complaint"
                      name="complaint"
                      rows={4}
                      maxLength={4000}
                      value={complaint}
                      onChange={(event) => {
                        setComplaint(event.target.value);
                        if (fieldErrors.complaint) {
                          setFieldErrors((prev) => ({
                            ...prev,
                            complaint: undefined,
                          }));
                        }
                      }}
                      placeholder={t("complaintPlaceholder")}
                      disabled={!canEdit}
                      className="min-h-[110px]"
                    />
                  </FormField>
                  <FormField
                    id="inspection-recommended"
                    label={t("recommendedNotes")}
                  >
                    <Textarea
                      id="inspection-recommended"
                      name="recommendedNotes"
                      rows={4}
                      maxLength={4000}
                      value={recommendedNotes}
                      onChange={(event) =>
                        setRecommendedNotes(event.target.value)
                      }
                      placeholder={t("recommendedNotesPlaceholder")}
                      disabled={!canEdit}
                      className="min-h-[110px]"
                    />
                  </FormField>
                </div>

                <div className="space-y-4 border-t border-slate-200 pt-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                    <div className="min-w-0">
                      <strong className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
                        {t("vehicleCondition")}
                      </strong>
                      <p className="mt-1 text-sm text-slate-500">
                        {t("vehicleConditionHint")}
                      </p>
                    </div>
                    {items.length > 0 ? (
                      <p className="shrink-0 text-[13px] font-semibold text-blue-700 sm:pt-1">
                        {t("checkedCount", {
                          checked: checkedCount,
                          total: items.length,
                        })}
                        <span className="mx-1.5 text-slate-300">·</span>
                        {t("progressPercent", { percent: progressPercent })}
                      </p>
                    ) : null}
                  </div>

                  <div className="w-full max-w-3xl space-y-3">
                    {canEdit ? (
                      <FormField
                        id="inspection-add-spare"
                        label={t("addCustomItem")}
                        className="gap-1.5 [&_[data-slot=label]]:sr-only"
                        error={fieldErrors.items}
                      >
                        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                          <div className="min-w-0 flex-1">
                            <PartNameSuggestInput
                              id="inspection-add-spare"
                              name="addLabel"
                              value={addLabel}
                              onValueChange={(value) => {
                                setAddLabel(value);
                                if (fieldErrors.items) {
                                  setFieldErrors((prev) => ({
                                    ...prev,
                                    items: undefined,
                                  }));
                                }
                              }}
                              maxLength={120}
                              filterSuggestions={filterInspectionMainPartNames}
                              placeholder={t("customItemPlaceholder")}
                              className={cn(
                                "h-11 min-h-11",
                                fieldErrors.items &&
                                  "border-danger ring-1 ring-danger/30",
                              )}
                            />
                          </div>
                          <Button
                            type="button"
                            size="md"
                            className="h-11 min-h-11 w-full shrink-0 rounded-md sm:w-auto"
                            loading={addingItem}
                            disabled={addingItem}
                            onClick={() => void addItem()}
                          >
                            <Plus
                              className="size-4"
                              strokeWidth={2.5}
                              aria-hidden
                            />
                            {t("addCustomItem")}
                          </Button>
                        </div>
                      </FormField>
                    ) : null}

                    {items.length > 0 ? (
                      <div className="grid grid-cols-1 gap-3">
                        {items.map((item) => (
                          <InspectionItemFields
                            key={item.clientId}
                            item={item}
                            inspectionId={inspectionId}
                            canEdit={canEdit}
                            highlighted={highlightedClientId === item.clientId}
                            onChange={(next) =>
                              setItems((prev) =>
                                prev.map((row) =>
                                  row.clientId === item.clientId ? next : row,
                                ),
                              )
                            }
                            onRemove={() =>
                              setItems((prev) =>
                                prev.filter(
                                  (row) => row.clientId !== item.clientId,
                                ),
                              )
                            }
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </form>
            </div>
          </section>
        </div>
      </div>

      {canEdit ? (
        <FormActionBar
          summary={
            <p className="hidden truncate text-sm font-medium text-muted-foreground sm:block">
              {isCreate ? t("newTitle") : t("sections.info")}
              {selectedVehicle ? (
                <>
                  {" · "}
                  <span className="text-foreground">
                    {selectedVehicle.registrationNumber}
                  </span>
                </>
              ) : null}
            </p>
          }
          actions={
            <>
              <Button asChild type="button" variant="secondary" size="md">
                <Link href={cancelHref}>{t("cancel")}</Link>
              </Button>
              <Button
                type="submit"
                form={formId}
                size="md"
                loading={pending}
                disabled={!selectedVehicle || pending}
              >
                {pending
                  ? t("saving")
                  : isCreate
                    ? t("create")
                    : t("save")}
              </Button>
            </>
          }
        />
      ) : null}
    </div>
  );
}
