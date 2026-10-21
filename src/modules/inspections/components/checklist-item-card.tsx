"use client";

import { useActionState, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  updateInspectionItemAction,
  type InspectionActionState,
} from "@/app/actions/inspections";
import { ItemMediaUploader } from "@/modules/inspections/components/item-media-uploader";
import type { InspectionItemResultValue } from "@/modules/inspections/schema";

const initial: InspectionActionState = { ok: false };

const inputClass =
  "min-h-12 w-full rounded-md border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring";

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

export function ChecklistItemCard({ orderId, item, canEdit }: Props) {
  const t = useTranslations("inspections");
  const bound = useMemo(
    () => updateInspectionItemAction.bind(null, item.id, orderId),
    [item.id, orderId],
  );
  const [state, formAction, pending] = useActionState(bound, initial);

  const title =
    item.key === "brakes" ||
    item.key === "tyres" ||
    item.key === "battery" ||
    item.key === "lights" ||
    item.key === "fluids" ||
    item.key === "suspension" ||
    item.key === "ac"
      ? t(`defaults.${item.key}`)
      : item.label;

  return (
    <article className="space-y-4 rounded-md border p-3">
      <h3 className="text-base font-semibold">{title}</h3>

      {canEdit ? (
        <form action={formAction} className="flex flex-col gap-3">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t("result")}</legend>
            <div className="grid grid-cols-1 gap-2">
              {(
                [
                  ["OK", "results.OK"],
                  ["NEEDS_ATTENTION", "results.NEEDS_ATTENTION"],
                  ["URGENT", "results.URGENT"],
                ] as const
              ).map(([value, labelKey]) => (
                <label
                  key={value}
                  className="flex min-h-12 items-center gap-3 rounded-md border px-3 text-base"
                >
                  <input
                    type="radio"
                    name="result"
                    value={value}
                    defaultChecked={item.result === value}
                    className="size-5"
                  />
                  {t(labelKey)}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`notes-${item.id}`} className="text-sm font-medium">
              {t("notes")}
            </label>
            <textarea
              id={`notes-${item.id}`}
              name="notes"
              rows={2}
              maxLength={2000}
              defaultValue={item.notes ?? ""}
              className={`${inputClass} py-2`}
            />
          </div>
          {state.message && (
            <p
              className={
                state.ok ? "text-sm text-foreground" : "text-sm text-destructive"
              }
              role="status"
            >
              {state.ok ? t("itemSaved") : state.message}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="min-h-12 rounded-md bg-primary px-4 text-base font-medium text-primary-foreground disabled:opacity-60"
          >
            {pending ? t("saving") : t("saveItem")}
          </button>
        </form>
      ) : (
        <div className="space-y-1 text-sm">
          <p>
            <span className="text-muted-foreground">{t("result")}: </span>
            {item.result ? t(`results.${item.result}`) : t("resultUnset")}
          </p>
          {item.notes && <p className="whitespace-pre-wrap">{item.notes}</p>}
        </div>
      )}

      <ItemMediaUploader
        orderId={orderId}
        itemId={item.id}
        media={item.media}
        canEdit={canEdit}
      />
    </article>
  );
}
