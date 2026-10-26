import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AuthCardBrand } from "@/components/brand/auth-card-brand";
import { InviteAcceptForm } from "@/components/auth-forms";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authCopy, authTeamRolesCopy } from "@/lib/auth-copy";
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

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="text-center">
          <AuthCardBrand />
          <CardTitle className="text-2xl font-semibold tracking-tight text-slate-900">
            {authCopy("inviteTitle")}
          </CardTitle>
          <CardDescription className="text-sm text-slate-500">
            {authCopy("inviteSubtitle", {
              garage: invite.garage.name,
              role: authTeamRolesCopy(invite.role),
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteAcceptForm token={token} email={invite.email} />
        </CardContent>
      </Card>
      <p className="text-center text-sm text-muted-foreground">
        <Link
          href="/login"
          className="font-medium text-foreground underline underline-offset-4"
        >
          {authCopy("loginLink")}
        </Link>
      </p>
    </div>
  );
}
