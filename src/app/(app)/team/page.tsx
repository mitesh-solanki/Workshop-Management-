import { getTranslations } from "next-intl/server";
import { ForbiddenError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { InviteForm } from "@/modules/team/components/invite-form";
import { listTeam } from "@/modules/team/service";

export default async function TeamPage() {
  const session = await requireSession();
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

  return (
    <main className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-base text-muted-foreground">{t("subtitle")}</p>
      </div>

      {error ? (
        <p className="text-sm text-muted-foreground">{error}</p>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-medium">{t("members")}</h2>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("emptyMembers")}</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {members.map((member) => (
                  <li key={member.id} className="flex min-h-14 items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {member.name ?? member.email}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {member.email}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t(`roles.${member.role}`)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {session.role === "OWNER" && (
            <section className="space-y-4">
              <h2 className="text-lg font-medium">{t("inviteTitle")}</h2>
              <InviteForm />
              {invites.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">{t("pending")}</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {invites.map((invite) => (
                      <li key={invite.id}>
                        {invite.email} · {t(`roles.${invite.role}`)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
