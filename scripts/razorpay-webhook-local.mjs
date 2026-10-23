/**
 * Local Razorpay webhook helper — no ngrok / tunnel needed.
 *
 * Usage (app must be running on localhost:3000):
 *   npm run razorpay:webhook-local
 *   npm run razorpay:webhook-local -- --plink plink_xxxxx
 *
 * Loads RAZORPAY_WEBHOOK_SECRET + DATABASE_URL from .env.
 * Finds the latest PENDING Razorpay UPI payment (or --plink) and POSTs a
 * signed payment_link.paid event to http://localhost:3000/api/webhooks/razorpay
 */
import { createHmac, randomBytes } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

function loadEnv() {
  const path = resolve(process.cwd(), ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = val;
  }
}

function argValue(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

loadEnv();

// Always prefer plain localhost for this helper (avoids ngrok/Norton TLS issues).
const baseUrl = (
  process.env.WEBHOOK_LOCAL_URL ||
  "http://localhost:3000"
).replace(/\/$/, "");
const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
const plinkArg = argValue("--plink");

if (!secret) {
  console.error(
    "Missing RAZORPAY_WEBHOOK_SECRET in .env — set any long random string for local (same value Razorpay would use).",
  );
  process.exit(1);
}

if (!process.env.DATABASE_URL?.trim()) {
  console.error("Missing DATABASE_URL in .env");
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const pending = plinkArg
    ? await prisma.payment.findFirst({
        where: {
          provider: "RAZORPAY",
          providerPaymentLinkId: plinkArg,
          status: "PENDING",
          isRefund: false,
        },
        orderBy: { createdAt: "desc" },
      })
    : await prisma.payment.findFirst({
        where: {
          provider: "RAZORPAY",
          status: "PENDING",
          isRefund: false,
          providerPaymentLinkId: { not: null },
        },
        orderBy: { createdAt: "desc" },
      });

  if (!pending?.providerPaymentLinkId) {
    console.error(
      "No PENDING Razorpay UPI payment found. Generate a UPI QR/link in the app first, then re-run.",
    );
    process.exit(1);
  }

  const providerPaymentId = `pay_local_${randomBytes(8).toString("hex")}`;
  const payload = {
    event: "payment_link.paid",
    payload: {
      payment_link: {
        entity: {
          id: pending.providerPaymentLinkId,
          amount_paid: pending.amountPaise,
          notes: {
            invoiceId: pending.invoiceId,
            garageId: pending.garageId,
          },
        },
      },
      payment: {
        entity: {
          id: providerPaymentId,
          amount: pending.amountPaise,
          status: "captured",
        },
      },
    },
  };

  const rawBody = JSON.stringify(payload);
  const signature = createHmac("sha256", secret).update(rawBody).digest("hex");
  const url = `${baseUrl}/api/webhooks/razorpay`;

  console.log("Posting local webhook →", url);
  console.log("  paymentLinkId:", pending.providerPaymentLinkId);
  console.log("  invoiceId:", pending.invoiceId);
  console.log("  amountPaise:", pending.amountPaise);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-razorpay-signature": signature,
    },
    body: rawBody,
  });
  const text = await res.text();
  console.log("Response", res.status, text);

  if (!res.ok) {
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
