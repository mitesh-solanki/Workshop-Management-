# Audit: Inventory basics

Branch: `feat/inventory-management` (working tree; tip `d719770` is a merge — inventory files are largely **uncommitted**)  
Scope: Prompt **7** in `docs/PROMPTS.md` and ROADMAP task **1.7** Done when.  
Date: 2026-10-22  

Be strict: if behaviour is incomplete, unproven, or only works in a mocked / simulated path, it is **Partial**.

---

## 1. Requirement checklist

### Prompt 7 (`docs/PROMPTS.md`)

| # | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| P7.1 | Parts: name, SKU, unit, purchase price, selling price, GST rate, HSN, low-stock level | **Done** | Prisma `Part` in `prisma/schema.prisma`; Zod `createPartSchema` / `updatePartSchema` in `src/modules/inventory/schema.ts`; UI `src/modules/inventory/components/part-form.tsx`; pages `src/app/(app)/inventory/new/page.tsx`, `src/app/(app)/inventory/[id]/page.tsx`. |
| P7.2 | `StockMovement` (in, out, adjustment) as the only way stock changes | **Done** | Enum `StockMovementType` + model `StockMovement`; pure helpers in `src/modules/inventory/stock.ts`; mutations only via `applyStockMovement` in `src/modules/inventory/repo.ts`. No editable on-hand quantity on `Part`. |
| P7.3 | Current stock derived from movements | **Done** | `getPartStock` / `getStockLevelsForParts` aggregate `quantityChange` (`src/modules/inventory/repo.ts`). |
| P7.4 | Using a part on a service order creates an OUT movement in the same transaction | **Done** | `createServiceOrderLine` in `src/modules/service-orders/repo.ts` calls `applyStockMovement(..., tx)` when `type === "PART"` and `partId` is set; service enforces `partId` via `inventory.part_required` (`src/modules/service-orders/service.ts`); picker UI `src/modules/service-orders/components/order-line-form.tsx` + `src/app/(app)/orders/[id]/page.tsx`. |
| P7.5 | Low-stock alerts on the dashboard | **Done** | `getLowStockAlerts` → `listLowStockParts` on all roles including technician home (`src/app/(app)/dashboard/page.tsx`). Proof: `tests/inventory.test.ts` → `allows technician to read low-stock alerts`. |
| P7.6 | Direct sale of parts without a service order | **Done** | Multi-line UI + customer picker (`src/modules/inventory/components/direct-sale-form.tsx`, `src/app/(app)/inventory/sales/new/page.tsx`); FormData parser `src/modules/inventory/direct-sale-form-data.ts`; action passes full `lines` + `customerId`; sale form/detail show taxable + GST + total via `sumLineGst`. Proof: `tests/inventory.test.ts` → `parses multiple lines and optional customer from FormData`, `creates a multi-line sale with customer via the service`. |
| P7.7 | Tests: stock never goes negative unless garage setting allows it | **Done** | Live Postgres path in `tests/inventory-db.test.ts` → `rejects OUT that would go negative when garage disallows it`, `allows negative stock when garage setting is on` (calls real `applyStockMovement`). Unit guards remain in `tests/inventory.test.ts`. |
| P7.8 | Tests: concurrent use does not oversell | **Done** | Live Postgres race in `tests/inventory-db.test.ts` → `serializes concurrent OUTs so stock is not oversold` (two parallel `applyStockMovement` OUTs against `FOR UPDATE`). |

### ROADMAP 1.7 “Done when”

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| D1 | Parts | **Done** | Catalogue CRUD + list/search (`src/app/(app)/inventory/page.tsx`). |
| D2 | Stock in | **Done** | `recordStockIn` + `StockInForm` on part detail. |
| D3 | Stock out | **Done** | Manual `recordStockOut` + order-line / direct-sale OUT paths. |
| D4 | Low-stock alert | **Done** | Dashboard low-stock section for all roles including technician (`src/app/(app)/dashboard/page.tsx`). Proof: `tests/inventory.test.ts` → `allows technician to read low-stock alerts`. |
| D5 | Parts used on an order reduce stock | **Done** | Same-transaction OUT in `createServiceOrderLine` (see P7.4). No reverse/IN when a line is removed — there is no line-delete API (acceptable for this prompt; still a product gap). |

### Supporting product / architecture expectations (Prompt 7 scope)

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| S1 | Layering: pages/actions → service → repo; Zod in `schema.ts` | **Done** | `src/app/actions/inventory.ts` → `modules/inventory/service.ts` → `repo.ts`; Zod in `schema.ts`. |
| S2 | Money as integer paise | **Done** | `purchasePricePaise` / `sellingPricePaise` / `unitPricePaise` Int; `rupeesToPaiseSchema` / `formatRupees` / `multiplyByQuantity`. |
| S3 | Garage setting to allow negative stock | **Done** | `Garage.allowNegativeStock`; settings UI `garage-settings-form.tsx`; migration `prisma/migrations/20260327120000_inventory_basics/migration.sql`. |
| S4 | Audit log on stock / money-adjacent changes | **Done** (stock) | `inventory.part_created`, `inventory.part_updated`, `inventory.stock_movement`, `inventory.direct_sale_created` in `repo.ts`; order line still writes `service_order.line_added`. |
| S5 | i18n en / hi / gu | **Done** (keys) | `inventory` namespace + dashboard/settings stock keys present and aligned in `messages/en.json`, `hi.json`, `gu.json`. |
| S6 | Nav entry | **Done** | `src/components/shared/nav-items.ts` → `/inventory`. |

