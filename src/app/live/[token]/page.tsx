import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { getClientIp } from "@/lib/client-ip";
import { PublicLiveViewPanel } from "@/modules/live-link/components/public-live-view";
import {
  getPublicLiveView,
  type LiveLinkAccessFailure,
} from "@/modules/live-link/service";

export const instant = false;

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ paid?: string }>;
};

function isAccessFailure(reason: string): reason is LiveLinkAccessFailure {
  return (
    reason === "wrong_token" ||
    reason === "expired" ||
    reason === "revoked" ||
    reason === "rate_limited"
  );
}

export default async function LiveLinkPage({ params, searchParams }: Props) {
  await connection();
  const { token } = await params;
  const { paid } = await searchParams;
  const t = await getTranslations("liveLink");
  const ip = await getClientIp();
  const result = await getPublicLiveView(token, ip);

  if (!result.ok) {
    const reason = isAccessFailure(result.reason)
      ? result.reason
      : "wrong_token";
    return (
      <main className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-3 px-4 py-16 text-center">
        <h1 className="text-page-title text-slate-900">
          {t(`unavailable.${reason}.title`)}
        </h1>
        <p className="text-sm text-slate-600">
          {t(`unavailable.${reason}.body`)}
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-full w-full bg-background">
      <PublicLiveViewPanel
        token={token}
        view={result.view}
        paidReturn={paid === "1"}
      />
    </main>
  );
}
