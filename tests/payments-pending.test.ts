import { beforeEach, describe, expect, it, vi } from "vitest";

const paymentCreate = vi.fn();
const auditCreate = vi.fn();
const tx = {
  payment: { create: paymentCreate },
  auditLog: { create: auditCreate },
};

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
  },
}));

import { createPendingUpiPayment } from "@/modules/payments/repo";
import { paymentStatusBadgeVariant } from "@/modules/payments/status";

describe("createPendingUpiPayment audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    paymentCreate.mockResolvedValue({
      id: "pay-pending-1",
      garageId: "garage-a",
      invoiceId: "inv-1",
      method: "UPI",
      amountPaise: 12_500,
      isRefund: false,
      cashPaise: 0,
      upiPaise: 12_500,
      cardPaise: 0,
      note: "Razorpay UPI",
      status: "PENDING",
      provider: "RAZORPAY",
      providerPaymentId: null,
      providerOrderId: null,
      providerPaymentLinkId: "plink_1",
      paymentLinkUrl: "https://rzp.io/i/x",
      qrImageDataUrl: "data:image/png;base64,xx",
      receivedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    auditCreate.mockResolvedValue({ id: "audit-1" });
  });

  it("writes an audit row when creating a pending UPI payment", async () => {
    const payment = await createPendingUpiPayment("garage-a", {
      invoiceId: "inv-1",
      amountPaise: 12_500,
      providerPaymentLinkId: "plink_1",
      paymentLinkUrl: "https://rzp.io/i/x",
      qrImageDataUrl: "data:image/png;base64,xx",
      note: "Razorpay UPI",
      actorId: "owner-1",
    });

    expect(payment.id).toBe("pay-pending-1");
    expect(payment.status).toBe("PENDING");
    expect(auditCreate).toHaveBeenCalledWith({
      data: {
        garageId: "garage-a",
        actorId: "owner-1",
        action: "payments.upi_pending_created",
        entity: "Payment",
        entityId: "pay-pending-1",
        meta: {
          invoiceId: "inv-1",
          amountPaise: 12_500,
          providerPaymentLinkId: "plink_1",
        },
      },
    });
  });
});

describe("paymentStatusBadgeVariant", () => {
  it("maps PENDING UPI to warning so staff can tell it from paid", () => {
    expect(paymentStatusBadgeVariant("PENDING")).toBe("warning");
    expect(paymentStatusBadgeVariant("PAID")).toBe("success");
    expect(paymentStatusBadgeVariant("FAILED")).toBe("danger");
  });
});
