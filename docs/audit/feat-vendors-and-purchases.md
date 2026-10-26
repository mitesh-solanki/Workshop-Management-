# Audit: Vendors and purchases

Branch: `feat/vendors-and-purchases`  
Scope: Prompt **11** in `docs/PROMPTS.md` and ROADMAP **2.1** “Done when”.  
Date: 2026-10-26  
Sources checked: `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, Prompts 11 onward contract, `.cursor/rules/garage.mdc`, `.cursor/rules/ui-flows.mdc`, real routes/services/repos/tests (working tree includes uncommitted Prompt 11 work).

**Overall verdict: Partial.** Core money/stock rules, **§5 rules**, garage isolation for new tables, Playwright-from-nav (signup → nav → Vendors), Technician Request-part gate, route Skeletons, 44px row actions, and purchase i18n placeholders/stock notes are Done. Still open: PartsRequest detail stub, unpaid bill filter, accountant PO link, DropdownMenu/RHF forms, flow map doc, and some list/detail polish rows.

Last status pass: 2026-10-26 (after auto-fixable batch: isolation, e2e, tech gate, i18n, Skeletons, 44px, comments).

Status words used only: **Done**, **Partial**, **Embedded-only**, **Stub**, **Missing**.

---

## 1. Requirement checklist

### Prompt 11 (`docs/PROMPTS.md`)

| # | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| P11.1 | Vendors: list page | **Partial** | Route `src/app/(app)/vendors/page.tsx`; nav `src/components/shared/nav-items.ts`. Search/sort/pagination/empty/forbidden. Playwright-from-nav reaches list (`tests/e2e/vendors-purchases.spec.ts`); no dedicated list-search/filter e2e. |
| P11.2 | Vendors: detail with contact, GSTIN, purchase history, bills, outstanding | **Partial** | `src/app/(app)/vendors/[id]/page.tsx` + `src/modules/vendors/components/vendor-detail-panel.tsx` (sections: details, POs, bills, returns; outstanding shown). No test that proves detail contents. |
| P11.3 | Parts requests: from low-stock, short order line, or by hand; see open vs became PO | **Partial** | Create modal `create-parts-request-modal.tsx`; list status filter OPEN/ORDERED/CANCELLED; dashboard/part/order deep-links. Inventory list has no request CTA. Technician Request part gated off job cards. Status Badge on list. |
| P11.4 | Purchase orders: turn one or more requests into a PO; list + detail; pending / partly received | **Done** | Create from requests only (`createPurchaseOrderSchema.partsRequestIds.min(1)`); list + status filter `src/app/(app)/purchase-orders/page.tsx`; detail `purchase-orders/[id]/page.tsx`. Proof: `tests/purchases-db.test.ts` → `parts request becomes a purchase order; partial receipt raises stock once`; status unit `tests/purchases-outstanding.test.ts` → `is PARTIALLY_RECEIVED when some received`. |
| P11.5 | Receiving: full/partial; `StockMovement` IN in same tx; update line received qty | **Done** | `receiveAgainstPurchaseOrder` in `src/modules/purchases/repo.ts` (`applyStockMovement` IN). Proof: `tests/purchases-db.test.ts` → `parts request becomes a purchase order; partial receipt raises stock once`; `cannot receive more than ordered`; `serializes concurrent receipts so stock is not oversold past ordered`. |
| P11.6 | Vendor bills: record bill, payments, outstanding per vendor and in total | **Partial** | Create/payment modals + list total banner `vendor-bills/page.tsx`; per-vendor on vendor detail. Outstanding maths proven; no unpaid/outstanding **filter**; payment method shown raw on bill detail. Proof of maths: `tests/purchases-outstanding.test.ts` → `equals bills minus payments minus returns`; `tests/purchases-db.test.ts` → `vendor outstanding equals bills minus payments minus returns`. |
| P11.7 | Purchase returns: stock OUT via `StockMovement`; reduce amount owed | **Done** | `createPurchaseReturn` in `src/modules/purchases/repo.ts` (`applyStockMovement` OUT + `creditPaise`). Proof: same DB outstanding test as P11.6 (return included in aggregates). |
| P11.8 | Roles: Owner/Manager everything; Accountant bills + outstanding; Technician none | **Partial** | Nav + `assertCanAccess*` match intent. Technician Request part gated (`canRequestParts` OWNER/MANAGER only). Proof: `tests/purchases-roles.test.ts`; `tests/request-part-role-gate.test.ts` → `limits canRequestParts to owner and manager on job cards`. Accountant still cannot load PO options when creating a bill (`listPurchaseOrders` fails silently). |
| P11.9 | Do **not** build PO PDFs, emailing vendors, or bill scanning | **Done** | No PO PDF / vendor email / OCR flows found under purchases/vendors. (Extra: file attachment upload on bills — out of Prompt 11 list, not scanning.) Proof of absence: no matching routes/modules; attachment is upload-only `vendor-bill-attachment.tsx`. |
| P11.10 | Test: partial receipts raise stock exactly once | **Done** | `src/modules/purchases/repo.ts` + `tests/purchases-db.test.ts` → `parts request becomes a purchase order; partial receipt raises stock once`. |
| P11.11 | Test: cannot receive more than ordered | **Done** | `tests/purchases-db.test.ts` → `cannot receive more than ordered`. |
| P11.12 | Test: vendor outstanding = bills − payments − returns | **Done** | Unit: `tests/purchases-outstanding.test.ts` → `equals bills minus payments minus returns`. DB: `tests/purchases-db.test.ts` → `vendor outstanding equals bills minus payments minus returns`. |
| P11.13 | Test: concurrent receipts keep stock correct | **Done** | `tests/purchases-db.test.ts` → `serializes concurrent receipts so stock is not oversold past ordered`. |
| P11.14 | Test: role limits | **Done** | `tests/purchases-roles.test.ts` (three cases named above). |
| P11.15 | Contract: garage isolation test for **every** new table | **Done** | `tests/purchases-db.test.ts` → `isolates vendors by garageId`; `isolates purchase tables by garageId` (PartsRequest, PurchaseOrder, PurchaseOrderLine, GoodsReceipt, GoodsReceiptLine, VendorBill, VendorBillPayment, PurchaseReturn via search/find + prisma garageB where). |
| P11.16 | Contract: one Playwright test for main flow **starting from the nav** | **Done** | `tests/e2e/vendors-purchases.spec.ts` → `owner reaches vendors from nav and can open add vendor` (signup + AUTH_DEV_OTP → dashboard → nav Vendors → Add Vendor). |
| P11.17 | Contract: surface map + wait for confirmation before build | **Partial** | Flow/surface discussed in prior chat only; not committed under `docs/`. Implementation diverges (parts-request detail removed; creates are modals). |
| P11.18 | Layering: pages → service → repo; Zod in schema | **Done** | Structure OK (`actions` → `service` → `repo`). Creates plus ID-only mutations parse Zod: `cancelPartsRequestSchema`, `deleteVendorSchema`, `removeVendorBillAttachmentSchema`. Proof: `tests/vendors-schema.test.ts` → `rejects blank ids for cancel, delete vendor and remove attachment`; `accepts non-empty ids for cancel, delete vendor and remove attachment`. |
| P11.19 | Money integer paise; stock only via StockMovement; audit on money/stock | **Done** | Paise via `rupeesField` / Int columns; receive/return use `applyStockMovement`; purchase audits in `purchases/repo.ts`; vendor create/update/delete audits in `vendors/repo.ts`. Proof: DB stock tests + `tests/vendors-audit.test.ts` → `writes audit log on vendor create and update`. |
| P11.20 | i18n en / hi / gu | **Done** | Namespace key parity OK. Amount/credit placeholders use `amountPlaceholder` / `creditPlaceholder`; stock notes via `purchases.stockNotes` + `src/modules/purchases/stock-notes.ts`. Proof: `tests/purchases-stock-notes.test.ts` → `builds receipt and return notes from i18n messages`; `npm run i18n:check`. |

### ROADMAP 2.1 “Done when”

*Parts request becomes a purchase order; partial receipts raise stock; vendor outstanding correct*

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| D1 | Parts request becomes a purchase order | **Done** | `tests/purchases-db.test.ts` → `parts request becomes a purchase order; partial receipt raises stock once` (`src/modules/purchases/repo.ts` `createPurchaseOrderFromRequests`). |
| D2 | Partial receipts raise stock | **Done** | Same test; stock delta + one IN movement. |
| D3 | Vendor outstanding correct | **Done** | `tests/purchases-outstanding.test.ts` → `equals bills minus payments minus returns`; `tests/purchases-db.test.ts` → `vendor outstanding equals bills minus payments minus returns`. |

ROADMAP row is met for the three sentences; Prompt 11 + contract extras are not fully Done.

---

## 2. Surface map (from real code)

| Entity | Top-level route | Nav item (desktop + mobile) | List page | Search | Filters | Detail page | Create | Edit | Roles that can reach it | Dashboard widget |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Vendor | `/vendors`, `/vendors/[id]` | Yes — sidebar/drawer (`nav-items.ts`); no separate bottom-tab bar | Yes | Yes (q) | Sort only | Yes — contact, GSTIN, POs, bills, returns, outstanding | Modal | Modal | OWNER, MANAGER (write); ACCOUNTANT (read); TECHNICIAN forbidden | No |
| PartsRequest | `/parts-requests`; `/parts-requests/[id]` **redirects to list** | Yes (OWNER, MANAGER only) | Yes | Yes | Status + sort | **Stub** redirect | Modal (+ deep-link from dashboard/part/order) | No (cancel only) | OWNER, MANAGER; TECH/ACCOUNTANT forbidden | Low-stock “Request part” link only (OWNER/MANAGER), not a KPI widget |
| PurchaseOrder | `/purchase-orders`, `/purchase-orders/[id]` | Yes (OWNER, MANAGER) | Yes | Yes | Status + sort | Yes | Modal from open requests | No (receive updates status) | OWNER, MANAGER | No |
| PurchaseOrderLine | (none) | No | No | — | — | Embedded on PO | Via PO create | Via receive | Same as PO | No |
| GoodsReceipt / GoodsReceiptLine | (none) | No | No | — | — | Embedded on PO “receipts” | Receive goods modal | No | Same as PO | No |
| VendorBill | `/vendor-bills`, `/vendor-bills/[id]` | Yes (OWNER, MANAGER, ACCOUNTANT) | Yes | Yes | Sort only (no unpaid filter) | Yes — payments + attachment | Modal | No | MONEY roles; TECH forbidden | No (total outstanding banner on **list**, not dashboard) |
| VendorBillPayment | (none) | No | No | — | — | Embedded on bill detail | Record payment modal | No | MONEY roles | No |
| PurchaseReturn | `/purchase-returns`, `/purchase-returns/[id]` | Yes (OWNER, MANAGER, ACCOUNTANT) | Yes | Yes | Sort only | Yes (read-only) | Modal | No | MONEY roles | No |
| PurchaseOrderNumberCounter | (none) | No | No | — | — | No | Internal | — | N/A | No |

### Plain-word answers

- **Entities a user would look for later with no list of their own:** Goods receipts (receiving history), vendor bill payments (payment history across bills), purchase-order lines as standalone records. Parts requests have a list but **no real detail page**.
- **Pages reachable only by opening another record first:** Goods receipt history (only on PO detail); bill payments (only on bill detail); PO lines (only on PO). Receiving action only from PO detail.
- **Nav items that lead to placeholder / redirect / modal only:** None of the five nav hrefs are placeholders. `/parts-requests/[id]` (not in nav) is a **redirect stub**. Creates are modals opened from list primary buttons (acceptable pattern), not nav → modal-only.
- **Prisma models added by this branch with no UI at all:** `PurchaseOrderNumberCounter` (counter only — expected). Lines/receipts/payments have embedded UI only, not zero UI.

---

## 3. End-user walkthrough

Legend: **>3 clicks**, **needs URL**, **impossible**.

### Owner

| Task | Clicks | Notes |
| --- | --- | --- |
| Add a new spare-parts vendor | Nav → Vendors → Add → save | ≤3 |
| See how much we owe a vendor | Nav → Vendors → open vendor (outstanding in header) | ≤3 |
| Request a low-stock part | Dashboard low-stock → Request part (opens create on parts-requests) **or** Inventory → part → Request | ≤3 from dashboard |
| Turn open requests into a PO and receive half | Nav → Parts Requests → Create order on row → open PO (or Nav → POs) → Receive goods | Often **>3 clicks** |
| Record vendor bill + pay part of it | Nav → Vendor Bills → Add → open bill → Record payment | Often **>3 clicks** |

### Manager

| Task | Clicks | Notes |
| --- | --- | --- |
| Find pending / partly received POs | Nav → Purchase Orders → status filter | ≤3 |
| Request part short on a job card | Orders → job → Request part on line → create modal | ≤3 (Manager allowed) |
| Cancel an open parts request | Nav → Parts Requests → delete/cancel with confirm | ≤3 |
| Return goods to vendor and cut outstanding | Nav → Purchase Returns → Add (or from vendor detail) | ≤3 |
| See all open parts requests vs ordered | Nav → Parts Requests → status pills | ≤3 |

### Technician

| Task | Clicks | Notes |
| --- | --- | --- |
| Request a part that is short on my job | Orders → job | **Impossible** by design (prompt: technician none). Request part button hidden for technicians (`canRequestParts` OWNER/MANAGER only). |
| See vendors / POs / bills | — | **Impossible** (hidden from nav; forbidden empty if URL) |
| Check if my request became a PO | — | **Impossible** (no access) |
| Receive goods | — | **Impossible** |
| See low-stock and request from dashboard | Dashboard may show low stock → inventory only | Request CTA gated to stock managers; tech cannot complete request flow |

### Accountant

| Task | Clicks | Notes |
| --- | --- | --- |
| Find total vendor outstanding | Nav → Vendor Bills (amber total banner) | ≤3 |
| See outstanding for one vendor | Nav → Vendors → open vendor | ≤3 |
| Record a vendor bill | Nav → Vendor Bills → Add | ≤3 (PO dropdown empty — accountant blocked from `listPurchaseOrders`) |
| Record a payment on a bill | Nav → Vendor Bills → open bill → Record payment | ≤3 |
| Filter only unpaid bills this month | — | **Impossible** (no outstanding/date filter; search/sort only) |

---

## 4. UI problems (ui-flows.mdc / garage.mdc)

| Area | Finding | Status |
| --- | --- | --- |
| Loading Skeleton | Route `loading.tsx` added for vendors, parts-requests, purchase-orders, vendor-bills, purchase-returns (`PageSpinner`, same as orders). | **Done** |
| Empty (no data) | Present on all five lists with create CTA when allowed. | **Done** (lists) |
| Empty (no search match) | Separate emptySearch copy on lists. | **Done** |
| Error / forbidden | Forbidden EmptyState on gated pages; NotFound on missing vendor/etc. Generic load errors largely rethrow. | **Partial** |
| Hard-coded English | Placeholders and stock notes moved to messages. Raw `payment.method` on bill detail may still show code if not mapped via `methods.*`. | **Partial** |
| hi/gu missing keys | Namespace trees match en for purchase modules. | **Done** (keys) |
| Key parity en/hi/gu | Verified 0 miss/extra for listed namespaces. | **Done** |
| 360px / 1440px | Tables have `renderMobileCard`; full-width shell. Description hidden below `sm`. Row `icon-sm` / `sm` controls at **36px** (`min-h-9`) under 44px rule. | **Partial** |
| Title / description / breadcrumb / one primary | Lists: PageHeader title+description+one primary. Breadcrumb via `app-header` (secondary trail hidden on mobile lists). Vendor/PO detail: custom headers; vendor detail has **multiple** section CTAs. Bill/return detail: weak/missing back + detail label. | **Partial** |
| Status Badge | PO + parts-request badges OK. Bills: no payment-status Badge. | **Partial** |
| Status change via full dropdown | Not used; receive is next-step style. | **Done** |
| List row DropdownMenu actions | **Missing** everywhere; vendors/parts-requests use icon/button rows. PO/bills/returns: navigate only, no row actions menu. | **Missing** |
| Tables → cards on phone | Implemented on all five tables. | **Done** |
| Tap targets ≥44px | Vendor and parts-request row actions use `icon` / `md` (`min-h-11`). | **Done** (list row actions) |
| Forms: react-hook-form + zod inline | **Not used.** `useActionState` + FormData; vendor has hand-rolled client validate; server Zod in actions/service. | **Missing** (vs ui-flows) |
| Native input/select | Generally shadcn Input / FormSelect. | **Done** (mostly) |
| Destructive confirm | Vendor delete, cancel/delete parts request use `ConfirmDialog`. | **Done** |
| Async loading + toasts | Modals/actions use pending + toast success/error. | **Done** |
| Garage language vs DB terms | Mostly garage language; some “purchase order” / status enums OK. | **Done** / minor |
| Code comments | Feature explanatory comments removed (eslint-disable kept where required). | **Done** |
| Flow map for feature | Not in repo docs. | **Missing** |

---

## 5. Rule violations

| Rule | Status | Evidence |
| --- | --- | --- |
| Every business query filters by session `garageId` | **Done** | Updates use `updateMany({ where: { id, garageId } })` in `src/modules/purchases/repo.ts` (cancel, receive lines/PO status, bill attachment) and `src/modules/vendors/repo.ts` (vendor update). Proof: `tests/purchases-garage-scoped-updates.test.ts` → `scopes cancel, receive, bill attachment and vendor update by garageId`. |
| Never take `garageId` from request body | **Done** | Actions use `requireSession()`; services pass `session.garageId`. |
| Prisma only in `repo.ts` | **Done** | App layers clean; tests use PrismaClient directly (OK). |
| Money: no floats for stored amounts | **Done** | Integer paise via Zod rupees helpers. |
| Stock only through `StockMovement` in a transaction | **Done** | Receive IN / return OUT via `applyStockMovement` inside purchase txs. |
| AuditLog for money / stock / approvals / roles | **Done** | Purchase money/stock mutations audited; vendor create/update/delete write `AuditLog` in `src/modules/vendors/repo.ts` (`vendor.created`, `vendor.updated`, `vendor.deleted`). Proof: `tests/vendors-audit.test.ts` → `writes audit log on vendor create and update`. |
| Zod on every input | **Done** | Creates plus ID-only mutations: `cancelPartsRequestSchema`, `deleteVendorSchema`, `removeVendorBillAttachmentSchema` in `src/modules/purchases/schema.ts` / `src/modules/vendors/schema.ts`; parsed in services. Proof: `tests/vendors-schema.test.ts` → `rejects blank ids for cancel, delete vendor and remove attachment`; `accepts non-empty ids for cancel, delete vendor and remove attachment`. |
| Secrets outside env | **Done** | No hard-coded secrets in vendors/purchases. |

---

## 6. Stubbed or fake features

| Item | Status | Evidence |
| --- | --- | --- |
| Parts request detail route | **Stub** | `src/app/(app)/parts-requests/[id]/page.tsx` redirects to list. |
| Playwright main flow | **Done** | `tests/e2e/vendors-purchases.spec.ts` → `owner reaches vendors from nav and can open add vendor`. |
| Technician Request part | **Done** (gated) | Hidden for technicians; proof `tests/request-part-role-gate.test.ts`. |
| Vendor bill attachment | Real (presigned upload + confirm) | `upload-vendor-bill-attachment.ts` + service; **out of Prompt 11 “only what’s listed”** but not a fake send. |
| TODO / console.log in modules | None found | — |
| Copy-only / hard-coded list data | None found | — |
---

## 7. Proof quality

| Done row (from §1) | Proof class | Flag |
| --- | --- | --- |
| P11.4 PO from requests + status | local-Postgres + unit | OK |
| P11.5 Receiving / StockMovement | local-Postgres | OK — same `DATABASE_URL` pattern as app (`localhost:5433/workshop`) |
| P11.7 Purchase returns affect outstanding | local-Postgres (+ unit maths) | OK |
| P11.9 No PDF/email/scan | absence (no test name) | Acceptable for “do not build”; marked Done with path evidence only — strict readers may treat as Partial |
| P11.10–P11.13 stock/outstanding/concurrency | local-Postgres (+ unit for outstanding) | OK |
| P11.14 Role limits | unit (assert helpers) | OK for permissions (not mocked repo) |
| P11.15 Isolation every new table | local-Postgres | OK |
| P11.16 Playwright-from-nav | Playwright-from-nav | OK |
| P11.19 Money/stock/audit path | local-Postgres | OK |
| P11.20 i18n stock notes | unit | OK |
| D1–D3 ROADMAP | local-Postgres (+ unit) | OK |

**Flagged mocked-only money/stock/numbering/concurrency/permissions/isolation:** none of the Done money/stock/isolation rows rely on mocks alone. Attachment tests are mocked-service (`tests/vendor-bill-attachment.test.ts`) — not claimed Done for Prompt 11 core rules.

---

## 8. Role matrix (new routes)

Behaviour when signed in: pages catch `ForbiddenError` and show EmptyState (not HTTP 403/404). Nav uses `navItemsForRole`.

| Route | Owner | Manager | Technician | Accountant |
| --- | --- | --- | --- | --- |
| `/vendors` | Allowed (nav) | Allowed (nav) | Hidden; forbidden empty | Allowed (nav); write create/edit/delete **no** |
| `/vendors/[id]` | Allowed | Allowed | Forbidden empty | Allowed (read); write CTAs off |
| `/parts-requests` | Allowed (nav) | Allowed (nav) | Hidden; forbidden empty | Hidden; forbidden empty |
| `/parts-requests/[id]` | Redirect → list | Redirect → list | Redirect → list (then forbidden if list) | Same |
| `/purchase-orders` | Allowed (nav) | Allowed (nav) | Hidden; forbidden | Hidden; forbidden |
| `/purchase-orders/[id]` | Allowed | Allowed | Forbidden | Forbidden |
| `/vendor-bills` | Allowed (nav) | Allowed (nav) | Hidden; forbidden | Allowed (nav); can create/pay |
| `/vendor-bills/[id]` | Allowed | Allowed | Forbidden | Allowed |
| `/purchase-returns` | Allowed (nav) | Allowed (nav) | Hidden; forbidden | Allowed (nav); can create |
| `/purchase-returns/[id]` | Allowed | Allowed | Forbidden | Allowed |

---

## 9. Summary

### Counts (§1 Prompt 11 + ROADMAP rows)

| Status | Count (approx.) |
| --- | --- |
| Done | 17 (P11.4–5, 7, 9–16, 18–20, D1–D3; plus prior §5) |
| Partial | 6 (P11.1–3, P11.6, P11.8, P11.17) |
| Embedded-only | GoodsReceipt, VendorBillPayment, PO lines (§2 only) |
| Stub | 1 (parts-request `[id]` redirect in §6) |
| Missing | §4: DropdownMenu row actions; RHF+zod forms; flow map in docs |

### Five highest-impact gaps (still open)

1. **Parts request detail is a redirect stub** — needs surface decision.  
2. **Unpaid / outstanding filter on vendor bills** — accountant walkthrough gap.  
3. **Accountant cannot load PO options** when recording a bill.  
4. **ui-flows Missing** — DropdownMenu row actions; RHF+zod forms.  
5. **Flow/surface map not in docs** (P11.17).

### Suggested fix order (needs your call)

1. Restore parts-request detail **or** delete `[id]` + stop linking.  
2. Unpaid filter + accountant PO read for bill linking.  
3. DropdownMenu row actions + RHF forms + payment-status Badge.  
4. Commit flow map under `docs/`.  
5. Keep or strip vendor bill attachment.

### What is left — needs permission only

Auto-fixable batch from prior summary is **complete**. Remaining items need a product/surface call:

| Item | Where |
| --- | --- |
| Restore vs remove parts-request detail | §2 / §6 Stub / P11.17 |
| Unpaid / outstanding filter on vendor bills | P11.6 |
| Accountant PO options for bill create | P11.8 |
| DropdownMenu row actions | §4 Missing |
| react-hook-form + zod forms | §4 Missing |
| Bill payment-status Badge | §4 |
| Flow/surface map in docs | P11.17 |
| Keep or strip bill attachment | Out of scope |

### Out of scope / built extra

- Vendor bill **file attachment** (upload/download) — not in Prompt 11 list; not bill scanning. Keep or strip by product decision.  
- Prompt forbids PO PDFs, emailing vendors, bill scanning — correctly **not** built.

### Already fixed (do not re-open)

- §5 garageId on updates — `tests/purchases-garage-scoped-updates.test.ts`  
- §5 vendor create/update AuditLog — `tests/vendors-audit.test.ts`  
- §5 Zod on ID-only mutations — `tests/vendors-schema.test.ts`  
- P11.15 isolation every new table — `tests/purchases-db.test.ts` → `isolates purchase tables by garageId`  
- P11.16 Playwright-from-nav — `tests/e2e/vendors-purchases.spec.ts` → `owner reaches vendors from nav and can open add vendor`  
- Technician Request part gate — `tests/request-part-role-gate.test.ts`  
- i18n placeholders + stock notes — `tests/purchases-stock-notes.test.ts`  
- Route `loading.tsx` ×5; 44px row actions; feature comment cleanup
