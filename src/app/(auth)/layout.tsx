import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import en from "../../../messages/en.json";

// Auth routes read the session (crypto / connection). Allow blocking navigations.
export const instant = false;

async function AuthHeader() {
  const common = await getTranslations("common");

  return (
    <div className="mb-8 flex items-center justify-between gap-3">
      <p className="text-lg font-semibold">{common("appName")}</p>
      <LanguageSwitcher />
    </div>
  );
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-1 flex-col px-4 py-8">
      <Suspense
        fallback={
          <div className="mb-8">
            <p className="text-lg font-semibold">{en.common.appName}</p>
          </div>
        }
      >
        <AuthHeader />
      </Suspense>
      <Suspense
        fallback={
          <p className="text-base text-muted-foreground">{en.common.loading}</p>
        }
      >
        {children}
      </Suspense>
    </div>
  );
}
