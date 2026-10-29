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
  updateInspectionItemAction,
  type InspectionActionState,
} from "@/app/actions/inspections";
import { Button } from "@/components/ui/button";
import { SmoothAccordion } from "@/components/ui/smooth-accordion";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { ItemMediaUploader } from "@/modules/inspections/components/item-media-uploader";
import type { InspectionItemResultValue } from "@/modules/inspections/schema";

const initial: InspectionActionState = { ok: false };

type MediaRow = {
  id: string;
  kind: "PHOTO" | "VIDEO";
  url: string;
  contentType: string;
};

type Props = {
  orderId: string;
  item: {
    id: string;
    key: string;
    label: string;
    result: InspectionItemResultValue | null;
    notes: string | null;
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
};

const DEFAULT_KEYS = new Set(Object.keys(ITEM_ICONS));

export function ChecklistItemCard({
  orderId,
  item,
  canEdit,
  onResultChange,
}: Props) {
  const t = useTranslations("inspections");
  const bound = useMemo(
    () => updateInspectionItemAction.bind(null, item.id, orderId),
    [item.id, orderId],
  );
  const [state, formAction, notesPending] = useActionState(bound, initial);
  const [conditionPending, startConditionSave] = useTransition();
  const [selected, setSelected] = useState<InspectionItemResultValue | "">(
    item.result ?? "",
  );
  const hasExtras = Boolean(item.notes?.trim()) || item.media.length > 0;
  // Photos live outside this accordion — never open it because of media
  // (refresh after remove would remount and force it open).
  const [notesOpen, setNotesOpen] = useState(
    () => Boolean(item.notes?.trim()),
  );
  const handledMessage = useRef<string | null>(null);
  const notesId = `notes-${item.id}`;
  const pending = notesPending || conditionPending;

  useEffect(() => {
    if (!state.message || state.message === handledMessage.current) return;
    handledMessage.current = state.message;
    if (state.ok) {
      toast.success(
        state.message === "itemSaved" ? t("itemSaved") : state.message,
      );
      queueMicrotask(() => setNotesOpen(false));
    } else {
      toast.error(state.message);
    }
  }, [state, t]);

  const isDefault = DEFAULT_KEYS.has(item.key);
  const title = isDefault ? t(`defaults.${item.key}`) : item.label;
  const hint = isDefault ? t(`defaultHints.${item.key}`) : t("customItemHint");
  const Icon = ITEM_ICONS[item.key] ?? Wrench;

  function currentNotes(): string {
    if (typeof document === "undefined") return item.notes ?? "";
    const el = document.getElementById(notesId) as HTMLTextAreaElement | null;
    return el?.value ?? item.notes ?? "";
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
    </div>
  );

  const header = (
    <div className="mb-2.5 flex items-center gap-2.5">
      <div className="grid size-[30px] shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600">
        <Icon className="size-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="text-[14px] font-semibold text-slate-900">{title}</h4>
        <p className="mt-0.5 text-[13px] leading-snug text-slate-500">{hint}</p>
      </div>
    </div>
  );

  if (!canEdit) {
    return (
      <article className="min-w-0 rounded-[11px] border border-slate-300 bg-white p-3.5 shadow-sm">
        {header}
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
            title={t(`resultMeanings.${item.result}`)}
          >
            <span aria-hidden>{t(`resultMarks.${item.result}`)}</span>
            {t(`results.${item.result}`)}
          </span>
        ) : (
          <span className="text-xs text-slate-400">{t("resultUnset")}</span>
        )}
        {item.notes ? (
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            {item.notes}
          </p>
        ) : null}
        {item.media.length > 0 ? (
          <div className="mt-3">
            <ItemMediaUploader
              orderId={orderId}
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
      {header}
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        {statusChips}
        {conditionPending ? (
          <span className="text-[12px] font-medium text-slate-500">
            {t("saving")}
          </span>
        ) : null}
        <div className="ml-auto shrink-0">
          <ItemMediaUploader
            orderId={orderId}
            itemId={item.id}
            media={item.media}
            canEdit
            proofButton
            showGallery={false}
          />
        </div>
      </div>

      {item.media.length > 0 ? (
        <div className="mb-2.5">
          <ItemMediaUploader
            orderId={orderId}
            itemId={item.id}
            media={item.media}
            canEdit
            showControls={false}
          />
        </div>
      ) : null}

      <div className="border-t border-slate-300 pt-2">
        <button
          type="button"
          className="text-[13px] font-bold text-blue-700"
          onClick={() => setNotesOpen((open) => !open)}
          aria-expanded={notesOpen}
        >
          {notesOpen ? "− " : "+ "}
          {hasExtras ? t("notesPhotosAdded") : t("notesOptional")}
        </button>
        <SmoothAccordion open={notesOpen}>
          <div className="mt-2.5 space-y-2.5">
            <textarea
              id={notesId}
              name="notes"
              maxLength={2000}
              rows={2}
              defaultValue={item.notes ?? ""}
              placeholder={
                isDefault
                  ? t(`notePlaceholders.${item.key}`)
                  : t("notesPlaceholder")
              }
              className="min-h-[55px] w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-900 outline-none placeholder:text-slate-400 focus-visible:border-blue-600 focus-visible:ring-[3px] focus-visible:ring-blue-600/10"
            />
            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                loading={notesPending}
                className="h-9 shrink-0 bg-blue-600 px-3 text-white hover:bg-blue-700 hover:text-white"
              >
                {notesPending ? t("saving") : t("saveItem")}
              </Button>
            </div>
          </div>
        </SmoothAccordion>
      </div>
    </form>
  );
}
