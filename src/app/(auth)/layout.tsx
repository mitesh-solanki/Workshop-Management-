import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { PageSpinner } from "@/components/shared/page-spinner";

// Auth routes read the session (crypto / connection). Allow blocking navigations.
export const instant = false;

async function AuthHeader() {
  const common = await getTranslations("common");

  return (
    <div className="mb-8 flex items-center justify-between gap-3">
      <p className="text-lg font-semibold tracking-tight">
        {common("appName")}
      </p>
      <LanguageSwitcher />
    </div>
  );
}

function AuthFallback() {
  return <PageSpinner />;
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-1 flex-col px-4 py-8">
      <Suspense fallback={<AuthFallback />}>
        <AuthHeader />
        {children}
      </Suspense>
    </div>
  );
}
