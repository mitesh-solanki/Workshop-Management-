import "server-only";

import { z } from "zod";

/**
 * Resend is used for both development and production.
 * Fail clearly when the API key or from-address is missing.
 */
const emailEnvSchema = z.object({
  RESEND_API_KEY: z
    .string()
    .min(1, "RESEND_API_KEY is required (Resend is used in development and production)"),
  EMAIL_FROM: z
    .string()
    .min(1, "EMAIL_FROM is required (e.g. Workshop <noreply@yourdomain.com>)"),
  APP_URL: z.string().url("APP_URL must be a valid URL"),
});

export type EmailEnv = z.infer<typeof emailEnvSchema>;

let cached: EmailEnv | null = null;

function resolveAppUrl() {
  return (
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000"
  );
}

/** Validate Resend env. Skipped only in Vitest (`NODE_ENV=test`) when a fake provider is injected. */
export function getEmailEnv(): EmailEnv {
  if (cached) return cached;

  const parsed = emailEnvSchema.safeParse({
    RESEND_API_KEY: process.env.RESEND_API_KEY?.trim(),
    EMAIL_FROM: process.env.EMAIL_FROM?.trim(),
    APP_URL: resolveAppUrl(),
  });

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid email configuration: ${details}`);
  }

  cached = parsed.data;
  return cached;
}

export function getAppUrl() {
  try {
    return getEmailEnv().APP_URL;
  } catch {
    return resolveAppUrl();
  }
}

/** Test helper — clear cached env between cases. */
export function resetEmailEnvCache() {
  cached = null;
}