---

## 2. UI problems

| Area | Finding |
| --- | --- |
| Loading | Shared `(app)/loading.tsx` spinner only. No inventory-specific `loading.tsx` / skeletons. Forms show pending button text — OK. |
| Empty | Parts list: `EmptyState` (`inventory/page.tsx`) — but **same copy** for “no parts” and “search returned nothing”. Sales list: plain muted `<p>` (`salesEmpty`), not `EmptyState`. Movements empty: muted text — OK. Direct sale with no parts: `noPartsForSale` — OK. |
| Error | Detail pages map `NotFoundError` / `ForbiddenError` → `notFound()`. No route-level `error.tsx` under `inventory/`. Form errors go through `translateError` — good for inventory codes. |
| Hard-coded English | `placeholder="+5 or -2"` in `src/modules/inventory/components/stock-forms.tsx`. Movement notes written in English in DB: `"Opening stock"`, `"Direct sale"` (`inventory/repo.ts`), `` `Service order ${id}` `` (`service-orders/repo.ts`) — shown raw on part history. |
| hi / gu | Inventory / dashboard low-stock / settings stock keys appear matched across en/hi/gu. Residual English is the hard-coded notes/placeholder above, not missing JSON keys. |
| Mobile (360px) | List rows stack (`flex-col` → `sm:flex-row`); `min-h-12` / `min-h-14` tap targets. Stock action forms stack until `lg:grid-cols-3`. Generally usable; stock section on part detail is long vertically. |
| Desktop (1440px) | Parts **list** is full-width — good. Create/edit part and direct-sale forms use `max-w-xl` — looks like a narrow column on wide screens (conflicts with project “full-width admin” visual standard). |
| Other | List shows raw unit codes (`pcs`) rather than `inventory.units.*`. Dates use `toLocaleString()` without next-intl locale. |

---

## 3. Rule violations

| Rule | Status | Evidence |
| --- | --- | --- |
| Every business query filters by session `garageId` | **OK** for inventory | Repos take `garageId` from service/session; `where: { garageId, … }` / lock SQL includes `"garageId"`. Cross-garage helper `getPartForGarageId` rejects mismatched id. |
| Never take `garageId` from request body | **OK** | Actions use `requireSession()` only. |
| Prisma only in `repo.ts` | **OK** for this feature | `src/modules/inventory/repo.ts` (+ service-orders repo for order-line stock). No Prisma in inventory service/actions/pages. |
| Money: no floats for stored amounts | **OK** | Int paise fields; form rupees parsed via `rupeesToPaiseSchema` / `parseRupeesToPaise`. |
| Stock changes only through `StockMovement` in a transaction | **OK** | `applyStockMovement` / `createPart` opening IN / `createDirectSale` / order-line path. |
| Audit log for stock (and related) changes | **OK** | See S4. Settings change for `allowNegativeStock` still goes through existing settings audit path. |
| Zod on every input | **OK** | Service `.parse` on all write/list search inputs. |
| Gaps / strict notes | **OK** for stock proofs | Concurrent oversell and negative-stock rules proven with live Postgres in `tests/inventory-db.test.ts`. Isolation for parts is still a mocked service test (`getPartForGarageId`); `tests/garage-isolation.test.ts` covers `allowNegativeStock` settings shape, not part/stock rows. |

---

## 4. Stubbed or fake features

| Item | Assessment |
| --- | --- |
| Concurrent oversell test | **Done** — live Postgres race in `tests/inventory-db.test.ts` (`serializes concurrent OUTs so stock is not oversold`). |
| Direct sale multi-line + customer | **Done** — multi-line form + customer select; proof in `tests/inventory.test.ts` (`parses multiple lines…`, `creates a multi-line sale…`). |
| Direct sale “billing” | Still not a full invoice/payment (Prompt 8); **taxable + GST + total** now shown on form and sale detail via `sumLineGst`. |
| Technician dashboard low stock | **Done** — low-stock section on technician home (`src/app/(app)/dashboard/page.tsx`). |
| Stock reverse on line removal / sale void | **Missing** (no delete/void flows). |
| Reservations / barcode / batch / PO receiving | Out of scope for Prompt 7 (ROADMAP 2.1–2.2); correctly **not** built. |
| ROADMAP status row | Still says “Pending (new branch after 3–6 merge)” while this branch exists with WIP — docs not updated. |

---

## Summary verdict

Prompt 7 / ROADMAP 1.7 checklist items P7.1–P7.8 and D1–D5 are **Done** on `feat/inventory-management`: real `Part` + `StockMovement`, derived on-hand, manual in/out/adjust, order-line stock-out in the same transaction, low-stock on all role dashboards (including technician), multi-line direct sale with customer + GST totals, garage `allowNegativeStock`, paise money, Zod, garage-scoped repos, en/hi/gu keys, and live Postgres proofs for negative-stock and concurrent oversell.

Remaining non-checklist polish (not re-audited here): hard-coded English movement notes/placeholder; create/sale form desktop width; inventory work may still be largely **uncommitted** on the branch tip.
