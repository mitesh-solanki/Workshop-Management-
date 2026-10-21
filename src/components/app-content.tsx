"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Workshop board needs horizontal columns; other screens stay phone-narrow. */
export function AppContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const wide = pathname === "/workshop" || pathname.startsWith("/workshop/");

  return (
    <div
      className={cn(
        "mx-auto w-full flex-1 px-4 py-4 pb-24",
        wide ? "max-w-6xl" : "max-w-lg",
      )}
    >
      {children}
    </div>
  );
}
