import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCardBrand } from "@/components/brand/auth-card-brand";
import { LoginForm } from "@/components/auth-forms";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authCopy } from "@/lib/auth-copy";
import { getOptionalSession } from "@/lib/session";
import { isProdPasswordLoginEnabled } from "@/modules/auth/service";

export const instant = false;

export default async function LoginPage() {
  const session = await getOptionalSession();
  if (session) {
    redirect("/dashboard");
  }

  const passwordLoginEnabled = isProdPasswordLoginEnabled();

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="text-center">
          <AuthCardBrand />
          <CardTitle className="text-2xl font-semibold tracking-tight text-slate-900">
            {authCopy("loginTitle")}
          </CardTitle>
          <CardDescription className="text-sm text-slate-500">
            {passwordLoginEnabled
              ? authCopy("loginSubtitlePassword")
              : authCopy("loginSubtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm passwordLoginEnabled={passwordLoginEnabled} />
        </CardContent>
      </Card>
      <p className="text-center text-sm text-muted-foreground">
        {authCopy("noAccount")}{" "}
        <Link
          href="/signup"
          className="font-medium text-foreground underline underline-offset-4"
        >
          {authCopy("signupLink")}
        </Link>
      </p>
    </div>
  );
}
