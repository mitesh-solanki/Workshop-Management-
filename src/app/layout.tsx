import type { Metadata } from "next";
import {
  Geist_Mono,
  Inter,
  Noto_Sans_Devanagari,
  Noto_Sans_Gujarati,
  Outfit,
} from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Suspense } from "react";
import { DocumentLang } from "@/components/shared/document-lang";
import { ToastShell } from "@/components/shared/toast-shell";
import { Spinner } from "@/components/shared/page-spinner";
import { defaultLocale } from "@/i18n/config";
import en from "../../messages/en.json";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const notoDevanagari = Noto_Sans_Devanagari({
  variable: "--font-noto-devanagari",
  subsets: ["devanagari"],
  display: "swap",
});

const notoGujarati = Noto_Sans_Gujarati({
  variable: "--font-noto-gujarati",
  subsets: ["gujarati"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Static metadata — do not call getTranslations/cookies here.
 * Root layout is shared by `/_not-found`, which must prerender without runtime data.
 */
export const metadata: Metadata = {
  title: en.common.appName,
  description: en.common.appDescription,
};

function LocaleFallback() {
  return (
    <main className="flex h-svh w-full flex-1 flex-col items-center justify-center overflow-hidden">
      {/* Outside NextIntlClientProvider — no hard-coded label */}
      <Spinner className="min-h-0 flex-none" />
    </main>
  );
}

async function IntlShell({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <DocumentLang />
      <div className="flex min-h-0 flex-1 flex-col">
        <ToastShell>{children}</ToastShell>
      </div>
    </NextIntlClientProvider>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang={defaultLocale}
      suppressHydrationWarning
      className={`${inter.variable} ${outfit.variable} ${notoDevanagari.variable} ${notoGujarati.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        className="flex h-full min-h-0 flex-col overflow-hidden font-sans"
        suppressHydrationWarning
      >
        <Suspense
          fallback={
            <div className="flex min-h-0 flex-1 flex-col">
              <LocaleFallback />
            </div>
          }
        >
          <div className="flex min-h-0 flex-1 flex-col">
            <IntlShell>{children}</IntlShell>
          </div>
        </Suspense>
      </body>
    </html>
  );
}
