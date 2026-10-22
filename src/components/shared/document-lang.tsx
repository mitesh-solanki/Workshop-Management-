"use client";

import { useLocale } from "next-intl";
import { useEffect } from "react";

/** Syncs `<html lang>` after locale is resolved from the cookie (inside Suspense). */
export function DocumentLang() {
  const locale = useLocale();

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}
