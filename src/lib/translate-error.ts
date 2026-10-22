import "server-only";

import { getTranslations } from "next-intl/server";
import { ZodError, type ZodIssue } from "zod";
import { AppError, type ErrorParams } from "@/lib/errors";

/**
 * Maps AppError.code → [namespace, messageKey] for next-intl.
 * Codes are stable (e.g. "auth.invalid_otp"); UI never shows Error.message.
 */
const APP_ERROR_MESSAGE_KEYS: Record<string, readonly [string, string]> = {
  "auth.email_in_use": ["auth", "errors.emailInUse"],
  "auth.invalid_otp": ["auth", "errors.invalidOtp"],
  "auth.signup_incomplete": ["auth", "errors.signupIncomplete"],
  "auth.invalid_invite": ["auth", "errors.invalidInvite"],
  "auth.user_not_found": ["auth", "errors.userNotFound"],
  "auth.rate_limited": ["auth", "errors.rateLimited"],
  "auth.email_send_failed": ["auth", "errors.emailSendFailed"],
  "team.email_in_use": ["team", "errors.emailInUse"],
  "team.not_found": ["team", "errors.notFound"],
  "team.cannot_change_self": ["team", "errors.cannotChangeSelf"],
  "team.cannot_change_owner": ["team", "errors.cannotChangeOwner"],
  "team.cannot_remove_self": ["team", "errors.cannotRemoveSelf"],
  "team.cannot_remove_owner": ["team", "errors.cannotRemoveOwner"],
  "team.email_send_failed": ["team", "errors.emailSendFailed"],
  "team.invite_expired": ["team", "errors.inviteExpired"],
  "inventory.insufficient_stock": ["inventory", "errors.insufficientStock"],
  "inventory.sku_exists": ["inventory", "errors.skuExists"],
  "inventory.part_required": ["inventory", "errors.partRequired"],
  "errors.forbidden": ["common", "forbidden"],
  "errors.unauthorized": ["common", "unauthorized"],
  "errors.not_found": ["common", "notFound"],
};

/** Zod issue.message values that are i18n keys under the `errors` namespace. */
const ZOD_MESSAGE_KEY = /^validation\.[a-zA-Z0-9_.]+$/;

function isI18nZodMessage(message: string): boolean {
  return ZOD_MESSAGE_KEY.test(message);
}

async function translateAppErrorCode(
  code: string,
  params?: ErrorParams,
): Promise<string | null> {
  const mapping = APP_ERROR_MESSAGE_KEYS[code];
  if (!mapping) return null;
  const [namespace, key] = mapping;
  const t = await getTranslations(namespace);
  return t(key, params as Record<string, string | number | Date> | undefined);
}

async function translateZodIssue(issue: ZodIssue): Promise<string> {
  const t = await getTranslations("errors");

  if (isI18nZodMessage(issue.message)) {
    return t(issue.message);
  }

  if (issue.code === "invalid_format" && "format" in issue && issue.format === "email") {
    return t("validation.invalidEmail");
  }
  if (issue.code === "too_small") {
    return t("validation.tooShort");
  }
  if (issue.code === "too_big") {
    return t("validation.tooLong");
  }
  if (issue.code === "invalid_type") {
    return t("validation.required");
  }

  return t("validation.invalidInput");
}

/** User-facing message for any thrown value (AppError, ZodError, or unknown). */
export async function translateError(error: unknown): Promise<string> {
  const common = await getTranslations("common");

  if (error instanceof AppError) {
    const translated = await translateAppErrorCode(error.code, error.params);
    return translated ?? common("error");
  }

  if (error instanceof ZodError && error.issues.length > 0) {
    return translateZodIssue(error.issues[0]!);
  }

  return common("error");
}
