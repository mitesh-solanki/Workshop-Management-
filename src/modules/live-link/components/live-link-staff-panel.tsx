"use client";

import { useActionState, useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  createLiveLinkAction,
  revokeLiveLinkAction,
  type LiveLinkActionState,
} from "@/app/actions/live-link";

const initial: LiveLinkActionState = { ok: false };

type Props = {
  orderId: string;
  active: { id: string; expiresAt: Date | string } | null;
  canEdit: boolean;
};

export function LiveLinkStaffPanel({ orderId, active, canEdit }: Props) {
  const t = useTranslations("liveLink");
  const tRoles = useTranslations("team.roles");
  const locale = useLocale();

  const createBound = createLiveLinkAction.bind(null, orderId);
  const [createState, createAction, createPending] = useActionState(
    createBound,
    initial,
  );

  const revokeBound = revokeLiveLinkAction.bind(null, orderId);
  const [revokeState, revokeAction, revokePending] = useActionState(
    revokeBound,
    initial,
  );

  const lastCreate = useRef<LiveLinkActionState | null>(null);
  const lastRevoke = useRef<LiveLinkActionState | null>(null);

  useEffect(() => {
    if (createState === lastCreate.current) return;
    lastCreate.current = createState;
    if (createState.ok && createState.url) {
      toast.success(t("linkCreated"));
    } else if (createState.message && !createState.ok) {
      toast.error(createState.message);
    }
  }, [createState, t]);

  useEffect(() => {
    if (revokeState === lastRevoke.current) return;
    lastRevoke.current = revokeState;
    if (revokeState.ok) {
      toast.success(t("linkRevoked"));
    } else if (revokeState.message && !revokeState.ok) {
      toast.error(revokeState.message);
    }
  }, [revokeState, t]);

  const displayUrl =
    createState.ok && createState.url && !revokeState.ok
      ? createState.url
      : null;
  const expiresLabel = createState.expiresAt
    ? new Date(createState.expiresAt).toLocaleString(locale)
    : active
      ? new Date(active.expiresAt).toLocaleString(locale)
      : null;
  const showActive = Boolean(active) && !displayUrl && !revokeState.ok;
  const hasLink = Boolean(active || displayUrl);

  async function copyUrl() {
    if (!displayUrl) return;
    try {
      await navigator.clipboard.writeText(displayUrl);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  return (
    <div className="space-y-4 px-5 py-4 sm:px-6">
      <p className="text-sm text-slate-600">{t("staffHint")}</p>

      {showActive ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
          <p className="text-sm font-medium text-slate-900">{t("linkActive")}</p>
          <p className="mt-1 text-caption text-slate-500">
            {t("expiresAt", {
              when: new Date(active!.expiresAt).toLocaleString(locale),
            })}
          </p>
          <p className="mt-2 text-caption text-slate-500">{t("urlHiddenHint")}</p>
        </div>
      ) : null}

      {displayUrl ? (
        <div className="space-y-2 rounded-lg border border-teal-200 bg-teal-50/40 p-3">
          <p className="text-sm font-medium text-slate-900">{t("linkReady")}</p>
          {expiresLabel ? (
            <p className="text-caption text-slate-500">
              {t("expiresAt", { when: expiresLabel })}
            </p>
          ) : null}
          <p className="break-all text-sm text-teal-800">{displayUrl}</p>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => void copyUrl()}
          >
            {t("copyLink")}
          </Button>
        </div>
      ) : null}

      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <form action={createAction}>
            <Button type="submit" disabled={createPending} className="min-h-11">
              {createPending
                ? t("saving")
                : hasLink
                  ? t("renewLink")
                  : t("createLink")}
            </Button>
          </form>
          {hasLink ? (
            <form action={revokeAction}>
              <Button
                type="submit"
                variant="ghost"
                disabled={revokePending}
                className="min-h-11 text-danger hover:bg-danger/10 hover:text-danger"
              >
                {revokePending ? t("saving") : t("revokeLink")}
              </Button>
            </form>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          {t("readOnly", {
            owner: tRoles("OWNER"),
            manager: tRoles("MANAGER"),
            accountant: tRoles("ACCOUNTANT"),
          })}
        </p>
      )}
    </div>
  );
}
