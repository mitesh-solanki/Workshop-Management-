"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronDown, Copy } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-select";
import { SmoothAccordion } from "@/components/ui/smooth-accordion";
import { cn } from "@/lib/utils";
import {
  createLiveLinkAction,
  revokeLiveLinkAction,
} from "@/app/actions/live-link";

const EXPIRY_OPTIONS = [
  { hours: 1, labelKey: "expiry1h" as const },
  { hours: 3, labelKey: "expiry3h" as const },
  { hours: 6, labelKey: "expiry6h" as const },
  { hours: 24, labelKey: "expiry24h" as const },
  { hours: 72, labelKey: "expiry3d" as const },
  { hours: 168, labelKey: "expiry7d" as const },
];

function storageKey(orderId: string) {
  return `liveLinkUrl:${orderId}`;
}

/** Set after first estimate create so the pricing embed opens once. */
export function markOpenLiveLinkEmbed(orderId: string) {
  try {
    sessionStorage.setItem(`openLiveLinkEmbed:${orderId}`, "1");
  } catch {
    /* ignore */
  }
}

function consumeOpenLiveLinkEmbed(orderId: string): boolean {
  try {
    const key = `openLiveLinkEmbed:${orderId}`;
    if (sessionStorage.getItem(key) !== "1") return false;
    sessionStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

type Props = {
  orderId: string;
  active: { id: string; expiresAt: Date | string } | null;
  canEdit: boolean;
  /** Compact card for estimate / billing sections (same one link). */
  variant?: "full" | "embed";
};

export function LiveLinkStaffPanel({
  orderId,
  active,
  canEdit,
  variant = "full",
}: Props) {
  const t = useTranslations("liveLink");
  const tRoles = useTranslations("team.roles");
  const locale = useLocale();
  const router = useRouter();
  const embed = variant === "embed";
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [createPending, startCreate] = useTransition();
  const [revokePending, startRevoke] = useTransition();
  const [expiryHours, setExpiryHours] = useState("168");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      setSavedUrl(sessionStorage.getItem(storageKey(orderId)));
    } catch {
      setSavedUrl(null);
    }
  }, [orderId]);

  useEffect(() => {
    if (!embed) return;
    if (consumeOpenLiveLinkEmbed(orderId)) {
      setOpen(true);
    }
  }, [embed, orderId]);

  const displayUrl = savedUrl;
  const expiresLabel = expiresAt
    ? new Date(expiresAt).toLocaleString(locale)
    : active
      ? new Date(active.expiresAt).toLocaleString(locale)
      : null;
  const linkIsActive = Boolean(displayUrl) || Boolean(active);
  const busy = createPending || revokePending;

  function persistUrl(url: string | null) {
    try {
      if (url) sessionStorage.setItem(storageKey(orderId), url);
      else sessionStorage.removeItem(storageKey(orderId));
    } catch {
      /* ignore */
    }
    setSavedUrl(url);
  }

  function onCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("expiresInHours", expiryHours);
    startCreate(async () => {
      const result = await createLiveLinkAction(orderId, { ok: false }, formData);
      if (result.ok && result.url) {
        persistUrl(result.url);
        setExpiresAt(result.expiresAt ?? null);
        setOpen(true);
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
        orderId,
        { ok: false },
        new FormData(),
      );
      if (result.ok) {
        persistUrl(null);
        setExpiresAt(null);
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

  const expirySelectId = embed
    ? `expiresInHours-embed-${orderId}`
    : `expiresInHours-${orderId}`;

  const body = (
    <>
      {linkIsActive ? (
        <div className="space-y-3 rounded-lg border border-blue-200 bg-white p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900">
                {t("linkActive")}
              </p>
              {expiresLabel ? (
                <p className="mt-1 text-caption text-slate-500">
                  {t("expiresAt", { when: expiresLabel })}
                </p>
              ) : null}
            </div>
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
        <form onSubmit={onCreate} className="space-y-1.5">
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
              type="submit"
              variant="primary"
              loading={createPending}
              disabled={busy}
              className="h-11 min-h-11 shrink-0"
            >
              {linkIsActive ? t("renewLink") : t("createLink")}
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-slate-500">
          {t("readOnly", {
            owner: tRoles("OWNER"),
            manager: tRoles("MANAGER"),
            accountant: tRoles("ACCOUNTANT"),
          })}
        </p>
      )}
    </>
  );

  if (embed) {
    return (
      <section className="overflow-hidden rounded-[11px] border border-blue-200 bg-blue-50/50">
        <button
          type="button"
          className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="min-w-0">
            <strong className="block text-[15px] font-semibold text-slate-900">
              {t("embedTitle")}
            </strong>
            <span className="mt-1 block text-[12px] leading-relaxed text-slate-600">
              {t("embedHint")}
            </span>
          </span>
          <ChevronDown
            className={cn(
              "mt-0.5 size-4 shrink-0 text-slate-600 transition-transform duration-300",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </button>
        <SmoothAccordion open={open}>
          <div className="space-y-3 border-t border-blue-200/80 px-4 py-3.5">
            {body}
          </div>
        </SmoothAccordion>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600">{t("staffHint")}</p>
      {body}
    </div>
  );
}
