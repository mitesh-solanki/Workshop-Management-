"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Mail, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SectionSideNav } from "@/components/shared/section-side-nav";
import {
  sectionDomId,
  useSectionScrollSpy,
} from "@/hooks/use-section-scroll-spy";
import {
  MembersTable,
  type TeamMemberRow,
} from "@/modules/team/components/members-table";
import {
  PendingInvitesSection,
  type PendingInvite,
} from "@/modules/team/components/pending-invites";
import {
  TEAM_SECTION_ID_PREFIX,
  TEAM_SECTIONS,
  type TeamSection,
} from "@/modules/team/team-sections";

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

  const sections = useMemo(
    () =>
      (canInvite
        ? TEAM_SECTIONS
        : (["members"] as const)) as readonly TeamSection[],
    [canInvite],
  );

  const { activeSection, scrollToSection, setSectionRef } =
    useSectionScrollSpy({
      sections,
      idPrefix: TEAM_SECTION_ID_PREFIX,
      initialSection: "members",
    });

  const navItems = [
    { id: "members" as const, label: t("members"), icon: Users },
    ...(canInvite
      ? [{ id: "pending" as const, label: t("pending"), icon: Mail }]
      : []),
  ];

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(220px,260px)_minmax(0,1fr)] lg:gap-6">
      <SectionSideNav
        title={t("sectionsTitle")}
        items={navItems}
        active={activeSection}
        onChange={scrollToSection}
      />

      <Card className="min-w-0 gap-0 overflow-visible py-0">
        <section
          id={sectionDomId(TEAM_SECTION_ID_PREFIX, "members")}
          ref={setSectionRef("members")}
          className="scroll-mt-4 space-y-3 border-b border-border px-5 py-5 last:border-b-0 sm:px-6"
        >
          <h2 className="text-section-title text-slate-900">{t("members")}</h2>
          <MembersTable
            members={members}
            canManageMembers={canManageMembers}
            currentUserId={currentUserId}
            joinedLabels={joinedLabels}
          />
        </section>

        {canInvite ? (
          <section
            id={sectionDomId(TEAM_SECTION_ID_PREFIX, "pending")}
            ref={setSectionRef("pending")}
            className="scroll-mt-4 border-b border-border px-5 py-5 last:border-b-0 sm:px-6"
          >
            <PendingInvitesSection invites={invites} available />
          </section>
        ) : null}
      </Card>
    </div>
  );
}
