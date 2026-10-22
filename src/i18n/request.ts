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

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("locale")?.value;
  const locale: Locale =
    cookieLocale && isLocale(cookieLocale) ? cookieLocale : defaultLocale;

  return {
    locale,
    messages: messagesByLocale[locale],
  };
});
