import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { signOutAction } from "@/app/actions/auth";
import type { SessionContext } from "@/lib/session";

export async function AppHeader({ session }: { session: SessionContext }) {
  const t = await getTranslations("nav");
  const common = await getTranslations("common");

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{common("appName")}</p>
          <p className="truncate text-xs text-muted-foreground">
            {session.name ?? session.email} · {session.role}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <form action={signOutAction}>
            <button
              type="submit"
              className="min-h-11 rounded-md bg-secondary px-3 text-sm font-medium text-secondary-foreground"
            >
              {t("signOut")}
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
