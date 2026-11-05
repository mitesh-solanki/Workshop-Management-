import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCardBrand } from "@/components/brand/auth-card-brand";
import { ResetPasswordForm } from "@/components/auth-forms";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authCopy } from "@/lib/auth-copy";
import { homePathForRole } from "@/lib/rbac";
import { getOptionalSession } from "@/lib/session";

export const instant = false;

type Props = {
  params: Promise<{ token: string }>;
};

export default async function ResetPasswordPage({ params }: Props) {
  const session = await getOptionalSession();
  if (session) {
    redirect(homePathForRole(session.role));
  }

  const { token } = await params;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="text-center">
          <AuthCardBrand />
          <CardTitle className="text-2xl font-semibold tracking-tight text-slate-900">
            {authCopy("resetTitle")}
          </CardTitle>
          <CardDescription className="text-sm text-slate-500">
            {authCopy("resetSubtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResetPasswordForm token={token} />
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
