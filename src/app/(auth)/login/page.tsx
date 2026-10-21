import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/auth-forms";
import { getOptionalSession } from "@/lib/session";

export const instant = false;

export default async function LoginPage() {
  const session = await getOptionalSession();
  if (session) {
    redirect("/dashboard");
  }

  const t = await getTranslations("auth");

  return (
    <main className="flex flex-1 flex-col gap-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("loginTitle")}</h1>
        <p className="text-base text-muted-foreground">{t("loginSubtitle")}</p>
      </div>
      <LoginForm />
      <p className="text-sm text-muted-foreground">
        {t("noAccount")}{" "}
        <Link href="/signup" className="font-medium text-foreground underline">
          {t("signupLink")}
        </Link>
      </p>
    </main>
  );
}
