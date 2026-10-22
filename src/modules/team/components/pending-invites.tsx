"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Mail } from "lucide-react";
import {
  resendInviteAction,
  revokeInviteAction,
} from "@/app/actions/team";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { RoleBadge } from "@/components/shared/role-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/toast";

export type PendingInvite = {
  id: string;
  email: string;
  role: "OWNER" | "MANAGER" | "TECHNICIAN" | "ACCOUNTANT";
  expiresAt: Date | string;
  createdAt: Date | string;
  lastEmailStatus?: string | null;
  lastEmailAt?: Date | string | null;
};

function formatInviteDate(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString();
}

type Props = {
  invites: PendingInvite[];
  /** When false, show the section as unavailable (do not invent data). */
  available?: boolean;
};

export function PendingInvitesSection({
  invites,
  available = true,
}: Props) {
  const t = useTranslations("team");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onResend(inviteId: string) {
    setPendingId(inviteId);
    startTransition(async () => {
      const result = await resendInviteAction(inviteId);
      setPendingId(null);
      if (!result.ok) {
        toast.error(result.message ?? t("error"));
        return;
      }
      toast.success(result.message ?? t("inviteResent"));
    });
  }

  function onConfirmRevoke() {
    if (!revokeId) return;
    const inviteId = revokeId;
    setPendingId(inviteId);
    startTransition(async () => {
      const result = await revokeInviteAction(inviteId);
      setPendingId(null);
      setRevokeId(null);
      if (!result.ok) {
        toast.error(result.message ?? t("error"));
        return;
      }
      toast.success(result.message ?? t("inviteRevoked"));
    });
  }

  if (!available) {
    return (
      <section className="space-y-3" aria-labelledby="pending-invites-heading">
        <h2
          id="pending-invites-heading"
          className="text-section-title text-slate-900"
        >
          {t("pending")}
        </h2>
        <Card className="border-dashed opacity-70">
          <CardHeader>
            <CardTitle className="text-body">
              {t("pendingUnavailableTitle")}
            </CardTitle>
            <CardDescription>
              {t("pendingUnavailableDescription")}
            </CardDescription>
          </CardHeader>
          <CardBody className="pt-0">
            <Badge variant="secondary">{t("notAvailableYet")}</Badge>
          </CardBody>
        </Card>
      </section>
    );
  }

  const revoking = Boolean(revokeId) && pending && pendingId === revokeId;

  return (
    <section className="space-y-3" aria-labelledby="pending-invites-heading">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2
          id="pending-invites-heading"
          className="text-section-title text-slate-900"
        >
          {t("pending")}
        </h2>
        {invites.length > 0 ? (
          <p className="text-caption text-slate-500">
            {t("pendingCount", { count: invites.length })}
          </p>
        ) : null}
      </div>

      {invites.length === 0 ? (
        <EmptyState
          compact
          icon={Mail}
          title={t("pendingEmptyTitle")}
          description={t("pendingEmptyDescription")}
        />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <ul className="divide-y divide-border">
            {invites.map((invite) => {
              const busy = pending && pendingId === invite.id;
              return (
                <li
                  key={invite.id}
                  className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="truncate font-medium text-slate-900">
                      {invite.email}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <RoleBadge label={t(`roles.${invite.role}`)} />
                      <span className="text-caption text-slate-500">
                        {t("expiresOn", {
                          date: formatInviteDate(invite.expiresAt),
                        })}
                      </span>
                      {invite.lastEmailStatus === "failed" ? (
                        <Badge variant="danger">{t("emailFailed")}</Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      loading={busy && revokeId !== invite.id}
                      disabled={pending}
                      className="border-blue-600 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                      onClick={() => onResend(invite.id)}
                    >
                      {invite.lastEmailStatus === "failed"
                        ? t("retrySend")
                        : t("resend")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      className="border-danger text-danger hover:bg-danger/5 hover:text-danger"
                      onClick={() => setRevokeId(invite.id)}
                    >
                      {t("revoke")}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <ConfirmDialog
        open={revokeId !== null}
        onOpenChange={(open) => {
          if (!open && !revoking) setRevokeId(null);
        }}
        title={t("revokeTitle")}
        description={t("revokeConfirm")}
        confirmLabel={t("revoke")}
        variant="danger"
        loading={revoking}
        onConfirm={onConfirmRevoke}
      />
    </section>
  );
}
