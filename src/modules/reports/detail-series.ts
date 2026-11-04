import type {
  DetailChartPoint,
  DetailReportCardView,
  DetailReportPayload,
} from "@/modules/reports/detail-types";

function topByValue(
  points: DetailChartPoint[],
  take = 8,
): DetailChartPoint[] {
  return [...points]
    .sort((a, b) => b.amountPaise - a.amountPaise)
    .slice(0, take);
}

export function toDetailReportCardView(
  payload: DetailReportPayload,
): DetailReportCardView {
  if (payload.key === "parts_stock") {
    const series = topByValue(
      payload.rows.map((row) => ({
        key: row.id,
        label: row.name,
        amountPaise: Math.max(0, row.quantityOnHand) * row.sellingPricePaise,
        href: `/inventory/${row.id}`,
      })),
    );
    const heroValue = payload.rows.reduce(
      (sum, row) =>
        sum + Math.max(0, row.quantityOnHand) * row.sellingPricePaise,
      0,
    );
    return {
      key: payload.key,
      period: payload.period,
      from: payload.from,
      to: payload.to,
      count: payload.rows.length,
      heroKind: "money",
      heroValue,
      chartFormat: "money",
      series,
      garage: payload.garage,
      payload,
    };
  }

  if (payload.key === "stock_movements") {
    const byPart = new Map<
      string,
      { name: string; partId: string; qty: number }
    >();
    for (const row of payload.rows) {
      const existing = byPart.get(row.partId);
      const qty = Math.abs(row.quantityChange);
      byPart.set(row.partId, {
        name: row.partName,
        partId: row.partId,
        qty: (existing?.qty ?? 0) + qty,
      });
    }
    const series = topByValue(
      [...byPart.values()].map((entry) => ({
        key: entry.partId,
        label: entry.name,
        amountPaise: entry.qty,
        href: `/inventory/${entry.partId}`,
      })),
    );
    return {
      key: payload.key,
      period: payload.period,
      from: payload.from,
      to: payload.to,
      count: payload.rows.length,
      heroKind: "number",
      heroValue: payload.rows.length,
      chartFormat: "number",
      series,
      garage: payload.garage,
      payload,
    };
  }

  if (payload.key === "invoice_tax") {
    const byCustomer = new Map<
      string,
      { name: string; totalPaise: number }
    >();
    for (const row of payload.rows) {
      const existing = byCustomer.get(row.customerId);
      byCustomer.set(row.customerId, {
        name: row.customerName,
        totalPaise: (existing?.totalPaise ?? 0) + row.totalPaise,
      });
    }
    const series = topByValue(
      [...byCustomer.entries()].map(([customerId, entry]) => ({
        key: customerId,
        label: entry.name,
        amountPaise: entry.totalPaise,
        href: `/customers/${customerId}`,
      })),
    );
    const heroValue = payload.rows.reduce(
      (sum, row) => sum + row.totalPaise,
      0,
    );
    return {
      key: payload.key,
      period: payload.period,
      from: payload.from,
      to: payload.to,
      count: payload.rows.length,
      heroKind: "money",
      heroValue,
      chartFormat: "money",
      series,
      garage: payload.garage,
      payload,
    };
  }

  const series = topByValue(
    payload.rows.map((row) => ({
      key: row.id,
      label: row.hsnOrSac,
      amountPaise: row.totalPaise,
    })),
  );
  const heroValue = payload.rows.reduce(
    (sum, row) => sum + row.totalPaise,
    0,
  );
  return {
    key: payload.key,
    period: payload.period,
    from: payload.from,
    to: payload.to,
    count: payload.rows.length,
    heroKind: "money",
    heroValue,
    chartFormat: "money",
    series,
    garage: payload.garage,
    payload,
  };
}
