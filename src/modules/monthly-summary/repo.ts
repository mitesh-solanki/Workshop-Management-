import "server-only";

import { prisma } from "@/lib/db";
import { toPaise, type Paise } from "@/lib/money";

export type MonthlyPeriodTotals = {
  moneyInPaise: Paise;
  moneyOutPaise: Paise;
  cashPaise: Paise;
  upiPaise: Paise;
  cardPaise: Paise;
  invoiceCollectionsPaise: Paise;
  expensesPaise: Paise;
  payrollPaise: Paise;
  vendorBillsPaise: Paise;
  outsideWorkPaise: Paise;
  partsPurchasesPaise: Paise;
  customers: number;
  vehicles: number;
  jobCards: number;
  partsIn: number;
  partsUsed: number;
  outsideWork: number;
};

function paymentSplit(payment: {
  method: string;
  amountPaise: number;
  cashPaise: number;
  upiPaise: number;
  cardPaise: number;
}): { cash: Paise; upi: Paise; card: Paise } {
  const cash = toPaise(payment.cashPaise);
  const upi = toPaise(payment.upiPaise);
  const card = toPaise(payment.cardPaise);
  if (cash + upi + card > 0) {
    return { cash, upi, card };
  }
  const amount = toPaise(payment.amountPaise);
  if (payment.method === "UPI") return { cash: 0 as Paise, upi: amount, card: 0 as Paise };
  if (payment.method === "CARD") return { cash: 0 as Paise, upi: 0 as Paise, card: amount };
  return { cash: amount, upi: 0 as Paise, card: 0 as Paise };
}

export async function findGarageName(garageId: string) {
  return prisma.garage.findFirst({
    where: { id: garageId },
    select: { id: true, name: true },
  });
}

/** Aggregate cash-in / cash-out and activity for [start, end). */
export async function loadPeriodTotals(
  garageId: string,
  start: Date,
  end: Date,
): Promise<MonthlyPeriodTotals> {
  const [
    payments,
    expenses,
    payroll,
    vendorPayments,
    outsideLines,
    customers,
    vehicles,
    jobCards,
    stockIn,
    stockOut,
  ] = await Promise.all([
    prisma.payment.findMany({
      where: {
        garageId,
        status: "PAID",
        receivedAt: { gte: start, lt: end },
      },
      select: {
        amountPaise: true,
        isRefund: true,
        method: true,
        cashPaise: true,
        upiPaise: true,
        cardPaise: true,
      },
    }),
    prisma.expense.aggregate({
      where: {
        garageId,
        status: "PAID",
        spentAt: { gte: start, lt: end },
      },
      _sum: { amountPaise: true },
    }),
    prisma.payrollLine.aggregate({
      where: {
        garageId,
        status: "PAID",
        paidAt: { gte: start, lt: end },
      },
      _sum: { netPaise: true },
    }),
    prisma.vendorBillPayment.aggregate({
      where: {
        garageId,
        paidAt: { gte: start, lt: end },
      },
      _sum: { amountPaise: true },
    }),
    prisma.serviceOrderLine.findMany({
      where: {
        garageId,
        type: "OUTSIDE",
        createdAt: { gte: start, lt: end },
      },
      select: { quantity: true, unitPricePaise: true },
    }),
    prisma.customer.count({
      where: { garageId, createdAt: { gte: start, lt: end } },
    }),
    prisma.vehicle.count({
      where: { garageId, createdAt: { gte: start, lt: end } },
    }),
    prisma.serviceOrder.count({
      where: {
        garageId,
        status: "COMPLETED",
        updatedAt: { gte: start, lt: end },
      },
    }),
    prisma.stockMovement.aggregate({
      where: {
        garageId,
        type: "IN",
        createdAt: { gte: start, lt: end },
      },
      _sum: { quantityChange: true },
    }),
    prisma.stockMovement.aggregate({
      where: {
        garageId,
        type: "OUT",
        createdAt: { gte: start, lt: end },
      },
      _sum: { quantityChange: true },
    }),
  ]);

  let moneyIn = 0;
  let cash = 0;
  let upi = 0;
  let card = 0;
  let refunds = 0;

  for (const payment of payments) {
    if (payment.isRefund) {
      refunds += toPaise(payment.amountPaise);
      continue;
    }
    const amount = toPaise(payment.amountPaise);
    moneyIn += amount;
    const split = paymentSplit(payment);
    cash += split.cash;
    upi += split.upi;
    card += split.card;
  }

  const expensesPaise = toPaise(expenses._sum.amountPaise ?? 0);
  const payrollPaise = toPaise(payroll._sum.netPaise ?? 0);
  const vendorBillsPaise = toPaise(vendorPayments._sum.amountPaise ?? 0);
  const outsideWorkPaise = outsideLines.reduce(
    (sum, line) =>
      sum + toPaise(line.unitPricePaise) * Math.max(1, line.quantity),
    0,
  ) as Paise;

  const moneyOut = (expensesPaise +
    payrollPaise +
    vendorBillsPaise +
    outsideWorkPaise +
    refunds) as Paise;

  return {
    moneyInPaise: moneyIn as Paise,
    moneyOutPaise: moneyOut,
    cashPaise: cash as Paise,
    upiPaise: upi as Paise,
    cardPaise: card as Paise,
    invoiceCollectionsPaise: moneyIn as Paise,
    expensesPaise,
    payrollPaise,
    vendorBillsPaise,
    outsideWorkPaise,
    partsPurchasesPaise: 0 as Paise,
    customers,
    vehicles,
    jobCards,
    partsIn: Math.abs(stockIn._sum.quantityChange ?? 0),
    partsUsed: Math.abs(stockOut._sum.quantityChange ?? 0),
    outsideWork: outsideLines.length,
  };
}
