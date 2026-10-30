"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  Battery,
  CircleDot,
  Cog,
  Disc3,
  Droplets,
  Lightbulb,
  MoveVertical,
  Wind,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  updateInspectionConditionAction,
  updateInspectionExternalCheckAction,
  updateInspectionItemAction,
  type InspectionActionState,
} from "@/app/actions/inspections";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { RupeePriceInput } from "@/components/rupee-price-input";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { ItemMediaUploader } from "@/modules/inspections/components/item-media-uploader";
import type { InspectionItemResultValue } from "@/modules/inspections/schema";
import { getSubSpareSuggestions } from "@/modules/inspections/sub-spare-suggestions";
import { PartNameSuggestInput } from "@/modules/inventory/components/part-name-suggest-input";
import { QuantityStepper } from "@/modules/inventory/components/quantity-stepper";

const initial: InspectionActionState = { ok: false };

type MediaRow = {
  id: string;
  kind: "PHOTO" | "VIDEO";
  url: string;
  contentType: string;
};

type Props = {
  inspectionId: string;
  item: {
    id: string;
    key: string;
    label: string;
    result: InspectionItemResultValue | null;
    notes: string | null;
    quantity: number;
    unitPricePaise: number;
    externalCheck: boolean;
    media: MediaRow[];
  };
  canEdit: boolean;
  onResultChange?: (result: InspectionItemResultValue | null) => void;
};

const RESULTS = [
  ["OK", "results.OK", "resultMarks.OK", "ok"],
  ["NEEDS_ATTENTION", "results.NEEDS_ATTENTION", "resultMarks.NEEDS_ATTENTION", "attention"],
  ["URGENT", "results.URGENT", "resultMarks.URGENT", "urgent"],
] as const;

const ITEM_ICONS: Record<string, LucideIcon> = {
  brakes: Disc3,
  tyres: CircleDot,
  battery: Battery,
  lights: Lightbulb,
  fluids: Droplets,
  suspension: MoveVertical,
  ac: Wind,
  wiper: Wind,
  clutch: Cog,
  engine: Cog,
  exhaust: Wind,
  radiator: Droplets,
  steering: CircleDot,
};

const DEFAULT_KEYS = new Set(Object.keys(ITEM_ICONS));

function iconKeyForLabel(label: string): string | null {
  const lower = label.trim().toLowerCase();
  if (lower.includes("brake")) return "brakes";
  if (lower.includes("tyre") || lower.includes("tire")) return "tyres";
  if (lower.includes("battery")) return "battery";
  if (lower.includes("light")) return "lights";
  if (lower.includes("wiper")) return "wiper";
  if (lower.includes("clutch")) return "clutch";
  if (lower.includes("engine")) return "engine";
  if (lower.includes("exhaust")) return "exhaust";
  if (lower.includes("radiator")) return "radiator";
  if (lower.includes("steering")) return "steering";
  if (
    lower.includes("fluid") ||
    lower.includes("oil") ||
    lower.includes("coolant")
  ) {
    return "fluids";
  }
  if (lower.includes("suspension") || lower.includes("shock")) {
    return "suspension";
  }
  if (lower === "ac" || lower.includes(" a/c") || lower.startsWith("ac ")) {
    return "ac";
  }
  return null;
}

