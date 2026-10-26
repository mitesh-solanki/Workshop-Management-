"use client";

import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import {
  MembersTable,
  type TeamMemberRow,
} from "@/modules/team/components/members-table";
import {
  PendingInvitesSection,
  type PendingInvite,
} from "@/modules/team/components/pending-invites";

type Props = {
  members: TeamMemberRow[];
  invites: PendingInvite[];
  canInvite: boolean;
  canManageMembers: boolean;
  currentUserId: string;
  joinedLabels: Record<string, string>;
};

export function TeamPagePanel({
  members,
  invites,
  canInvite,
  canManageMembers,
  currentUserId,
  joinedLabels,
}: Props) {
  const t = useTranslations("team");

  return (
    <div className="space-y-6">
      <Card className="min-w-0 gap-0 overflow-visible py-0">
        <section className="space-y-3 border-b border-border px-5 py-5 last:border-b-0 sm:px-6">
          <h2 className="text-section-title text-slate-900">{t("members")}</h2>
          <MembersTable
            members={members}
            canManageMembers={canManageMembers}
            currentUserId={currentUserId}
            joinedLabels={joinedLabels}
          />
        </section>

        {canInvite ? (
          <section className="border-b border-border px-5 py-5 last:border-b-0 sm:px-6">
            <PendingInvitesSection invites={invites} available />
          </section>
        ) : null}
      </Card>
    </div>
  );
}
