import { getLocale, getTranslations } from "next-intl/server";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ForbiddenError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { InviteModal } from "@/modules/team/components/invite-modal";
import { MembersTable } from "@/modules/team/components/members-table";
import { PendingInvitesSection } from "@/modules/team/components/pending-invites";
import { listTeam } from "@/modules/team/service";

/** Auth session uses request-time crypto — do not prerender this route. */
export const instant = false;

export default async function TeamPage() {
  const session = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations("team");

  let members: Awaited<ReturnType<typeof listTeam>>["members"] = [];
  let invites: Awaited<ReturnType<typeof listTeam>>["invites"] = [];
  let error: string | null = null;

  try {
    const team = await listTeam(session);
    members = team.members;
    invites = team.invites;
  } catch (e) {
    if (e instanceof ForbiddenError) {
      error = t("forbidden");
    } else {
      error = t("error");
    }
  }

  const canInvite = session.role === "OWNER";
  const canManageMembers = session.role === "OWNER";
  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const joinedLabels = Object.fromEntries(
    members.map((member) => [member.id, dateFmt.format(member.createdAt)]),
  );

  return (
    <main className="space-y-8">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={canInvite && !error ? <InviteModal /> : undefined}
      />

      {error ? (
        <EmptyState icon={Users} title={error} />
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-section-title text-slate-900">{t("members")}</h2>
            <MembersTable
              members={members}
              canManageMembers={canManageMembers}
              currentUserId={session.userId}
              joinedLabels={joinedLabels}
            />
          </section>

          {canInvite ? (
            <PendingInvitesSection invites={invites} available />
          ) : null}
        </>
      )}
    </main>
  );
}
