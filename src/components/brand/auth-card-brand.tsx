import { AppLogo } from "@/components/brand/app-logo";
import { authCopy } from "@/lib/auth-copy";

/** Logo + Workspace name side by side on auth cards. */
export function AuthCardBrand() {
  return (
    <div className="mb-6 flex justify-center">
      <AppLogo
        size="lg"
        withWordmark
        wordmark={authCopy("brandName")}
        wordmarkClassName="text-lg font-semibold tracking-tight text-slate-900"
      />
    </div>
  );
}
