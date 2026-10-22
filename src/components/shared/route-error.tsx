"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

type RouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export function RouteError({ error, reset }: RouteErrorProps) {
  const t = useTranslations("common");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center lg:px-8">
      <h1 className="text-xl font-semibold tracking-tight">{t("errorTitle")}</h1>
      <p className="max-w-md text-base text-muted-foreground">
        {t("errorDescription")}
      </p>
      {error.digest ? (
        <p className="text-xs text-muted-foreground">
          {t("errorReference", { id: error.digest })}
        </p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="min-h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
      >
        {t("tryAgain")}
      </button>
    </main>
  );
}
