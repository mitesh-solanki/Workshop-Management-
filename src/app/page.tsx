import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { PageSpinner } from "@/components/shared/page-spinner";
import { getOptionalSession } from "@/lib/session";

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
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center gap-8 px-4 py-10 lg:px-8">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold tracking-tight text-muted-foreground">
          {common("appName")}
        </p>
        <LanguageSwitcher />
      </div>
      <div className="max-w-xl space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("title")}
        </h1>
        <p className="text-base text-muted-foreground sm:text-lg">
          {t("subtitle")}
        </p>
      </div>
      <div className="flex max-w-md flex-col gap-3 sm:flex-row">
        <Link
          href="/signup"
          className="flex min-h-12 flex-1 items-center justify-center rounded-md bg-primary px-4 text-base font-medium text-primary-foreground"
        >
          {auth("signupLink")}
        </Link>
        <Link
          href="/login"
          className="flex min-h-12 flex-1 items-center justify-center rounded-md bg-secondary px-4 text-base font-medium text-secondary-foreground"
        >
          {auth("loginLink")}
        </Link>
      </div>
    </main>
  );
}

function HomeFallback() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-10 lg:px-8">
      <PageSpinner />
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
