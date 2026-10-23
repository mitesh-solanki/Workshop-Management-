import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale, type Locale } from "./config";
import en from "../../messages/en.json";
import hi from "../../messages/hi.json";
import gu from "../../messages/gu.json";

/**
 * Static catalogs — Turbopack breaks `import(\`./messages/${locale}.json\`)`
 * and can serve the wrong/partial file, which shows raw keys in the UI.
 */
const messagesByLocale = {
  en,
  hi,
  gu,
} as const satisfies Record<Locale, typeof en>;

async function localeFromCookie(): Promise<Locale> {
  try {
    const cookieStore = await cookies();
    const cookieLocale = cookieStore.get("locale")?.value;
    if (cookieLocale && isLocale(cookieLocale)) {
      return cookieLocale;
    }
  } catch {
    // Next.js 16 + cacheComponents can throw InvariantError on cookies()
    // during some server-action revalidations (dev). Fall back to default.
  }
  return defaultLocale;
}

export default getRequestConfig(async () => {
  const locale = await localeFromCookie();

  return {
    locale,
    messages: messagesByLocale[locale],
  };
});
