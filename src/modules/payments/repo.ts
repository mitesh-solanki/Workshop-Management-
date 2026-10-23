import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { pendingBalancePaise, sumCreditNotesPaise } from "@/modules/billing/balance";

export type DbClient = Prisma.TransactionClient | typeof prisma;

const paymentSelect = {
  id: true,
  garageId: true,
  invoiceId: true,
  method: true,
  amountPaise: true,
  isRefund: true,
  cashPaise: true,
  upiPaise: true,
  cardPaise: true,
  note: true,
  status: true,
  provider: true,
  providerPaymentId: true,
  providerOrderId: true,
  providerPaymentLinkId: true,
  paymentLinkUrl: true,
  qrImageDataUrl: true,
  receivedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function createPendingUpiPayment(
  garageId: string,
  data: {
    invoiceId: string;
    amountPaise: number;
    providerPaymentLinkId: string;
    paymentLinkUrl: string;
    qrImageDataUrl: string;
    note: string | null;
    actorId?: string | null;
  },
) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        garageId,
        invoiceId: data.invoiceId,
        method: "UPI",
        amountPaise: data.amountPaise,
        isRefund: false,
        cashPaise: 0,
        upiPaise: data.amountPaise,
        cardPaise: 0,
        note: data.note,
        status: "PENDING",
        provider: "RAZORPAY",
        providerPaymentLinkId: data.providerPaymentLinkId,
        paymentLinkUrl: data.paymentLinkUrl,
        qrImageDataUrl: data.qrImageDataUrl,
      },
      select: paymentSelect,
    });

    await tx.auditLog.create({
      data: {
        garageId,
        actorId: data.actorId ?? null,
        action: "payments.upi_pending_created",
        entity: "Payment",
        entityId: payment.id,
        meta: {
          invoiceId: data.invoiceId,
          amountPaise: data.amountPaise,
          providerPaymentLinkId: data.providerPaymentLinkId,
        } satisfies Prisma.InputJsonValue,
      },
    });

    return payment;
  });
}

export async function findPendingByPaymentLinkId(providerPaymentLinkId: string) {
  return prisma.payment.findFirst({
    where: {
      provider: "RAZORPAY",
      providerPaymentLinkId,
      status: "PENDING",
      isRefund: false,
    },
    select: paymentSelect,
  });
}

export async function findPaymentByProviderPaymentId(providerPaymentId: string) {
  return prisma.payment.findFirst({
    where: {
      provider: "RAZORPAY",
      providerPaymentId,
    },
    select: paymentSelect,
  });
}

export async function findActivePendingUpiForInvoice(
  garageId: string,
  invoiceId: string,
) {
  return prisma.payment.findFirst({
    where: {
      garageId,
      invoiceId,
      provider: "RAZORPAY",
      status: "PENDING",
      isRefund: false,
    },
    orderBy: { createdAt: "desc" },
    select: paymentSelect,
  });
}

/**
 * Mark a pending Razorpay payment as PAID exactly once and bump invoice paid.
 * Returns { applied: true } on first success, { applied: false } if already paid
 * or concurrent webhook lost the race.
 */
export async function markRazorpayPaymentPaidOnce(data: {
  paymentId: string;
  garageId: string;
  invoiceId: string;
  providerPaymentId: string;
  amountPaise: number;
}) {
  try {
    return await prisma.$transaction(async (tx) => {
      const existingByProvider = await tx.payment.findFirst({
        where: {
          provider: "RAZORPAY",
          providerPaymentId: data.providerPaymentId,
        },
        select: { id: true, status: true },
      });
      if (existingByProvider) {
        return { applied: false as const, reason: "already_recorded" as const };
      }

      const updated = await tx.payment.updateMany({
        where: {
          id: data.paymentId,
          garageId: data.garageId,
          status: "PENDING",
          provider: "RAZORPAY",
        },
        data: {
          status: "PAID",
          providerPaymentId: data.providerPaymentId,
          receivedAt: new Date(),
        },
      });
      if (updated.count === 0) {
        return { applied: false as const, reason: "not_pending" as const };
      }

      const invoice = await tx.invoice.findFirst({
        where: { id: data.invoiceId, garageId: data.garageId },
        select: {
          id: true,
          status: true,
          totalPaise: true,
          amountPaidPaise: true,
          creditNotes: { select: { totalPaise: true } },
        },
      });
      if (!invoice || invoice.status !== "FINALIZED") {
        throw new Error("invoice_not_finalized");
      }

      const creditTotal = sumCreditNotesPaise(invoice.creditNotes);
      const pending = pendingBalancePaise({
        totalPaise: invoice.totalPaise,
        amountPaidPaise: invoice.amountPaidPaise,
        creditNotesTotalPaise: creditTotal,
      });
      if (data.amountPaise > pending) {
        throw new Error("overpay");
      }

      await tx.invoice.updateMany({
        where: { id: data.invoiceId, garageId: data.garageId },
        data: {
          amountPaidPaise: invoice.amountPaidPaise + data.amountPaise,
        },
      });

      await tx.auditLog.create({
        data: {
          garageId: data.garageId,
          actorId: null,
          action: "payments.upi_webhook_paid",
          entity: "Payment",
          entityId: data.paymentId,
          meta: {
            invoiceId: data.invoiceId,
            providerPaymentId: data.providerPaymentId,
            amountPaise: data.amountPaise,
          } satisfies Prisma.InputJsonValue,
        },
      });

      return { applied: true as const };
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return { applied: false as const, reason: "duplicate_provider_id" as const };
    }
    throw error;
  }
}

export async function loadInvoiceForUpi(garageId: string, invoiceId: string) {
  return prisma.invoice.findFirst({
    where: { id: invoiceId, garageId },
    select: {
      id: true,
      garageId: true,
      serviceOrderId: true,
      status: true,
      invoiceNumber: true,
      totalPaise: true,
      amountPaidPaise: true,
      creditNotes: { select: { totalPaise: true } },
    },
  });
}
