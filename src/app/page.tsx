import { getTranslations } from "next-intl/server";

export default async function HomePage() {
  const t = await getTranslations("home");
  const common = await getTranslations("common");

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-3 px-4 py-10">
      <p className="text-sm text-muted-foreground">{common("appName")}</p>
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-base text-muted-foreground">{t("subtitle")}</p>
    </main>
  );
}
