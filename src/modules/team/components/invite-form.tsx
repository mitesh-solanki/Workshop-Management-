"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import {
  inviteTeamMemberAction,
  type TeamActionState,
} from "@/app/actions/team";

const initial: TeamActionState = { ok: false };

const inputClass =
  "min-h-12 w-full rounded-md border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function InviteForm() {
  const t = useTranslations("team");
  const [state, formAction, pending] = useActionState(
    inviteTeamMemberAction,
    initial,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          {t("email")}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="role" className="text-sm font-medium">
          {t("role")}
        </label>
        <select id="role" name="role" required className={inputClass}>
          <option value="MANAGER">{t("roles.MANAGER")}</option>
          <option value="TECHNICIAN">{t("roles.TECHNICIAN")}</option>
          <option value="ACCOUNTANT">{t("roles.ACCOUNTANT")}</option>
        </select>
      </div>
      {state.message && (
        <p
          className={
            state.ok ? "text-sm text-foreground" : "text-sm text-destructive"
          }
          role="status"
        >
          {state.ok ? t("inviteCreated") : state.message}
        </p>
      )}
      {state.inviteUrl && (
        <p className="break-all rounded-md bg-secondary p-3 text-sm">
          {t("inviteLink")}: {state.inviteUrl}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-md bg-primary px-4 text-base font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? t("inviting") : t("invite")}
      </button>
    </form>
  );
}
