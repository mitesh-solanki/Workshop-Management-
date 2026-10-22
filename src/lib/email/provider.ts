import "server-only";

import { getEmailEnv } from "@/lib/email/env";
import { ResendProvider } from "@/lib/email/resend-provider";
import type { EmailProvider } from "@/lib/email/types";

let providerOverride: EmailProvider | null = null;
let cachedProvider: EmailProvider | null = null;

/** Resend for development and production. Tests inject a fake via setEmailProviderForTests. */
export function getEmailProvider(): EmailProvider {
  if (providerOverride) return providerOverride;
  if (cachedProvider) return cachedProvider;

  const env = getEmailEnv();
  cachedProvider = new ResendProvider(env.RESEND_API_KEY, env.EMAIL_FROM);
  return cachedProvider;
}

export function setEmailProviderForTests(provider: EmailProvider | null) {
  providerOverride = provider;
  if (provider === null) {
    cachedProvider = null;
  }
}
