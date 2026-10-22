# Audit: Service orders

Branch: `feat/service-orders` @ `a644d85` (also merged via PRs into `main`)  
Scope: Prompt 3 in `docs/PROMPTS.md` and ROADMAP task **1.3** Done when.  
Date: 2026-10-22  

Be strict: if behaviour is incomplete, unproven, or only works in a mocked path, it is **Partial**.

---

## 1. Requirement checklist

### Prompt 3 (`docs/PROMPTS.md`)

| # | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| P3.1 | Create order from a vehicle | **Done** | `src/app/(app)/vehicles/[id]/orders/new/page.tsx`; `createServiceOrder` in `src/modules/service-orders/service.ts` + `repo.ts`. |
| P3.2 | Complaint, requested services, odometer in, expected completion, technician, bay | **Done** | `createServiceOrderSchema` in `src/modules/service-orders/schema.ts`; form `service-order-form.tsx`; Prisma `ServiceOrder` fields. |
| P3.3 | Statuses: Waiting, Inspection, In Progress, Waiting for Parts, Ready, Completed | **Done** | `SERVICE_ORDER_STATUSES` / Prisma enum `ServiceOrderStatus`. |
| P3.4 | Every status change audited (who + when) | **Done** | `updateServiceOrderStatus` writes audit in transaction (`src/modules/service-orders/repo.ts`); create also logs initial WAITING. Timeline via `listServiceOrderAuditLogs`. |
| P3.5 | Order lines for labour and parts (parts link to inventory later) | **Partial** | Labour/PART lines with description, qty, unit price paise (`order-line-form.tsx`, schema `partId` optional). **No UI to pick inventory `partId`**; inventory module not built — “link later” is stubbed. |
| P3.6 | Order detail with timeline | **Done** | `src/app/(app)/orders/[id]/page.tsx` + `order-timeline.tsx`. |
| P3.7 | Technician sees only assigned orders | **Done** | `listOrdersForBoard` / `getServiceOrder` gate on `technicianId === session.userId` in `service.ts`. |
| P3.8 | Tests for status rules and role limits | **Partial** | Strong coverage in `tests/service-orders.test.ts` (transitions, tech scope, accountant blocks, cross-garage helpers). Repos mocked — not DB integration. |

### ROADMAP 1.3 “Done when”

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| D1 | Create an order from a vehicle | **Done** | As P3.1. |
| D2 | Complaints, technician, dates | **Done** | Complaint + technician + expected completion (+ odometer/bay). |
| D3 | Status changes logged | **Done** | Audit log + timeline. |

---

## 2. UI problems

| Area | Finding |
| --- | --- |
| Loading | Only `(auth)/loading.tsx` on this tip; no `(app)/loading.tsx` / `error.tsx`. |
| Empty | Orders list / board have empty copy; order detail assumes order exists (`notFound` on miss). |
| Error | Forbidden/NotFound → `notFound()`; action failures often English `"Something went wrong"` / raw `AppError.message` (`src/app/actions/service-orders.ts` — ~hard-coded strings). |
| Hard-coded English | Action messages; some service error strings (`Cannot change status from…`). |
| hi/gu | `orders` (+ related) keys present; en/hi/gu key parity OK on tip (306 keys). |
| Mobile | Forms/timeline use large tap targets; board has dedicated mobile column switcher (Prompt 6). Shell still narrow `max-w-lg` on this tip. |

---

## 3. Rule violations

| Rule | Status | Evidence |
| --- | --- | --- |
| `garageId` from session | **OK** | Service always uses `session.garageId`; repos filter by it. |
| Prisma only in repo | **OK** for module | Shared lib Prisma exceptions remain (`otp`/`auth`/`audit`). |
| Money as integer paise | **Done** for lines | `RupeePriceInput` / paise fields; no float storage for line prices. |
| Audit on status | **Done** | Status transitions audited. |
| Zod | **Done** | `src/modules/service-orders/schema.ts`. |

---

## 4. Stubbed or fake features

- **Parts ↔ inventory**: `partId` on lines is optional and not selectable in UI; no Part table usage.
- Cross-garage helpers in service used mainly by unit tests.

---

## Summary verdict

Prompt 3 is **mostly Done**: create-from-vehicle, full status set with audited transitions, timeline, technician scoping, and solid mocked tests. Remaining **Partial**: inventory-linked parts, English action/errors, no app-route loading/error boundaries, tests not against live DB.
