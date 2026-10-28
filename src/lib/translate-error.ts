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
  "vehicles.duplicate_registration": ["vehicles", "errors.duplicateRegistration"],
  "bays.name_exists": ["bays", "errors.nameExists"],
  CUSTOMER_HAS_ORDERS: ["customers", "cannotDeleteHasOrders"],
  VEHICLE_HAS_ORDERS: ["vehicles", "cannotDeleteHasOrders"],
  VENDOR_HAS_PURCHASES: ["vendors", "cannotDeleteHasPurchases"],
  INVALID_STATUS_TRANSITION: ["orders", "errors.invalidStatusTransition"],
  INVALID_TECHNICIAN: ["orders", "errors.invalidTechnician"],
  ORDER_COMPLETED: ["orders", "errors.orderCompleted"],
  STATUS_CONFLICT: ["orders", "errors.statusConflict"],
  "orders.line_approved_on_estimate": [
    "orders",
    "errors.lineApprovedOnEstimate",
  ],
  "inventory.insufficient_stock": ["inventory", "errors.insufficientStock"],
  "inventory.sku_exists": ["inventory", "errors.skuExists"],
  "inventory.part_required": ["inventory", "errors.partRequired"],
  "inventory.part_in_use": ["inventory", "cannotDeleteInUse"],
  "import.empty_file": ["dataImport", "errors.emptyFile"],
  "import.too_many_rows": ["dataImport", "errors.tooManyRows"],
  "import.file_too_large": ["dataImport", "errors.fileTooLarge"],
  "import.unsupported_type": ["dataImport", "errors.unsupportedType"],
  "import.mapping_incomplete": ["dataImport", "errors.mappingIncomplete"],
  "import.has_invalid_rows": ["dataImport", "errors.hasInvalidRows"],
  "import.no_valid_rows": ["dataImport", "errors.noValidRows"],
  "import.invalid_entity": ["dataImport", "errors.invalidEntity"],
  "import.invalid_mode": ["dataImport", "errors.invalidMode"],
  ESTIMATE_SUPERSEDED: ["estimates", "errors.estimateSuperseded"],
  ESTIMATE_LINE_BILLED: ["estimates", "errors.lineBilled"],
  "billing.garage_gstin_required": ["billing", "errors.garageGstinRequired"],
  "billing.estimate_missing": ["billing", "errors.estimateMissing"],
  "billing.estimate_superseded": ["billing", "errors.estimateSuperseded"],
  "billing.no_approved_lines": ["billing", "errors.noApprovedLines"],
  "billing.no_unbilled_approved_lines": [
    "billing",
    "errors.noUnbilledApprovedLines",
  ],
  "billing.invoice_create_failed": ["billing", "errors.invoiceCreateFailed"],
  "billing.invoice_already_finalized": ["billing", "errors.invoiceAlreadyFinalized"],
  "billing.invoice_finalize_failed": ["billing", "errors.invoiceFinalizeFailed"],
  "billing.invoice_immutable": ["billing", "errors.invoiceImmutable"],
  "billing.invoice_draft_outdated": ["billing", "errors.invoiceDraftOutdated"],
  "billing.payment_requires_finalized": ["billing", "errors.paymentRequiresFinalized"],
  "billing.payment_exceeds_balance": ["billing", "errors.paymentExceedsBalance"],
  "billing.payment_failed": ["billing", "errors.paymentFailed"],
  "billing.refund_exceeds_due": ["billing", "errors.refundExceedsDue"],
  "billing.refund_failed": ["billing", "errors.refundFailed"],
  "billing.credit_note_requires_finalized": [
    "billing",
    "errors.creditNoteRequiresFinalized",
  ],
  "billing.credit_note_exceeds_invoice": [
    "billing",
    "errors.creditNoteExceedsInvoice",
  ],
  "billing.credit_note_failed": ["billing", "errors.creditNoteFailed"],
  "payments.razorpay_not_configured": ["payments", "errors.razorpayNotConfigured"],
  "payments.provider_failed": ["payments", "errors.providerFailed"],
  "payments.nothing_due": ["payments", "errors.nothingDue"],
  "payments.invalid_webhook_signature": [
    "payments",
    "errors.invalidWebhookSignature",
  ],
  "payments.invalid_webhook_body": ["payments", "errors.invalidWebhookBody"],
  "purchases.part_not_found": ["purchases", "errors.partNotFound"],
  "purchases.order_line_not_found": ["purchases", "errors.orderLineNotFound"],
  "purchases.order_not_found": ["purchases", "errors.orderNotFound"],
  "purchases.request_not_found": ["purchases", "errors.requestNotFound"],
  "purchases.request_not_open": ["purchases", "errors.requestNotOpen"],
  "purchases.vendor_not_found": ["purchases", "errors.vendorNotFound"],
  "purchases.requests_not_open": ["purchases", "errors.requestsNotOpen"],
  "purchases.po_not_found": ["purchases", "errors.poNotFound"],
  "purchases.po_already_received": ["purchases", "errors.poAlreadyReceived"],
  "purchases.receive_qty_required": ["purchases", "errors.receiveQtyRequired"],
  "purchases.po_line_not_found": ["purchases", "errors.poLineNotFound"],
  "purchases.receive_exceeds_ordered": [
    "purchases",
    "errors.receiveExceedsOrdered",
  ],
  "purchases.stock_failed": ["purchases", "errors.stockFailed"],
  "purchases.bill_not_found": ["purchases", "errors.billNotFound"],
  "purchases.payment_exceeds_outstanding": [
    "purchases",
    "errors.paymentExceedsOutstanding",
  ],
  "purchases.return_credit_exceeds": [
    "purchases",
    "errors.returnCreditExceeds",
  ],
  "purchases.bill_attachment_type": [
    "purchases",
    "errors.billAttachmentType",
  ],
  "purchases.bill_attachment_too_large": [
    "purchases",
    "errors.billAttachmentTooLarge",
  ],
  STORAGE_NOT_CONFIGURED: ["vendorBills", "errors.storageNotConfigured"],
  "live.wrong_token": ["liveLink", "errors.wrong_token"],
  "live.expired": ["liveLink", "errors.expired"],
  "live.revoked": ["liveLink", "errors.revoked"],
  "live.rate_limited": ["liveLink", "errors.rate_limited"],
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

/** Per-field messages from a ZodError (first issue per path). */
export async function translateZodFieldErrors(
  error: ZodError,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (!key || out[key]) continue;
    out[key] = await translateZodIssue(issue);
  }
  return out;
}
