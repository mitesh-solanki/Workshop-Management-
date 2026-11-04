"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * After opening from sidebar `?create=1`, strip the query so refresh does not reopen.
 */
export function useStripCreateQuery(openedFromQuery: boolean) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!openedFromQuery) return;
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("create") !== "1") return;
    url.searchParams.delete("create");
    const query = url.searchParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [openedFromQuery, pathname, router]);
}
