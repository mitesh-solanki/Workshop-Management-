import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "@/lib/errors";

const RAZORPAY_API = "https://api.razorpay.com/v1";

export type RazorpayPaymentLink = {
  id: string;
  short_url: string;
  amount: number;
  currency: string;
  status: string;
};

export function isRazorpayConfigured() {
  return Boolean(
    process.env.RAZORPAY_KEY_ID?.trim() &&
      process.env.RAZORPAY_KEY_SECRET?.trim(),
  );
}

function getCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) {
    throw new AppError("payments.razorpay_not_configured", 503);
  }
  return { keyId, keySecret };
}

export function getRazorpayWebhookSecret() {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new AppError("payments.razorpay_not_configured", 503);
  }
  return secret;
}

function basicAuthHeader(keyId: string, keySecret: string) {
  const token = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  return `Basic ${token}`;
}

export async function createRazorpayPaymentLink(input: {
  amountPaise: number;
  description: string;
  referenceId: string;
  callbackUrl: string;
  notes: Record<string, string>;
}): Promise<RazorpayPaymentLink> {
  const { keyId, keySecret } = getCredentials();

  const res = await fetch(`${RAZORPAY_API}/payment_links`, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(keyId, keySecret),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: "INR",
      accept_partial: false,
      description: input.description.slice(0, 2048),
      reference_id: input.referenceId.slice(0, 40),
      callback_url: input.callbackUrl,
      callback_method: "get",
      notify: { sms: false, email: false },
      reminder_enable: false,
      notes: input.notes,
      options: {
        checkout: {
          method: {
            upi: true,
            card: false,
            netbanking: false,
            wallet: false,
            emi: false,
          },
        },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("razorpay.payment_link_failed", res.status, body);
    throw new AppError("payments.provider_failed", 502);
  }

  const data = (await res.json()) as RazorpayPaymentLink;
  if (!data.id || !data.short_url) {
    throw new AppError("payments.provider_failed", 502);
  }
  return data;
}

/** Verify Razorpay webhook signature (HMAC SHA256 of raw body). */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  if (!signatureHeader) return false;
  const secret = getRazorpayWebhookSecret();
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signatureHeader, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
