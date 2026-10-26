import "server-only";

import { createTranslator } from "next-intl";
import { ZodError, type ZodIssue } from "zod";
import en from "../../messages/en.json";
import { AppError } from "@/lib/errors";

/**
 * English-only error messages for auth pages (login / signup / invite).
 * Keeps auth UI free of locale cookies / language switcher.
 */
const AUTH_ERROR_KEYS: Record<string, string> = {
  "auth.email_in_use": "errors.emailInUse",
  "auth.invalid_otp": "errors.invalidOtp",
  "auth.invalid_credentials": "errors.invalidCredentials",
  "auth.signup_incomplete": "errors.signupIncomplete",
  "auth.invalid_invite": "errors.invalidInvite",
  "auth.user_not_found": "errors.userNotFound",
  "auth.rate_limited": "errors.rateLimited",
  "auth.email_send_failed": "errors.emailSendFailed",
};

const tAuth = createTranslator({
  locale: "en",
  messages: en,
  namespace: "auth",
});
const tErrors = createTranslator({
  locale: "en",
  messages: en,
  namespace: "errors",
});
const tCommon = createTranslator({
  locale: "en",
  messages: en,
  namespace: "common",
});

const ZOD_MESSAGE_KEY = /^validation\.[a-zA-Z0-9_.]+$/;

type ErrorsKey = Parameters<typeof tErrors>[0];
type AuthKey = Parameters<typeof tAuth>[0];

function translateZodIssue(issue: ZodIssue): string {
  if (ZOD_MESSAGE_KEY.test(issue.message)) {
    return tErrors(issue.message as ErrorsKey);
  }
  if (
    issue.code === "invalid_format" &&
    "format" in issue &&
    issue.format === "email"
  ) {
    return tErrors("validation.invalidEmail");
  }
  if (issue.code === "too_small") {
    return tErrors("validation.tooShort");
  }
  if (issue.code === "too_big") {
    return tErrors("validation.tooLong");
  }
  if (issue.code === "invalid_type") {
    return tErrors("validation.required");
  }
  return tErrors("validation.invalidInput");
}

export function translateAuthError(error: unknown): string {
  if (error instanceof AppError) {
    const key = AUTH_ERROR_KEYS[error.code];
    if (key) {
      return tAuth(key as AuthKey);
    }
    return tCommon("error");
  }

  if (error instanceof ZodError && error.issues.length > 0) {
    return translateZodIssue(error.issues[0]!);
  }

  return tCommon("error");
}
