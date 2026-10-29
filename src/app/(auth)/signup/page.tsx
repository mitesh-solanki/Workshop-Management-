import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCardBrand } from "@/components/brand/auth-card-brand";
import { SignupForm } from "@/components/auth-forms";
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

export default async function SignupPage() {
  const session = await getOptionalSession();
  if (session) {
    redirect(homePathForRole(session.role));
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="text-center">
          <AuthCardBrand />
          <CardTitle className="text-2xl font-semibold tracking-tight text-slate-900">
            {authCopy("signupTitle")}
          </CardTitle>
          <CardDescription className="text-sm text-slate-500">
            {authCopy("signupSubtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignupForm />
        </CardContent>
      </Card>
      <p className="text-center text-sm text-muted-foreground">
        {authCopy("hasAccount")}{" "}
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
