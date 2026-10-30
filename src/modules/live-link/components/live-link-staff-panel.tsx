"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowUpRight, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-select";
import {
  createLiveLinkAction,
  revokeLiveLinkAction,
  type LiveLinkTarget,
} from "@/app/actions/live-link";

const DEFAULT_EXPIRY_HOURS = "168";

const EXPIRY_OPTIONS = [
  { hours: 1, labelKey: "expiry1h" as const },
  { hours: 3, labelKey: "expiry3h" as const },
  { hours: 6, labelKey: "expiry6h" as const },
  { hours: 24, labelKey: "expiry24h" as const },
  { hours: 72, labelKey: "expiry3d" as const },
  { hours: 168, labelKey: "expiry7d" as const },
];

function storageKey(subjectId: string) {
  return `liveLinkUrl:${subjectId}`;
}

export function persistLiveLinkUrl(subjectId: string, url: string) {
  try {
    sessionStorage.setItem(storageKey(subjectId), url);
  } catch {}
}

type Props = {
  orderId?: string;
  inspectionId?: string;
  active: { id: string; expiresAt: Date | string } | null;
  canEdit: boolean;
  variant?: "full" | "embed" | "header";
  estimateOnly?: boolean;
};

export function LiveLinkStaffPanel({
  orderId,
  inspectionId,
  active,
  canEdit,
  variant = "full",
  estimateOnly = false,
}: Props) {
  const t = useTranslations("liveLink");
  const tRoles = useTranslations("team.roles");
  const router = useRouter();
  const subjectId = orderId ?? inspectionId ?? "";
  const target: LiveLinkTarget = orderId
    ? { serviceOrderId: orderId }
    : { inspectionId: inspectionId! };
  const embed = variant === "embed";
  const header = variant === "header";
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [createPending, startCreate] = useTransition();
  const [revokePending, startRevoke] = useTransition();
  const [expiryHours, setExpiryHours] = useState(DEFAULT_EXPIRY_HOURS);

  useEffect(() => {
    try {
      setSavedUrl(sessionStorage.getItem(storageKey(subjectId)));
    } catch {
      setSavedUrl(null);
    }
  }, [subjectId]);

  const displayUrl = savedUrl;
  const linkIsActive = Boolean(displayUrl) || Boolean(active);
  const busy = createPending || revokePending;

  function persistUrl(url: string | null) {
    try {
      if (url) sessionStorage.setItem(storageKey(subjectId), url);
      else sessionStorage.removeItem(storageKey(subjectId));
    } catch {}
    setSavedUrl(url);
  }

  function createLink(hours = DEFAULT_EXPIRY_HOURS) {
    const formData = new FormData();
    formData.set("expiresInHours", hours);
    startCreate(async () => {
      const result = await createLiveLinkAction(target, { ok: false }, formData);
      if (result.ok && result.url) {
        persistUrl(result.url);
        toast.success(t("linkCreated"));
        router.refresh();
        return;
      }
      toast.error(result.message ?? t("createFailed"));
    });
  }

  function onRevoke() {
    startRevoke(async () => {
      const result = await revokeLiveLinkAction(
        target,
        { ok: false },
        new FormData(),
      );
      if (result.ok) {
        persistUrl(null);
        toast.success(t("linkRevoked"));
        router.refresh();
        return;
      }
      toast.error(result.message ?? t("revokeFailed"));
    });
  }

  async function copyUrl() {
    if (!displayUrl) return;
    try {
      await navigator.clipboard.writeText(displayUrl);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  if (header) {
    if (!displayUrl) return null;

    return (
      <a
        href={displayUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-blue-800 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-950"
      >
        {t("openLiveLink")}
        <ArrowUpRight className="size-4 shrink-0" aria-hidden />
      </a>
    );
  }

  if (embed) {
    return (
      <section className="flex flex-wrap items-center gap-2 rounded-[11px] border border-blue-200 bg-blue-50/50 px-3 py-2.5">
        <p className="mr-auto min-w-0 text-[13px] font-semibold text-slate-900">
          {t("embedTitle")}
        </p>
        {createPending && !displayUrl ? (
          <p className="text-[12px] text-slate-600">{t("creatingLink")}</p>
        ) : displayUrl ? (
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-9 min-h-9 border-blue-200 bg-white text-blue-800 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-950"
              onClick={() => void copyUrl()}
            >
              <Copy className="size-3.5" strokeWidth={2.25} aria-hidden />
              {t("copyLiveLink")}
            </Button>
            {canEdit ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                loading={revokePending}
                disabled={busy}
                className="h-9 min-h-9 border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100 hover:text-red-800"
                onClick={onRevoke}
              >
                {t("revoke")}
              </Button>
            ) : null}
          </>
        ) : canEdit ? (
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={createPending}
            disabled={busy}
            onClick={() => createLink(DEFAULT_EXPIRY_HOURS)}
          >
            {linkIsActive ? t("renewLink") : t("createLink")}
          </Button>
        ) : (
          <p className="text-sm text-slate-500">
            {t("readOnly", {
              owner: tRoles("OWNER"),
              manager: tRoles("MANAGER"),
              accountant: tRoles("ACCOUNTANT"),
            })}
          </p>
        )}
      </section>
    );
  }

  const expirySelectId = `expiresInHours-${subjectId}`;

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600">
        {estimateOnly ? t("staffHintEstimateOnly") : t("staffHint")}
      </p>
      {linkIsActive ? (
        <div className="space-y-3 rounded-lg border border-blue-200 bg-white p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-sm font-medium text-slate-900">{t("linkActive")}</p>
            {canEdit ? (
              <Button
                type="button"
                variant="outline"
                size="md"
                loading={revokePending}
                disabled={busy}
                className="border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100 hover:text-red-800"
                onClick={onRevoke}
              >
                {t("revokeLink")}
              </Button>
            ) : null}
          </div>
          {displayUrl ? (
            <div className="inline-flex max-w-full items-center gap-1">
              <p className="min-w-0 break-all text-sm text-blue-800">
                {displayUrl}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="grid size-8 min-h-8 min-w-8 shrink-0 place-items-center gap-0 p-0 text-blue-700 hover:bg-blue-50 hover:text-blue-900 [&_svg]:m-0 [&_svg]:block"
                aria-label={t("copyLink")}
                title={t("copyLink")}
                onClick={() => void copyUrl()}
              >
                <Copy className="size-3.5" strokeWidth={2.25} aria-hidden />
              </Button>
            </div>
          ) : (
            <p className="text-caption text-slate-500">{t("urlHiddenHint")}</p>
          )}
        </div>
      ) : null}
      {canEdit ? (
        <div className="space-y-1.5">
          <label
            htmlFor={expirySelectId}
            className="text-sm font-medium text-slate-800"
          >
            {t("expiryLabel")}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <FormSelect
              id={expirySelectId}
              value={expiryHours}
              onValueChange={setExpiryHours}
              className="w-full min-w-0 sm:max-w-[12rem]"
              options={EXPIRY_OPTIONS.map((opt) => ({
                value: String(opt.hours),
                label: t(opt.labelKey),
              }))}
            />
            <Button
              type="button"
              variant="primary"
              loading={createPending}
              disabled={busy}
              className="h-11 min-h-11 shrink-0"
              onClick={() => createLink(expiryHours)}
            >
              {linkIsActive ? t("renewLink") : t("createLink")}
            </Button>
          </div>
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
