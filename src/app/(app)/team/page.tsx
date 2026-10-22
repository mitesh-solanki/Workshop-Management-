import { getLocale, getTranslations } from "next-intl/server";
import { Users } from "lucide-react";
import { RoleBadge } from "@/components/shared/role-badge";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardBody,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { InitialsAvatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/ui/page-header";
import { ForbiddenError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { InviteModal } from "@/modules/team/components/invite-modal";
import { MemberRowActions } from "@/modules/team/components/member-row-actions";
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
            <DataTable
              columns={[
                {
                  id: "person",
                  header: t("columns.member"),
                  cell: (member) => {
                    const name = member.name ?? member.email;
                    return (
                      <div className="flex items-center gap-3">
                        <InitialsAvatar name={name} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{name}</p>
                          <p className="truncate text-caption text-slate-500">
                            {member.email}
                          </p>
                        </div>
                      </div>
                    );
                  },
                },
                {
                  id: "role",
                  header: t("role"),
                  cell: (member) => (
                    <RoleBadge label={t(`roles.${member.role}`)} />
                  ),
                },
                {
                  id: "status",
                  header: t("columns.status"),
                  cell: () => (
                    <Badge variant="success">{t("statusActive")}</Badge>
                  ),
                },
                {
                  id: "joined",
                  header: t("columns.joined"),
                  cell: (member) => (
                    <span className="text-slate-600">
                      {dateFmt.format(member.createdAt)}
                    </span>
                  ),
                },
                {
                  id: "actions",
                  header: <span className="sr-only">{t("actions")}</span>,
                  className: "w-12 text-right",
                  cell: (member) => (
                    <div className="flex justify-end">
                      <MemberRowActions
                        memberId={member.id}
                        memberName={member.name ?? member.email}
                        memberRole={member.role}
                        canManage={canManageMembers}
                        isSelf={member.id === session.userId}
                      />
                    </div>
                  ),
                },
              ]}
              rows={members}
              getRowKey={(m) => m.id}
              empty={<EmptyState icon={Users} title={t("emptyMembers")} />}
              mobileCard={(member) => {
                const name = member.name ?? member.email;
                return (
                  <Card className="py-0">
                    <CardBody className="flex items-start justify-between gap-3 px-4 py-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <InitialsAvatar name={name} />
                        <div className="min-w-0 space-y-1">
                          <CardTitle className="truncate text-body">
                            {name}
                          </CardTitle>
                          <CardDescription className="truncate">
                            {member.email}
                          </CardDescription>
                          <div className="flex flex-wrap items-center gap-2 pt-0.5">
                            <RoleBadge label={t(`roles.${member.role}`)} />
                            <Badge variant="success">{t("statusActive")}</Badge>
                          </div>
                          <p className="text-caption text-slate-500">
                            {t("joinedOn", {
                              date: dateFmt.format(member.createdAt),
                            })}
                          </p>
                        </div>
                      </div>
                      <MemberRowActions
                        memberId={member.id}
                        memberName={name}
                        memberRole={member.role}
                        canManage={canManageMembers}
                        isSelf={member.id === session.userId}
                      />
                    </CardBody>
                  </Card>
                );
              }}
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
