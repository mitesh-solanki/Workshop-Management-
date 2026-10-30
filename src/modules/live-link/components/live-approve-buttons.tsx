"use client";

import { useActionState, useEffect, useRef } from "react";
import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  liveApproveLineAction,
  type LiveLinkActionState,
} from "@/app/actions/live-link";

const initial: LiveLinkActionState = { ok: false };

type Props = {
  token: string;
  lineId: string;
};

export function LiveApproveButtons({ token, lineId }: Props) {
  const t = useTranslations("liveLink");

  const approveBound = liveApproveLineAction.bind(
    null,
    token,
    lineId,
    "APPROVED",
  );
  const rejectBound = liveApproveLineAction.bind(
    null,
    token,
    lineId,
    "REJECTED",
  );

  const [approveState, approveAction, approvePending] = useActionState(
    approveBound,
    initial,
  );
  const [rejectState, rejectAction, rejectPending] = useActionState(
    rejectBound,
    initial,
  );

  const lastApprove = useRef<LiveLinkActionState | null>(null);
  const lastReject = useRef<LiveLinkActionState | null>(null);

  useEffect(() => {
    if (approveState === lastApprove.current) return;
    lastApprove.current = approveState;
    if (approveState.ok) {
      toast.success(t("lineApproved"));
    } else if (approveState.message && !approveState.ok) {
      toast.error(approveState.message);
    }
  }, [approveState, t]);

  useEffect(() => {
    if (rejectState === lastReject.current) return;
    lastReject.current = rejectState;
    if (rejectState.ok) {
      toast.success(t("lineRejected"));
    } else if (rejectState.message && !rejectState.ok) {
      toast.error(rejectState.message);
    }
  }, [rejectState, t]);

  const busy = approvePending || rejectPending;

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <form action={approveAction}>
        <Button
          type="submit"
          size="sm"
          disabled={busy}
          loading={approvePending}
          className="h-9 min-h-9 border border-emerald-600 bg-emerald-600 px-2.5 text-white hover:border-emerald-700 hover:bg-emerald-700 hover:text-white"
          aria-label={t("approve")}
        >
          <Check className="size-3.5" strokeWidth={2.5} aria-hidden />
          {t("approve")}
        </Button>
      </form>
      <form action={rejectAction}>
        <Button
          type="submit"
          size="sm"
          disabled={busy}
          loading={rejectPending}
          className="h-9 min-h-9 border border-red-600 bg-red-600 px-2.5 text-white hover:border-red-700 hover:bg-red-700 hover:text-white"
          aria-label={t("reject")}
        >
          <X className="size-3.5" strokeWidth={2.5} aria-hidden />
          {t("reject")}
        </Button>
      </form>
    </div>
  );
}
