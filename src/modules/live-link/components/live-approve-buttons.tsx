"use client";

import { useActionState, useEffect, useRef } from "react";
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
    <div className="flex flex-wrap gap-2">
      <form action={approveAction}>
        <Button
          type="submit"
          disabled={busy}
          className="min-h-11 min-w-[44px]"
        >
          {approvePending ? t("saving") : t("approve")}
        </Button>
      </form>
      <form action={rejectAction}>
        <Button
          type="submit"
          variant="outline"
          disabled={busy}
          className="min-h-11 min-w-[44px]"
        >
          {rejectPending ? t("saving") : t("reject")}
        </Button>
      </form>
    </div>
  );
}
