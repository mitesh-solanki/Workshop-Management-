import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getOptionalSession } from "@/lib/session";
import en from "../../messages/en.json";

// Home checks the session to redirect signed-in users.
export const instant = false;

async function HomeContent() {
  const session = await getOptionalSession();
  if (session) {
    redirect("/dashboard");
  }

  const t = await getTranslations("home");
  const common = await getTranslations("common");
  const auth = await getTranslations("auth");

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{common("appName")}</p>
        <LanguageSwitcher />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-base text-muted-foreground">{t("subtitle")}</p>
      </div>
      <div className="flex flex-col gap-3">
        <Link
          href="/signup"
          className="flex min-h-12 items-center justify-center rounded-md bg-primary px-4 text-base font-medium text-primary-foreground"
        >
          {auth("signupLink")}
        </Link>
        <Link
          href="/login"
          className="flex min-h-12 items-center justify-center rounded-md bg-secondary px-4 text-base font-medium text-secondary-foreground"
        >
          {auth("loginLink")}
        </Link>
      </div>
    </main>
  );
}

function HomeFallback() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-6 px-4 py-10">
      <p className="text-base text-muted-foreground">{en.common.loading}</p>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomeFallback />}>
      <HomeContent />
    </Suspense>
  );
}
