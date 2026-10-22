import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { InviteAcceptForm } from "@/components/auth-forms";
import { hashToken } from "@/lib/otp";
import { getOptionalSession } from "@/lib/session";
import { findPendingInviteByTokenHash } from "@/modules/auth/repo";

export const instant = false;

type Props = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: Props) {
  const session = await getOptionalSession();
  if (session) {
    redirect("/dashboard");
  }

  const { token } = await params;
  const invite = await findPendingInviteByTokenHash(hashToken(token));
  if (!invite) {
    notFound();
  }

  const t = await getTranslations("auth");
  const tRoles = await getTranslations("team.roles");

  return (
    <main className="flex flex-1 flex-col gap-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("inviteTitle")}</h1>
        <p className="text-base text-muted-foreground">
          {t("inviteSubtitle", {
            garage: invite.garage.name,
            role: tRoles(invite.role),
          })}
        </p>
      </div>
      <InviteAcceptForm token={token} email={invite.email} />
      <p className="text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-foreground underline">
          {t("loginLink")}
        </Link>
      </p>
    </main>
  );
}
