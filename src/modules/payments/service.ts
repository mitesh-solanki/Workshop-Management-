import "server-only";

import { getTranslations } from "next-intl/server";
import { AppError, NotFoundError } from "@/lib/errors";
import { getAppUrl } from "@/lib/email/env";
import { paymentLinkQrDataUrl } from "@/lib/qr";
import {
  createRazorpayPaymentLink,
  isRazorpayConfigured,
  verifyRazorpayWebhookSignature,
} from "@/lib/razorpay";
import { requireRole, type RoleSession } from "@/lib/rbac";
import { pendingBalancePaise, sumCreditNotesPaise } from "@/modules/billing/balance";
import {
  createPendingUpiPayment,
  findActivePendingUpiForInvoice,
  findPendingByPaymentLinkId,
  findPaymentByProviderPaymentId,
  loadInvoiceForUpi,
  markRazorpayPaymentPaidOnce,
} from "@/modules/payments/repo";
import {
  razorpayWebhookPayloadSchema,
  startUpiPaymentSchema,
  type StartUpiPaymentInput,
} from "@/modules/payments/schema";

const WRITE_ROLES = ["OWNER", "MANAGER", "ACCOUNTANT"] as const;

function appBaseUrl() {
  return getAppUrl().replace(/\/$/, "");
}

async function createUpiPaymentSession(input: {
  garageId: string;
  invoiceId: string;
  amountPaise?: number;
  liveToken?: string;
  actorId?: string | null;
}) {
  const invoice = await loadInvoiceForUpi(input.garageId, input.invoiceId);
  if (!invoice) {
    throw new NotFoundError();
  }
  if (invoice.status !== "FINALIZED") {
    throw new AppError("billing.payment_requires_finalized");
  }

  const creditTotal = sumCreditNotesPaise(invoice.creditNotes);
  const pending = pendingBalancePaise({
    totalPaise: invoice.totalPaise,
    amountPaidPaise: invoice.amountPaidPaise,
    creditNotesTotalPaise: creditTotal,
  });
  if (pending <= 0) {
    throw new AppError("payments.nothing_due");
  }

  const amountPaise = input.amountPaise ?? pending;
  if (amountPaise > pending) {
    throw new AppError("billing.payment_exceeds_balance", 400, {
      pending: String(pending),
    });
  }

  const existing = await findActivePendingUpiForInvoice(
    input.garageId,
    invoice.id,
  );
  if (
    existing &&
    existing.amountPaise === amountPaise &&
    existing.paymentLinkUrl &&
    existing.qrImageDataUrl
  ) {
    return existing;
  }

  const callbackPath = input.liveToken
    ? `/live/${input.liveToken}?paid=1`
    : `/orders/${invoice.serviceOrderId}?section=billing&paid=1`;

  const tPay = await getTranslations("payments");
  const description = invoice.invoiceNumber
    ? tPay("linkDescription", { number: invoice.invoiceNumber })
    : tPay("linkDescriptionFallback");
  const callbackUrl = `${appBaseUrl()}${callbackPath}`;

  if (!isRazorpayConfigured()) {
    throw new AppError("payments.razorpay_not_configured", 503);
  }

  // Razorpay requires a unique reference_id per payment link.
  const referenceId = `${invoice.id.slice(0, 24)}_${Date.now()}`
    .replace(/[^a-zA-Z0-9_]/g, "")
    .slice(0, 40);

  const link = await createRazorpayPaymentLink({
    amountPaise,
    description,
    referenceId,
    callbackUrl,
    notes: {
      garageId: input.garageId,
      invoiceId: invoice.id,
      serviceOrderId: invoice.serviceOrderId,
    },
  });

  const qrImageDataUrl = await paymentLinkQrDataUrl(link.short_url);

  return createPendingUpiPayment(input.garageId, {
    invoiceId: invoice.id,
    amountPaise,
    providerPaymentLinkId: link.id,
    paymentLinkUrl: link.short_url,
    qrImageDataUrl,
    note: tPay("providerNote"),
    actorId: input.actorId ?? null,
  });
}

/** Staff: create Razorpay payment link + QR for invoice balance. */
export async function startUpiPaymentForInvoice(
  session: RoleSession,
  raw: StartUpiPaymentInput,
) {
  requireRole(session, WRITE_ROLES);
  const input = startUpiPaymentSchema.parse(raw);
  return createUpiPaymentSession({
    garageId: session.garageId,
    invoiceId: input.invoiceId,
    amountPaise: input.amountPaise,
    actorId: session.userId,
  });
}

/** Public live-link pay: garage comes from the verified live link. */
export async function startUpiPaymentForLiveLink(input: {
  garageId: string;
  invoiceId: string;
  liveToken: string;
  amountPaise?: number;
}) {
  return createUpiPaymentSession({
    garageId: input.garageId,
    invoiceId: input.invoiceId,
    amountPaise: input.amountPaise,
    liveToken: input.liveToken,
  });
}

export async function reconcileRazorpayWebhook(input: {
  rawBody: string;
  signature: string | null;
}) {
  if (!verifyRazorpayWebhookSignature(input.rawBody, input.signature)) {
    throw new AppError("payments.invalid_webhook_signature", 401);
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(input.rawBody);
  } catch {
    throw new AppError("payments.invalid_webhook_body", 400);
  }

  const parsed = razorpayWebhookPayloadSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return { handled: false as const, reason: "unrecognized_payload" as const };
  }

  const { event, payload } = parsed.data;
  const paidEvents = new Set([
    "payment_link.paid",
    "payment.captured",
  ]);
  if (!paidEvents.has(event)) {
    return { handled: false as const, reason: "ignored_event" as const };
  }

  const paymentLinkId = payload.payment_link?.entity?.id;
  const providerPaymentId = payload.payment?.entity?.id;
  const amountPaid =
    payload.payment_link?.entity?.amount_paid ??
    payload.payment?.entity?.amount;

  if (!providerPaymentId) {
    return { handled: false as const, reason: "missing_payment_id" as const };
  }

  const already = await findPaymentByProviderPaymentId(providerPaymentId);
  if (already?.status === "PAID") {
    return { handled: true as const, applied: false as const, reason: "idempotent" as const };
  }

  let pending = paymentLinkId
    ? await findPendingByPaymentLinkId(paymentLinkId)
    : null;

  if (!pending) {
    const notes = payload.payment_link?.entity?.notes ?? payload.payment?.entity?.notes;
    const invoiceId = notes?.invoiceId;
    if (invoiceId && notes?.garageId) {
      pending = await findActivePendingUpiForInvoice(notes.garageId, invoiceId);
    }
  }

  if (!pending) {
    return { handled: false as const, reason: "pending_not_found" as const };
  }

  const amountPaise = amountPaid ?? pending.amountPaise;
  const result = await markRazorpayPaymentPaidOnce({
    paymentId: pending.id,
    garageId: pending.garageId,
    invoiceId: pending.invoiceId,
    providerPaymentId,
    amountPaise,
  });

  return {
    handled: true as const,
    applied: result.applied,
    reason: result.applied ? ("paid" as const) : result.reason,
  };
}
