"use client";

import { useEffect, useRef, useState } from "react";
import {
  Battery,
  Camera,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Cog,
  Disc3,
  Droplets,
  Lightbulb,
  MoveVertical,
  Plus,
  Trash2,
  Wind,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { SmoothAccordion } from "@/components/ui/smooth-accordion";
import { cn } from "@/lib/utils";
import { paiseToRupeesInput, sanitizeRupeesTyping } from "@/lib/money";
import { ItemMediaUploader } from "@/modules/inspections/components/item-media-uploader";
import { NoteSuggestInput } from "@/modules/inspections/components/note-suggest-input";
import type { InspectionItemResultValue } from "@/modules/inspections/schema";
import {
  parseInspectionSubSpares,
  type InspectionSubSpare,
} from "@/modules/inspections/sub-spares";
import { QuantityStepper } from "@/modules/inventory/components/quantity-stepper";

export type { InspectionSubSpare };
export { parseInspectionSubSpares };

export type InspectionNoteLine = {
  key: string;
  text: string;
  quantity: number;
  unitPriceRupees: string;
};

export type InspectionDraftItem = {
  clientId: string;
  serverId: string | null;
  key: string;
  label: string;
  result: InspectionItemResultValue | null;
  noteLines: InspectionNoteLine[];
  externalCheck: boolean;
  media: Array<{
    id: string;
    kind: "PHOTO" | "VIDEO";
    url: string;
    contentType: string;
  }>;
};

type Props = {
  item: InspectionDraftItem;
  inspectionId: string | null;
  canEdit: boolean;
  highlighted?: boolean;
  onChange: (next: InspectionDraftItem) => void;
  onRemove: () => void;
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

const HINT_KEYS = new Set(Object.keys(ITEM_ICONS));

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

function newNoteLine(
  defaults?: Partial<Pick<InspectionNoteLine, "text" | "quantity" | "unitPriceRupees">>,
): InspectionNoteLine {
  return {
    key: `note_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    text: defaults?.text ?? "",
    quantity: defaults?.quantity ?? 1,
    unitPriceRupees: defaults?.unitPriceRupees ?? "",
  };
}

function parseStoredLines(
  notes: string | null,
  quantity: number,
  unitPricePaise: number,
): InspectionNoteLine[] {
  const parsed = parseInspectionSubSpares(notes, quantity, unitPricePaise);
  if (parsed.length > 0) {
    return parsed.map((line) =>
      newNoteLine({
        text: line.description,
        quantity: line.quantity,
        unitPriceRupees: paiseToRupeesInput(line.unitPricePaise),
      }),
    );
  }

  return [newNoteLine({ quantity, unitPriceRupees: paiseToRupeesInput(unitPricePaise) })];
}

export function draftItemFromServer(item: {
  id: string;
  key: string;
  label: string;
  result: InspectionItemResultValue | null;
  notes: string | null;
  quantity: number;
  unitPricePaise: number;
  externalCheck: boolean;
  media: InspectionDraftItem["media"];
}): InspectionDraftItem {
  return {
    clientId: item.id,
    serverId: item.id,
    key: item.key,
    label: item.label,
    result: item.result,
    noteLines: parseStoredLines(item.notes, item.quantity, item.unitPricePaise),
    externalCheck: item.externalCheck,
    media: item.media,
  };
}

export function createDraftItem(label: string): InspectionDraftItem {
  const clientId = `draft_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  return {
    clientId,
    serverId: null,
    key: clientId,
    label,
    result: null,
    noteLines: [newNoteLine()],
    externalCheck: false,
    media: [],
  };
}

export function linesPayloadForSave(noteLines: InspectionNoteLine[]) {
  return noteLines.map((line) => ({
    note: line.text,
    quantity: line.quantity,
    unitPriceRupees: line.unitPriceRupees,
  }));
}

export function InspectionItemFields({
  item,
  inspectionId,
  canEdit,
  highlighted = false,
  onChange,
  onRemove,
}: Props) {
  const t = useTranslations("inspections");
  const cardRef = useRef<HTMLElement>(null);
  const iconKey = ITEM_ICONS[item.key]
    ? item.key
    : (iconKeyForLabel(item.label) ?? "");
  const Icon = ITEM_ICONS[iconKey] ?? Wrench;
  const hintKey = HINT_KEYS.has(iconKey) ? iconKey : null;
  const hasNoteContent = item.noteLines.some(
    (line) =>
      line.text.trim() ||
      line.quantity !== 1 ||
      line.unitPriceRupees.trim() !== "",
  );
  const [notesOpen, setNotesOpen] = useState(hasNoteContent);
  const canUploadProof = Boolean(inspectionId && item.serverId);

  useEffect(() => {
    if (!highlighted || !cardRef.current) return;
    cardRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [highlighted]);

  function patch(partial: Partial<InspectionDraftItem>) {
    onChange({ ...item, ...partial });
  }

  function onPick(value: InspectionItemResultValue) {
    if (!canEdit) return;
    patch({ result: item.result === value ? null : value });
  }

  function updateLine(key: string, partial: Partial<InspectionNoteLine>) {
    patch({
      noteLines: item.noteLines.map((line) =>
        line.key === key ? { ...line, ...partial } : line,
      ),
    });
  }

  function addLine() {
    setNotesOpen(true);
    patch({ noteLines: [...item.noteLines, newNoteLine()] });
  }

  function removeLine(key: string) {
    if (item.noteLines.length <= 1) {
      patch({ noteLines: [newNoteLine()] });
      return;
    }
    patch({ noteLines: item.noteLines.filter((line) => line.key !== key) });
  }

  const statusChips = (
    <div
      role="group"
      aria-label={t("condition")}
      className="flex flex-wrap gap-1.5"
    >
      {RESULTS.map(([value, labelKey, markKey, tone]) => {
        const active = item.result === value;
        return (
          <button
            key={value}
            type="button"
            disabled={!canEdit}
            title={t(`resultMeanings.${value}`)}
            onClick={() => onPick(value)}
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
        disabled={!canEdit}
        title={t("externalCheckHint")}
        onClick={() => patch({ externalCheck: !item.externalCheck })}
        aria-pressed={item.externalCheck}
        className={cn(
          "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border px-3 text-[13px] font-bold transition-colors disabled:opacity-60",
          !canEdit && "pointer-events-none opacity-80",
          item.externalCheck
            ? "border-violet-300 bg-violet-50 text-violet-800"
            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
        )}
      >
        {t("externalCheck")}
      </button>
    </div>
  );

  const proofControl = canUploadProof ? (
    <ItemMediaUploader
      inspectionId={inspectionId!}
      itemId={item.serverId!}
      media={item.media}
      canEdit={canEdit}
      proofButton
      showGallery={false}
      onMediaChange={(media) => patch({ media })}
    />
  ) : (
    <button
      type="button"
      disabled
      title={t("proofAfterSave")}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-transparent bg-blue-600 px-3 text-[13px] font-bold text-white opacity-60"
    >
      <Camera className="size-3.5" aria-hidden />
      {t("proofMedia")}
    </button>
  );

  const header = (
    <div className="mb-4 flex items-start gap-2.5 pr-9">
      <div className="mt-0.5 grid size-[30px] shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600">
        <Icon className="size-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="text-[14px] font-semibold text-slate-900">
          {item.label}
        </h4>
        <p className="mt-0.5 text-[13px] leading-snug text-slate-500">
          {hintKey ? t(`defaultHints.${hintKey}`) : t("customItemHint")}
        </p>
      </div>
    </div>
  );

  const removeControl = canEdit ? (
    <button
      type="button"
      className="absolute top-2.5 right-2.5 inline-flex size-9 items-center justify-center rounded-md text-red-600 hover:bg-red-50"
      aria-label={t("removeItem")}
      onClick={onRemove}
    >
      <Trash2 className="size-4" strokeWidth={2} aria-hidden />
    </button>
  ) : null;

  const cardClass = cn(
    "relative min-h-0 min-w-0 rounded-[11px] border bg-white p-3 shadow-sm transition-[box-shadow,border-color] duration-500",
    highlighted
      ? "border-blue-500 ring-2 ring-blue-500/30"
      : "border-slate-300",
  );

  if (!canEdit) {
    return (
      <article ref={cardRef} className={cardClass}>
        {header}
        <div className="mb-2.5 flex flex-wrap items-center gap-2">
          {statusChips}
        </div>
        {hasNoteContent ? (
          <ul className="space-y-1.5 text-sm text-slate-600">
            {item.noteLines
              .filter((line) => line.text.trim())
              .map((line) => (
                <li key={line.key}>
                  {line.text}
                  <span className="text-slate-400">
                    {" "}
                    · {t("quantity")} {line.quantity} · {t("unitPrice")}{" "}
                    {line.unitPriceRupees || "0"}
                  </span>
                </li>
              ))}
          </ul>
        ) : null}
        {item.media.length > 0 && inspectionId && item.serverId ? (
          <div className="mt-3">
            <ItemMediaUploader
              inspectionId={inspectionId}
              itemId={item.serverId}
              media={item.media}
              canEdit={false}
            />
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <article ref={cardRef} className={cardClass}>
      {removeControl}
      {header}

      <div className="mb-2 flex flex-wrap items-center gap-2">
        {statusChips}
        <div className="ml-auto shrink-0">{proofControl}</div>
      </div>

      {canUploadProof && item.media.length > 0 ? (
        <div className="mb-2">
          <ItemMediaUploader
            inspectionId={inspectionId!}
            itemId={item.serverId!}
            media={item.media}
            canEdit
            showControls={false}
            onMediaChange={(media) => patch({ media })}
          />
        </div>
      ) : null}

      <div className="border-t border-slate-300 pt-2">
        <div className="relative flex min-h-7 items-center">
          <button
            type="button"
            className="flex min-h-7 w-full items-center gap-1 pr-9 text-left text-[13px] font-bold text-blue-700"
            onClick={() => setNotesOpen((open) => !open)}
            aria-expanded={notesOpen}
          >
            {notesOpen ? (
              <ChevronUp className="size-3.5 shrink-0" aria-hidden />
            ) : (
              <ChevronDown className="size-3.5 shrink-0" aria-hidden />
            )}
            {t("notesOptional")}
          </button>
          <button
            type="button"
            className={cn(
              "absolute top-1/2 right-0 z-10 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md border border-blue-500 bg-blue-50 text-blue-700 hover:bg-blue-100",
              !notesOpen && "invisible pointer-events-none",
            )}
            aria-label={t("addNote")}
            tabIndex={notesOpen ? 0 : -1}
            onClick={(event) => {
              event.stopPropagation();
              addLine();
            }}
          >
            <Plus className="size-3.5" strokeWidth={2.5} aria-hidden />
          </button>
        </div>

        <SmoothAccordion open={notesOpen}>
          <div className="mt-2">
            <ul className="space-y-3 md:hidden">
              {item.noteLines.map((line) => (
                <li
                  key={line.key}
                  className="rounded-xl border border-border bg-card p-3.5 shadow-xs"
                >
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <p className="text-sm font-medium text-slate-700">
                        {t("notes")}
                      </p>
                      <div className="flex items-center gap-1">
                        <NoteSuggestInput
                          id={`note-${item.clientId}-${line.key}`}
                          value={line.text}
                          mainSpareLabel={item.label}
                          onValueChange={(text) =>
                            updateLine(line.key, { text })
                          }
                          placeholder={t("notesPlaceholder")}
                        />
                        <button
                          type="button"
                          className="inline-flex size-7 shrink-0 items-center justify-center text-red-600 hover:text-red-700"
                          aria-label={t("removeNote")}
                          onClick={() => removeLine(line.key)}
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </button>
                      </div>
                    </div>
                    <QuantityStepper
                      key={`qty-m-${line.key}-${line.quantity}`}
                      id={`qty-m-${line.key}`}
                      label={t("quantity")}
                      defaultValue={line.quantity}
                      min={1}
                      onValueChange={(quantity) =>
                        updateLine(line.key, { quantity })
                      }
                    />
                    <div className="space-y-1.5">
                      <p className="text-sm font-medium text-slate-700">
                        {t("unitPrice")}
                      </p>
                      <Input
                        id={`price-m-${line.key}`}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="0"
                        value={line.unitPriceRupees}
                        onChange={(event) =>
                          updateLine(line.key, {
                            unitPriceRupees: sanitizeRupeesTyping(
                              event.target.value,
                            ),
                          })
                        }
                        className="h-11 min-h-11"
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-hidden rounded-xl border border-border md:block">
              <table className="w-full table-fixed caption-bottom text-sm">
                <thead className="bg-slate-100 [&_tr]:border-b [&_tr]:border-border">
                  <tr>
                    <th className="h-9 px-2 text-left align-middle text-[13px] font-medium text-slate-700">
                      {t("notes")}
                    </th>
                    <th className="h-9 w-32 px-1.5 text-left align-middle text-[13px] font-medium text-slate-700">
                      {t("quantityShort")}
                    </th>
                    <th className="h-9 w-[7.3125rem] px-1.5 text-left align-middle text-[13px] font-medium text-slate-700">
                      {t("unitPrice")}
                    </th>
                    <th className="h-9 w-8 p-0 pr-1.5 text-right align-middle">
                      <span className="sr-only">{t("removeNote")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {item.noteLines.map((line) => (
                    <tr
                      key={line.key}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-2 py-1.5 align-middle">
                        <NoteSuggestInput
                          id={`note-${item.clientId}-${line.key}`}
                          value={line.text}
                          mainSpareLabel={item.label}
                          onValueChange={(text) =>
                            updateLine(line.key, { text })
                          }
                          placeholder={t("notesPlaceholder")}
                        />
                      </td>
                      <td className="px-1.5 py-1.5 align-middle">
                        <QuantityStepper
                          key={`qty-${line.key}-${line.quantity}`}
                          id={`qty-${line.key}`}
                          label={t("quantityShort")}
                          hideLabel
                          compact
                          defaultValue={line.quantity}
                          min={1}
                          onValueChange={(quantity) =>
                            updateLine(line.key, { quantity })
                          }
                        />
                      </td>
                      <td className="px-1.5 py-1.5 align-middle">
                        <Input
                          id={`price-${line.key}`}
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          placeholder="0"
                          value={line.unitPriceRupees}
                          onChange={(event) =>
                            updateLine(line.key, {
                              unitPriceRupees: sanitizeRupeesTyping(
                                event.target.value,
                              ),
                            })
                          }
                          className="h-11 min-h-11"
                          aria-label={t("unitPrice")}
                        />
                      </td>
                      <td className="w-8 p-0 pr-1.5 align-middle">
                        <button
                          type="button"
                          className="inline-flex size-7 items-center justify-center text-red-600 hover:text-red-700"
                          aria-label={t("removeNote")}
                          onClick={() => removeLine(line.key)}
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </SmoothAccordion>
      </div>
    </article>
  );
}
