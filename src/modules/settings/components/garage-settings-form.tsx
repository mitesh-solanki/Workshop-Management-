"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import {
  updateGarageSettingsAction,
  type SettingsActionState,
} from "@/app/actions/settings";

const initial: SettingsActionState = { ok: false };

const inputClass =
  "min-h-12 w-full rounded-md border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Props = {
  garage: {
    name: string;
    address: string | null;
    gstin: string | null;
  };
  canEdit: boolean;
};

export function GarageSettingsForm({ garage, canEdit }: Props) {
  const t = useTranslations("settings");
  const [state, formAction, pending] = useActionState(
    updateGarageSettingsAction,
    initial,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium">
          {t("garageName")}
        </label>
        <input
          id="name"
          name="name"
          defaultValue={garage.name}
          required
          disabled={!canEdit}
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="address" className="text-sm font-medium">
          {t("address")}
        </label>
        <textarea
          id="address"
          name="address"
          defaultValue={garage.address ?? ""}
          rows={3}
          disabled={!canEdit}
          className={`${inputClass} min-h-24 py-3`}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="gstin" className="text-sm font-medium">
          {t("gstin")}
        </label>
        <input
          id="gstin"
          name="gstin"
          defaultValue={garage.gstin ?? ""}
          disabled={!canEdit}
          className={inputClass}
          autoCapitalize="characters"
        />
      </div>
      {state.message && (
        <p
          className={
            state.ok ? "text-sm text-foreground" : "text-sm text-destructive"
          }
          role="status"
        >
          {state.ok ? t("saved") : state.message}
        </p>
      )}
      {canEdit ? (
        <button
          type="submit"
          disabled={pending}
          className="min-h-12 rounded-md bg-primary px-4 text-base font-medium text-primary-foreground disabled:opacity-60"
        >
          {pending ? t("saving") : t("save")}
        </button>
      ) : (
        <p className="text-sm text-muted-foreground">{t("readOnly")}</p>
      )}
    </form>
  );
}
