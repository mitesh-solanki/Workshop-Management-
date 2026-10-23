"use client";

import { useActionState, useMemo, useState } from "react";
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
  updateInspectionItemAction,
  type InspectionActionState,
} from "@/app/actions/inspections";
import { Button } from "@/components/ui/button";
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
};

/** Maps stored result → UI tone. Labels explain: Good / Needs attention / Critical. */
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

export function ChecklistItemCard({ orderId, item, canEdit }: Props) {
  const t = useTranslations("inspections");
  const bound = useMemo(
    () => updateInspectionItemAction.bind(null, item.id, orderId),
    [item.id, orderId],
  );
  const [state, formAction, pending] = useActionState(bound, initial);
  const [selected, setSelected] = useState<InspectionItemResultValue | "">(
    item.result ?? "",
  );
  const [prevResult, setPrevResult] = useState(item.result);

  if (item.result !== prevResult) {
    setPrevResult(item.result);
    setSelected(item.result ?? "");
  }

  const isDefault = DEFAULT_KEYS.has(item.key);
  const title = isDefault ? t(`defaults.${item.key}`) : item.label;
  const hint = isDefault ? t(`defaultHints.${item.key}`) : t("customItemHint");
  const Icon = ITEM_ICONS[item.key] ?? Wrench;

  function onPick(value: InspectionItemResultValue) {
    setSelected((current) => (current === value ? "" : value));
  }

  const statusChips = (
    <div
      role="group"
      aria-label={t("condition")}
      className="mb-[18px] flex flex-wrap gap-2"
    >
      {RESULTS.map(([value, labelKey, markKey, tone]) => {
        const active = selected === value;
        return (
          <button
            key={value}
            type="button"
            disabled={!canEdit}
            title={t(`resultMeanings.${value}`)}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (canEdit) onPick(value);
            }}
            aria-pressed={active}
            className={cn(
              "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors",
              !canEdit && "pointer-events-none opacity-80",
              !active &&
                "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              active &&
                tone === "ok" &&
                "border-green-500 bg-green-50 text-green-800",
              active &&
                tone === "attention" &&
                "border-orange-500 bg-orange-50 text-orange-800",
              active &&
                tone === "urgent" &&
                "border-red-500 bg-red-50 text-red-700",
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
    <div className="mb-4 flex items-center gap-3">
      <div className="grid size-[42px] shrink-0 place-items-center rounded-[9px] bg-blue-50 text-blue-600">
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="text-[15px] font-semibold text-slate-900">{title}</h4>
        <p className="mt-1 text-xs leading-snug text-slate-500">{hint}</p>
      </div>
    </div>
  );

  if (!canEdit) {
    return (
      <article className="min-w-0 rounded-[10px] border border-slate-200 bg-white p-4 sm:p-[18px]">
        {header}
        <p className="mb-2 text-xs font-bold text-slate-600">{t("condition")}</p>
        {item.result ? (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold",
              item.result === "OK" &&
                "border-green-500 bg-green-50 text-green-800",
              item.result === "NEEDS_ATTENTION" &&
                "border-orange-500 bg-orange-50 text-orange-800",
              item.result === "URGENT" &&
                "border-red-500 bg-red-50 text-red-700",
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
        <div className="mt-3">
          <ItemMediaUploader
            orderId={orderId}
            itemId={item.id}
            media={item.media}
            canEdit={false}
          />
        </div>
      </article>
    );
  }

  return (
    <form
      action={formAction}
      className="min-w-0 rounded-[10px] border border-slate-200 bg-white p-4 sm:p-[18px]"
    >
      <input type="hidden" name="result" value={selected} />
      {header}

      <p className="mb-2 text-xs font-bold text-slate-600">{t("condition")}</p>
      {statusChips}

      <label
        className="mb-2 block text-xs font-bold text-slate-600"
        htmlFor={`notes-${item.id}`}
      >
        {t("observationOptional")}
      </label>
      <textarea
        id={`notes-${item.id}`}
        name="notes"
        maxLength={2000}
        rows={3}
        defaultValue={item.notes ?? ""}
        placeholder={
          isDefault
            ? t(`notePlaceholders.${item.key}`)
            : t("notesPlaceholder")
        }
        className="min-h-[76px] w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-900 outline-none placeholder:text-slate-400 focus-visible:border-blue-600 focus-visible:ring-[3px] focus-visible:ring-blue-600/10"
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <ItemMediaUploader
          orderId={orderId}
          itemId={item.id}
          media={item.media}
          canEdit
        />
        <Button
          type="submit"
          size="sm"
          loading={pending}
          className="h-9 shrink-0 bg-blue-600 px-4 text-white hover:bg-blue-700 hover:text-white"
        >
          {pending ? t("saving") : t("saveItem")}
        </Button>
      </div>

      {state.message && !state.ok ? (
        <p className="mt-2 text-xs text-red-600" role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
