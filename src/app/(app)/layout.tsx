import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/shared/app-shell";
import { PageSpinner } from "@/components/shared/page-spinner";
import { requireSession } from "@/lib/session";
import { getGarageSettings } from "@/modules/settings/service";

// App shell always reads the session cookie.
export const instant = false;

async function AuthenticatedChrome({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const garage = await getGarageSettings(session);
  const common = await getTranslations("common");
  const tRoles = await getTranslations("team.roles");
  const userName = session.name ?? session.email;
  const roleLabel = tRoles(session.role);

  return (
    <AppShell
      role={session.role}
      appName={common("appName")}
      garageName={garage.name}
      userName={userName}
      userEmail={session.email}
      roleLabel={roleLabel}
    >
      {children}
    </AppShell>
  );
}

function AppShellFallback() {
  return (
    <main className="flex h-svh w-full flex-1 flex-col items-center justify-center overflow-hidden">
      <PageSpinner className="min-h-0 flex-none" />
    </main>
  );
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-svh min-h-0 flex-1 flex-col overflow-hidden">
      <Suspense fallback={<AppShellFallback />}>
        <AuthenticatedChrome>{children}</AuthenticatedChrome>
      </Suspense>
    </div>
  );
}
