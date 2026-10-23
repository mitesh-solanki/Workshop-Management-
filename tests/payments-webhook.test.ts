import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

vi.mock("@/lib/razorpay", () => ({
  verifyRazorpayWebhookSignature: vi.fn(),
  createRazorpayPaymentLink: vi.fn(),
  getRazorpayWebhookSecret: vi.fn(() => "whsec_test"),
}));

vi.mock("@/modules/payments/repo", () => ({
  findPaymentByProviderPaymentId: vi.fn(),
  findPendingByPaymentLinkId: vi.fn(),
  findActivePendingUpiForInvoice: vi.fn(),
  markRazorpayPaymentPaidOnce: vi.fn(),
  createPendingUpiPayment: vi.fn(),
  loadInvoiceForUpi: vi.fn(),
}));

import { verifyRazorpayWebhookSignature } from "@/lib/razorpay";
import {
  findPaymentByProviderPaymentId,
  findPendingByPaymentLinkId,
  markRazorpayPaymentPaidOnce,
} from "@/modules/payments/repo";
import { reconcileRazorpayWebhook } from "@/modules/payments/service";

function signedBody(payload: unknown) {
  const rawBody = JSON.stringify(payload);
  const signature = createHmac("sha256", "whsec_test")
    .update(rawBody)
    .digest("hex");
  return { rawBody, signature };
}

const pendingPayment = {
  id: "pay-row-1",
  garageId: "garage-a",
  invoiceId: "inv-1",
  method: "UPI" as const,
  amountPaise: 50_000,
  isRefund: false,
  cashPaise: 0,
  upiPaise: 50_000,
  cardPaise: 0,
  note: null,
  status: "PENDING" as const,
  provider: "RAZORPAY" as const,
  providerPaymentId: null,
  providerOrderId: null,
  providerPaymentLinkId: "plink_abc",
  paymentLinkUrl: "https://rzp.io/i/test",
  qrImageDataUrl: "data:image/png;base64,xx",
  receivedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("Razorpay webhook reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyRazorpayWebhookSignature).mockReturnValue(true);
  });

  it("rejects invalid signatures", async () => {
    vi.mocked(verifyRazorpayWebhookSignature).mockReturnValue(false);
    await expect(
      reconcileRazorpayWebhook({
        rawBody: "{}",
        signature: "bad",
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("marks a pending payment paid exactly once", async () => {
    vi.mocked(findPaymentByProviderPaymentId).mockResolvedValue(null);
    vi.mocked(findPendingByPaymentLinkId).mockResolvedValue(pendingPayment);
    vi.mocked(markRazorpayPaymentPaidOnce).mockResolvedValue({
      applied: true,
    });

    const { rawBody, signature } = signedBody({
      event: "payment_link.paid",
      payload: {
        payment_link: {
          entity: {
            id: "plink_abc",
            amount_paid: 50_000,
            notes: { invoiceId: "inv-1", garageId: "garage-a" },
          },
        },
        payment: {
          entity: {
            id: "pay_razor_1",
            amount: 50_000,
            status: "captured",
          },
        },
      },
    });

    const first = await reconcileRazorpayWebhook({ rawBody, signature });
    expect(first).toEqual({
      handled: true,
      applied: true,
      reason: "paid",
    });
    expect(markRazorpayPaymentPaidOnce).toHaveBeenCalledWith({
      paymentId: "pay-row-1",
      garageId: "garage-a",
      invoiceId: "inv-1",
      providerPaymentId: "pay_razor_1",
      amountPaise: 50_000,
    });
  });

  it("is idempotent when the provider payment was already recorded", async () => {
    vi.mocked(findPaymentByProviderPaymentId).mockResolvedValue({
      ...pendingPayment,
      status: "PAID",
      providerPaymentId: "pay_razor_1",
    });

    const { rawBody, signature } = signedBody({
      event: "payment_link.paid",
      payload: {
        payment_link: { entity: { id: "plink_abc", amount_paid: 50_000 } },
        payment: { entity: { id: "pay_razor_1", amount: 50_000 } },
      },
    });

    const result = await reconcileRazorpayWebhook({ rawBody, signature });
    expect(result).toEqual({
      handled: true,
      applied: false,
      reason: "idempotent",
    });
    expect(markRazorpayPaymentPaidOnce).not.toHaveBeenCalled();
  });

  it("does not double-apply when mark returns already recorded", async () => {
    vi.mocked(findPaymentByProviderPaymentId).mockResolvedValue(null);
    vi.mocked(findPendingByPaymentLinkId).mockResolvedValue(pendingPayment);
    vi.mocked(markRazorpayPaymentPaidOnce).mockResolvedValue({
      applied: false,
      reason: "already_recorded",
    });

    const { rawBody, signature } = signedBody({
      event: "payment.captured",
      payload: {
        payment_link: { entity: { id: "plink_abc", amount_paid: 50_000 } },
        payment: { entity: { id: "pay_razor_1", amount: 50_000 } },
      },
    });

    const result = await reconcileRazorpayWebhook({ rawBody, signature });
    expect(result.handled).toBe(true);
    expect(result).toMatchObject({ applied: false, reason: "already_recorded" });
  });
});

describe("markRazorpayPaymentPaidOnce contract", () => {
  it("repo helper is called with unique provider payment id", async () => {
    vi.mocked(verifyRazorpayWebhookSignature).mockReturnValue(true);
    vi.mocked(findPaymentByProviderPaymentId).mockResolvedValue(null);
    vi.mocked(findPendingByPaymentLinkId).mockResolvedValue(pendingPayment);
    vi.mocked(markRazorpayPaymentPaidOnce)
      .mockResolvedValueOnce({ applied: true })
      .mockResolvedValueOnce({ applied: false, reason: "duplicate_provider_id" });

    const payload = {
      event: "payment_link.paid",
      payload: {
        payment_link: { entity: { id: "plink_abc", amount_paid: 50_000 } },
        payment: { entity: { id: "pay_same", amount: 50_000 } },
      },
    };
    const first = signedBody(payload);
    const second = signedBody(payload);

    const a = await reconcileRazorpayWebhook(first);
    expect(a).toMatchObject({ applied: true });

    vi.mocked(findPaymentByProviderPaymentId).mockResolvedValue({
      ...pendingPayment,
      status: "PAID",
      providerPaymentId: "pay_same",
    });

    const b = await reconcileRazorpayWebhook(second);
    expect(b).toMatchObject({ applied: false, reason: "idempotent" });
  });
});
