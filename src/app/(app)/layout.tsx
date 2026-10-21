import { Suspense } from "react";
import { AppContent } from "@/components/app-content";
import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { requireSession } from "@/lib/session";
import en from "../../../messages/en.json";

// App shell always reads the session cookie.
export const instant = false;

async function AuthenticatedChrome({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <>
      <AppHeader session={session} />
      <AppContent>{children}</AppContent>
      <BottomNav />
    </>
  );
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Suspense
        fallback={
          <main className="mx-auto flex w-full max-w-lg flex-1 items-center justify-center px-4 py-10">
            <p className="text-base text-muted-foreground">{en.common.loading}</p>
          </main>
        }
      >
        <AuthenticatedChrome>{children}</AuthenticatedChrome>
      </Suspense>
    </div>
  );
}