export function ChecklistItemCard({
  inspectionId,
  item,
  canEdit,
  onResultChange,
}: Props) {
  const t = useTranslations("inspections");
  const bound = useMemo(
    () => updateInspectionItemAction.bind(null, item.id, inspectionId),
    [item.id, inspectionId],
  );
  const [state, formAction, notesPending] = useActionState(bound, initial);
  const [conditionPending, startConditionSave] = useTransition();
  const [externalPending, startExternalSave] = useTransition();
  const [selected, setSelected] = useState<InspectionItemResultValue | "">(
    item.result ?? "",
  );
  const [externalCheck, setExternalCheck] = useState(item.externalCheck);
  const [label, setLabel] = useState(item.label);
  const [notes, setNotes] = useState(item.notes ?? "");
  const handledMessage = useRef<string | null>(null);
  const notesId = `notes-${item.id}`;
  const pending = notesPending || conditionPending || externalPending;

  const isDefault = DEFAULT_KEYS.has(item.key);
  const title = isDefault ? t(`defaults.${item.key}`) : label;
  const iconKey = ITEM_ICONS[item.key]
    ? item.key
    : (iconKeyForLabel(label) ?? "");
  const Icon = ITEM_ICONS[iconKey] ?? Wrench;
  const subSuggestions = getSubSpareSuggestions(label || item.label);

  useEffect(() => {
    if (!state.message || state.message === handledMessage.current) return;
    handledMessage.current = state.message;
    if (state.ok) {
      toast.success(
        state.message === "itemSaved" ? t("itemSaved") : state.message,
      );
    } else {
      toast.error(state.message);
    }
  }, [state, t]);

  function currentNotes(): string {
    if (typeof document === "undefined") return notes;
    const el = document.getElementById(notesId) as HTMLTextAreaElement | null;
    return el?.value ?? notes;
  }

  function onPick(value: InspectionItemResultValue) {
    if (pending) return;
    const previous = selected;
    const next = selected === value ? "" : value;
    setSelected(next);
    onResultChange?.(next === "" ? null : next);

    startConditionSave(async () => {
      const result = await updateInspectionConditionAction(
        item.id,
        next,
        currentNotes(),
      );
      if (!result.ok) {
        setSelected(previous);
        onResultChange?.(previous === "" ? null : previous);
        toast.error(result.message ?? "Something went wrong");
      }
    });
  }

  function onToggleExternal() {
    if (pending || !canEdit) return;
    const previous = externalCheck;
    const next = !externalCheck;
    setExternalCheck(next);
    startExternalSave(async () => {
      const result = await updateInspectionExternalCheckAction(
        item.id,
        next,
        currentNotes(),
        selected,
      );
      if (!result.ok) {
        setExternalCheck(previous);
        toast.error(result.message ?? "Something went wrong");
      }
    });
  }

  function appendSubSpare(spare: string) {
    setNotes((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return spare;
      if (trimmed.toLowerCase().includes(spare.toLowerCase())) return prev;
      return `${trimmed}, ${spare}`;
    });
  }

  const statusChips = (
    <div
      role="group"
      aria-label={t("condition")}
      className="flex flex-wrap gap-1.5"
    >
      {RESULTS.map(([value, labelKey, markKey, tone]) => {
        const active = selected === value;
        return (
          <button
            key={value}
            type="button"
            disabled={!canEdit || pending}
            title={t(`resultMeanings.${value}`)}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (canEdit) onPick(value);
            }}
            aria-pressed={active}
            className={cn(
              "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border px-3 text-[13px] font-bold transition-colors disabled:opacity-60",
              !canEdit && "pointer-events-none opacity-80",
              !active &&
                "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              active &&
                tone === "ok" &&
                "border-emerald-300 bg-emerald-50 text-emerald-800",
              active &&
                tone === "attention" &&
                "border-amber-300 bg-amber-50 text-amber-800",
              active &&
                tone === "urgent" &&
                "border-red-300 bg-red-50 text-red-700",
            )}
          >
            <span aria-hidden>{t(markKey)}</span>
            <span>{t(labelKey)}</span>
          </button>
        );
      })}
      <button
        type="button"
        disabled={!canEdit || pending}
        title={t("externalCheckHint")}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onToggleExternal();
        }}
        aria-pressed={externalCheck}
        className={cn(
          "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border px-3 text-[13px] font-bold transition-colors disabled:opacity-60",
          !canEdit && "pointer-events-none opacity-80",
          externalCheck
            ? "border-violet-300 bg-violet-50 text-violet-800"
            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
        )}
      >
        {t("externalCheck")}
      </button>
    </div>
  );

  if (!canEdit) {
    return (
      <article className="min-w-0 rounded-[11px] border border-slate-300 bg-white p-3.5 shadow-sm">
        <div className="mb-2.5 flex items-center gap-2.5">
          <div className="grid size-[30px] shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600">
            <Icon className="size-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-[14px] font-semibold text-slate-900">{title}</h4>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {item.result ? (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[13px] font-bold",
                item.result === "OK" &&
                  "border-emerald-300 bg-emerald-50 text-emerald-800",
                item.result === "NEEDS_ATTENTION" &&
                  "border-amber-300 bg-amber-50 text-amber-800",
                item.result === "URGENT" &&
                  "border-red-300 bg-red-50 text-red-700",
              )}
            >
              <span aria-hidden>{t(`resultMarks.${item.result}`)}</span>
              {t(`results.${item.result}`)}
            </span>
          ) : (
            <span className="text-xs text-slate-400">{t("resultUnset")}</span>
          )}
          {item.externalCheck ? (
            <span className="inline-flex items-center rounded-lg border border-violet-300 bg-violet-50 px-2.5 py-1.5 text-[13px] font-bold text-violet-800">
              {t("externalCheck")}
            </span>
          ) : null}
        </div>
        {item.notes ? (
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            {item.notes}
          </p>
        ) : null}
        <p className="mt-2 text-sm text-slate-600">
          {t("quantity")}: {item.quantity}
          <span className="mx-2 text-slate-300">·</span>
          {t("unitPrice")}: {(item.unitPricePaise / 100).toFixed(2)}
        </p>
        {item.media.length > 0 ? (
          <div className="mt-3">
            <ItemMediaUploader
              inspectionId={inspectionId}
              itemId={item.id}
              media={item.media}
              canEdit={false}
            />
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <form
      action={formAction}
      className="min-w-0 rounded-[11px] border border-slate-300 bg-white p-3.5 shadow-sm"
    >
      <input type="hidden" name="result" value={selected} />
      <input
        type="hidden"
        name="externalCheck"
        value={externalCheck ? "true" : "false"}
      />

      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <div className="grid size-[30px] shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600">
            <Icon className="size-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <FormField
              id={`label-${item.id}`}
              label={t("spareName")}
              className="gap-1"
            >
              <PartNameSuggestInput
                id={`label-${item.id}`}
                name="label"
                value={label}
                onValueChange={setLabel}
                required
                maxLength={120}
                className="h-11 min-h-11"
              />
            </FormField>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {statusChips}
          {(conditionPending || externalPending) ? (
            <span className="text-[12px] font-medium text-slate-500">
              {t("saving")}
            </span>
          ) : null}
          <ItemMediaUploader
            inspectionId={inspectionId}
            itemId={item.id}
            media={item.media}
            canEdit
            proofButton
            showGallery={false}
          />
        </div>
      </div>

      {item.media.length > 0 ? (
        <div className="mb-3">
          <ItemMediaUploader
            inspectionId={inspectionId}
            itemId={item.id}
            media={item.media}
            canEdit
            showControls={false}
          />
        </div>
      ) : null}

      <div className="space-y-3 border-t border-slate-300 pt-3">
        <div className="space-y-2">
          <FormField id={notesId} label={t("notes")}>
            <textarea
              id={notesId}
              name="notes"
              maxLength={2000}
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={t("notesPlaceholder")}
              className="min-h-[55px] w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-900 outline-none placeholder:text-slate-400 focus-visible:border-blue-600 focus-visible:ring-[3px] focus-visible:ring-blue-600/10"
            />
          </FormField>
          {subSuggestions.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              <span className="w-full text-[11px] font-medium text-slate-500">
                {t("subSpareSuggestions")}
              </span>
              {subSuggestions.map((spare) => (
                <button
                  key={spare}
                  type="button"
                  className="inline-flex min-h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[12px] font-medium text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800"
                  onClick={() => appendSubSpare(spare)}
                >
                  {spare}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <QuantityStepper
            id={`qty-${item.id}`}
            name="quantity"
            label={t("quantity")}
            defaultValue={item.quantity}
            min={1}
            compact
          />
          <RupeePriceInput
            id={`price-${item.id}`}
            name="unitPriceRupees"
            label={t("unitPrice")}
            hint={t("unitPriceHint")}
            defaultPaise={item.unitPricePaise}
            required={false}
            className="min-w-0 flex-1 sm:max-w-[12rem]"
          />
          <Button
            type="submit"
            size="sm"
            loading={notesPending}
            className="h-11 shrink-0 bg-blue-600 px-4 text-white hover:bg-blue-700 hover:text-white"
          >
            {notesPending ? t("saving") : t("saveItem")}
          </Button>
        </div>
      </div>
    </form>
  );
}
