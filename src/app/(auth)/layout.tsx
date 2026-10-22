import { Suspense } from "react";
import { PageSpinner } from "@/components/shared/page-spinner";

// Auth routes read the session (crypto / connection). Allow blocking navigations.
export const instant = false;

function AuthFallback() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted p-6">
      <PageSpinner />
    </div>
  );
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto bg-muted p-6 md:p-10">
      <Suspense fallback={<AuthFallback />}>
        <div className="w-full max-w-sm py-6">{children}</div>
      </Suspense>
    </div>
  );
}
