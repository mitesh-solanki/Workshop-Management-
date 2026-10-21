import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SignupForm } from "@/components/auth-forms";
import { getOptionalSession } from "@/lib/session";

export const instant = false;

export default async function SignupPage() {
  const session = await getOptionalSession();
  if (session) {
    redirect("/dashboard");
  }

  const t = await getTranslations("auth");

  return (
    <main className="flex flex-1 flex-col gap-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("signupTitle")}</h1>
        <p className="text-base text-muted-foreground">{t("signupSubtitle")}</p>
      </div>
      <SignupForm />
      <p className="text-sm text-muted-foreground">
        {t("hasAccount")}{" "}
        <Link href="/login" className="font-medium text-foreground underline">
          {t("loginLink")}
        </Link>
      </p>
    </main>
  );
}
