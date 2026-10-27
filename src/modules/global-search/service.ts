import "server-only";

import type { RoleSession } from "@/lib/rbac";
import {
  GLOBAL_SEARCH_MIN_CHARS,
  type GlobalSearchMatchField,
  type GlobalSearchResult,
} from "@/modules/global-search/schema";
import {
  searchCustomersForGlobal,
  searchInvoicesForGlobal,
  searchOrdersForGlobal,
  searchPartsForGlobal,
  searchVehiclesForGlobal,
  searchVendorsForGlobal,
} from "@/modules/global-search/repo";

function fieldMatches(
  value: string | null | undefined,
  query: string,
): boolean {
  if (!value) return false;
  return value.toLowerCase().includes(query.toLowerCase());
}

function registrationMatches(
  value: string | null | undefined,
  query: string,
): boolean {
  if (!value) return false;
  const needle = query.replace(/\s+/g, "").toUpperCase();
  return value.replace(/\s+/g, "").toUpperCase().includes(needle);
}

function firstMatch(
  fields: Array<{ key: GlobalSearchMatchField; value: string | null | undefined }>,
  query: string,
  fallback: GlobalSearchMatchField,
): GlobalSearchMatchField {
  for (const field of fields) {
    if (field.key === "registration") {
      if (registrationMatches(field.value, query)) return field.key;
      continue;
    }
    if (field.key === "phone") {
      if (field.value?.includes(query)) return field.key;
      continue;
    }
    if (fieldMatches(field.value, query)) return field.key;
  }
  return fallback;
}

export async function runGlobalSearch(
  session: RoleSession,
  qRaw: string,
): Promise<GlobalSearchResult[]> {
  const q = qRaw.trim();
  if (q.length < GLOBAL_SEARCH_MIN_CHARS) return [];

  const technicianScope =
    session.role === "TECHNICIAN" ? { technicianId: session.userId } : {};

  const [customers, vehicles, orders, parts, vendors, invoices] =
    await Promise.all([
      searchCustomersForGlobal(session.garageId, q),
      searchVehiclesForGlobal(session.garageId, q),
      searchOrdersForGlobal(session.garageId, q, technicianScope),
      searchPartsForGlobal(session.garageId, q),
      searchVendorsForGlobal(session.garageId, q),
      searchInvoicesForGlobal(session.garageId, q),
    ]);

  const results: GlobalSearchResult[] = [];

  for (const row of customers) {
    results.push({
      id: row.id,
      type: "customer",
      title: row.name,
      subtitle: row.phone,
      matchIn: firstMatch(
        [
          { key: "name", value: row.name },
          { key: "phone", value: row.phone },
        ],
        q,
        "name",
      ),
      href: `/customers/${row.id}`,
    });
  }

  for (const row of vehicles) {
    results.push({
      id: row.id,
      type: "vehicle",
      title: row.registrationNumber,
      subtitle: `${row.make} ${row.model} · ${row.customer.name}`,
      matchIn: firstMatch(
        [
          { key: "registration", value: row.registrationNumber },
          { key: "make", value: row.make },
          { key: "model", value: row.model },
          { key: "name", value: row.customer.name },
          { key: "phone", value: row.customer.phone },
        ],
        q,
        "registration",
      ),
      href: `/vehicles/${row.id}`,
    });
  }

  for (const row of orders) {
    results.push({
      id: row.id,
      type: "order",
      title: row.vehicle.registrationNumber,
      subtitle: `${row.customer.name} · ${row.complaint}`,
      matchIn: firstMatch(
        [
          { key: "registration", value: row.vehicle.registrationNumber },
          { key: "name", value: row.customer.name },
          { key: "phone", value: row.customer.phone },
          { key: "complaint", value: row.complaint },
          { key: "make", value: row.vehicle.make },
          { key: "model", value: row.vehicle.model },
        ],
        q,
        "complaint",
      ),
      href: `/orders/${row.id}`,
    });
  }

  for (const row of parts) {
    results.push({
      id: row.id,
      type: "part",
      title: row.name,
      subtitle: row.sku,
      matchIn: firstMatch(
        [
          { key: "name", value: row.name },
          { key: "sku", value: row.sku },
          { key: "hsn", value: row.hsn },
        ],
        q,
        "name",
      ),
      href: `/inventory/${row.id}`,
    });
  }

  for (const row of vendors) {
    results.push({
      id: row.id,
      type: "vendor",
      title: row.name,
      subtitle: row.phone ?? row.gstin ?? row.email ?? undefined,
      matchIn: firstMatch(
        [
          { key: "name", value: row.name },
          { key: "phone", value: row.phone },
          { key: "gstin", value: row.gstin },
          { key: "email", value: row.email },
        ],
        q,
        "name",
      ),
      href: `/vendors/${row.id}`,
    });
  }

  for (const row of invoices) {
    const number = row.invoiceNumber?.trim() || row.id;
    results.push({
      id: row.id,
      type: "invoice",
      title: number,
      subtitle: `${row.customer.name}${
        row.serviceOrder.vehicle.registrationNumber
          ? ` · ${row.serviceOrder.vehicle.registrationNumber}`
          : ""
      }`,
      matchIn: firstMatch(
        [
          { key: "invoiceNumber", value: row.invoiceNumber },
          { key: "name", value: row.customer.name },
          { key: "phone", value: row.customer.phone },
          {
            key: "registration",
            value: row.serviceOrder.vehicle.registrationNumber,
          },
        ],
        q,
        "invoiceNumber",
      ),
      href: `/orders/${row.serviceOrderId}?section=billing`,
    });
  }

  return results;
}
