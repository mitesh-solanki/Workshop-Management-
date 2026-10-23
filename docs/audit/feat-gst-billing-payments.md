# Audit: GST billing and payments

Branch: `feat/gst-billing-payments` (working tree; tip `7d06af6` is inventory merge — **billing work is largely uncommitted**)  
Scope: Prompt **8** in `docs/PROMPTS.md` and ROADMAP task **1.8** Done when.  
Also checked against `docs/PRODUCT_SPEC.md` / `docs/ARCHITECTURE.md` rules that apply to billing.  
Date: 2026-10-23 (re-audit after lint / OTP test fixes)

Be strict: if behaviour is incomplete, unproven, or only works in a mocked / simulated path, it is **Partial**.

---

## 1. Requirement checklist

### Prompt 8 (`docs/PROMPTS.md`)

| # | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| P8.1 | Build invoices from approved estimate lines | **Done** | Sole create path `createInvoiceFromApprovedEstimate` in `src/modules/billing/service.ts`; `buildLinesFromApproved` keeps only `approvalState === "APPROVED"`; empty → `billing.no_approved_lines`. UI gated on `hasApprovedEstimateLines` in `src/modules/billing/components/job-card-billing-content.tsx`. Prisma `Invoice.estimateId` required (`prisma/schema.prisma`). Actions: `src/app/actions/billing.ts`. |
| P8.2 | Compute CGST+SGST for same-state sales and IGST otherwise | **Done** | Split logic in `src/lib/gst.ts`; applied in `service.ts`. POS: form defaults from vehicle `stateCode` (unknown → UI `"24"`); service uses vehicle when known else seller state. Vehicle create schema defaults missing `stateCode` to Gujarat `24` (`tests/billing.test.ts`). Override via `CreateInvoiceForm` select. |
| P8.3 | Sequential invoice numbers per garage per FY (Apr–Mar) inside finalization txn with counter row lock | **Done** | FY helpers `src/lib/financial-year.ts`. `allocateInvoiceNumber` in `src/modules/billing/repo.ts`: `INSERT … ON CONFLICT DO NOTHING` then `SELECT … FOR UPDATE`, then increment. Called from `finalizeInvoiceInTransaction` and `createAndFinalizeInvoice` inside `prisma.$transaction`. Models `InvoiceNumberCounter` + `@@unique([garageId, invoiceNumber])` / `@@unique([garageId, financialYearStart, sequenceNumber])`. Format e.g. `INV/YYYY-YY/NNNN`. |
| P8.4 | Finalized invoices cannot be edited; credit notes for corrections and refunds | **Done** | Immutability via `assertInvoiceEditable` (wired in `finalizeInvoice`). Multi-line credit notes (`credit-note-form.tsx` + `createCreditNoteAction` `getAll`). `refundDuePaise` + `recordRefundRow` / `recordInvoiceRefund` when paid exceeds net bill; UI `RecordRefundForm`. Proofs: `computes refund due…`, `records a refund disbursement…` (`tests/billing.test.ts`); `shows refund due after credit note…` (`tests/billing-db.test.ts`). |
| P8.5 | Payments: cash, UPI, card, mixed, partial, with pending balance | **Done** | Enum `PaymentMethod`; Zod `recordPaymentSchema` + `normalizePaymentBreakdown` in `src/modules/billing/schema.ts`; `recordPaymentRow` enforces finalized + amount ≤ pending; balance in `src/modules/billing/balance.ts`; UI `record-payment-form.tsx`. |
| P8.6 | Generate an invoice PDF with English, Hindi or Gujarati label set | **Done** | `src/modules/billing/pdf.ts` (pdfkit), `pdf-labels.ts` (en/hi/gu), route `src/app/(app)/orders/[id]/invoices/[invoiceId]/pdf/route.ts`, download link in billing UI. Labels include explicit non–e-invoice disclaimer. **Caveat:** hi/gu glyphs need Unicode TTFs (`assets/fonts/…` or system Noto paths); otherwise Helvetica fallback may garble script. |
| P8.7 | Tests: GST totals, rounding, number sequence under concurrent finalization, credit notes | **Done** | Unit: `tests/billing.test.ts` (GST, FY, balance, refund due, vehicle state, payments, refunds, immutability, PDF labels). Live DB: `tests/billing-db.test.ts` (concurrent ×8, finalize, credit notes, partial/mixed pay, refund cash-out, double-finalize). PDF: `tests/billing-pdf.test.ts`. In-memory concurrent sim remains as a unit illustration; real lock proof is in `billing-db.test.ts`. |
| P8.8 | Do not claim e-invoice support | **Done** | `billing.notEInvoice` in messages; PDF `notEInvoice` in `pdf-labels.ts`; UI disclaimer in `job-card-billing-content.tsx`. |

### ROADMAP 1.8 “Done when”

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| D1 | Finalized invoice with correct GST and sequential number | **Done** | Finalize / create-and-finalize allocate locked sequential numbers; CGST/SGST or IGST persisted on invoice + lines. Proof: `tests/billing-db.test.ts` → `finalizes draft with a locked sequential number`; GST unit tests in `tests/billing.test.ts`. |
| D2 | PDF | **Done** | Route + pdfkit generator + locale labels; `tests/billing-pdf.test.ts` asserts PDF magic. |
| D3 | Partial and mixed payments | **Done** | Schema + repo overpay check + UI; MIXED requires ≥2 channels. Proofs: `records partial then mixed payments and refuses overpay` in `tests/billing-db.test.ts`; `rejects mixed payments…` + `records a partial payment…` in `tests/billing.test.ts`. |
| D4 | Credit note | **Done** | Create CN + multi-line UI; refund due + cash-out via `recordRefundRow`. Proof: `shows refund due after credit note on a fully paid invoice and records cash returned` (`tests/billing-db.test.ts`). |
| D5 | Tests pass | **Done** | `npm test` — **204/204** green (billing unit + PDF + live DB included). Postgres via `DATABASE_URL` / docker. |

### Supporting product / architecture expectations (Prompt 8 scope)

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| S1 | Layering: pages/actions → service → repo; Zod in `schema.ts` | **Done** | `src/app/actions/billing.ts` → `modules/billing/service.ts` → `repo.ts`; Zod in `schema.ts`. |
| S2 | Money as integer paise | **Done** | Int paise fields; `rupeesToPaiseSchema` / `lib/money.ts` / `lib/gst.ts` integer math. |
| S3 | Audit log on money changes | **Done** | `billing.invoice_draft_created`, `billing.invoice_finalized`, `billing.payment_recorded`, `billing.refund_recorded`, `billing.credit_note_created` in `repo.ts`. |
| S4 | i18n en / hi / gu for UI | **Done** (keys) | **81** `billing.*` leaf keys aligned in `messages/en.json`, `hi.json`, `gu.json` (compared programmatically). PDF strings live in `pdf-labels.ts`, not messages. |
| S5 | Garage-scoped queries; garageId from session | **Done** | `recordPaymentRow` uses `updateMany({ where: { id, garageId } })` in `src/modules/billing/repo.ts`. Cross-garage payment attempt returns null and leaves `amountPaidPaise` unchanged — proved in `records partial then mixed payments and refuses overpay` (`tests/billing-db.test.ts`). Actions use `requireSession()` only. |
| S6 | Nav / entry point | **Done** | Job-card section `?section=billing`; redirect `src/app/(app)/orders/[id]/billing/page.tsx`. |
| S7 | Migration | **Done** (present) | `prisma/migrations/20260328120000_billing_invoices/migration.sql` (uncommitted with feature); `prisma migrate status` up to date on local Postgres. |

---

## 2. UI problems

| Area | Finding |
| --- | --- |
| Loading | Order detail has `src/app/(app)/orders/[id]/loading.tsx`. **No** billing-specific skeleton/Suspense; section renders with parent. Form buttons show pending text — OK. |
| Empty | Present: `emptyHint` / `emptyNeedApproval` / `emptyReadOnly` in `job-card-billing-content.tsx`. Payments/credit-notes lists omitted when empty (no dedicated empty copy — acceptable). |
| Error | Inline `role="alert"` on forms. **No** success/error toasts (UI-flows rule). PDF route returns hard-coded English `"Not found"` / `"Forbidden"` (`pdf/route.ts`). No billing `error.tsx`. |
| Hard-coded English | `placeholder="0"` ×3 in `record-payment-form.tsx` and `record-refund-form.tsx`; PDF route error bodies; `` `(seller ${…})` `` and raw method/reason enums in `pdf.ts`; full PDF copy in `pdf-labels.ts` (localized there, but not via `messages/*`). Shared Zod `"Invalid price"` path in `lib/money.ts` can surface on billing money fields. |
| hi / gu | `billing` namespace: **no missing keys** vs en (81/81/81). Residual English is hard-coded UI/PDF route strings above, not missing JSON keys. |
| Mobile (360px) | Cards/lists (not tables); tax grid `grid-cols-2` → `sm:grid-cols-4`; mixed payment stacks until `sm:grid-cols-3`; `min-h-11` tap targets. Dense finalized card (pay + CN + lines) is long scroll but usable. |
| Desktop (1440px) | Lives in full-width job-card hub (`max-w-none`) — does not introduce a narrow lone column. |
| UI-flows gaps | Billing is a **section**, not a standalone page: no Breadcrumb (hub uses back link); **multiple** primary-looking buttons (Create / Finalize / Save payment); status is plain text, not `Badge`; native `<input>`/`<select>` instead of shadcn Form/Input/Select; no react-hook-form. Matches estimates pattern more than customers. |
| Status display | Draft/Finalized shown via `t(\`statuses.${…}\`)` without `Badge` / `StatusBadge`. |

---

## 3. Rule violations

| Rule | Status | Evidence |
| --- | --- | --- |
| Every business query filters by session `garageId` | **OK** | Payment invoice bump uses `updateMany({ where: { id, garageId } })` in `src/modules/billing/repo.ts`. Proved via foreign-garage null result in `records partial then mixed payments and refuses overpay` (`tests/billing-db.test.ts`). Counter updates by `id` after garage-scoped `FOR UPDATE` — id came from filtered lock. |
| Never take `garageId` from request body | **OK** | Actions → `requireSession()`; garage from session only. |
| Prisma only in `repo.ts` | **OK** | Billing Prisma confined to `src/modules/billing/repo.ts`. |
| Money: no floats for stored amounts | **OK** | Int paise; no `parseFloat` in billing module. |
| Finalized invoices immutable; corrections via credit note | **OK** | `finalizeInvoice` wires `assertInvoiceEditable` (`src/modules/billing/service.ts`). Proofs in `tests/billing.test.ts`. No edit-lines API; credit notes do not mutate invoice tax/lines. Refund cash-out is a separate payment row (`isRefund`), not an invoice edit. |
| Audit log for money changes | **OK** | See S3. |
| Zod on every input | **OK** (service) | Service `.parse` on create/finalize/payment/credit-note/refund. Actions cast FormData enums before service (Zod still runs in service). PDF locale uses hand-rolled `parseLocale`, not the Zod locale schema. |
| Stock via `StockMovement` | **N/A** | Billing does not change stock. |

---

## 4. Stubbed or fake features

| Item | Notes |
| --- | --- |
| PDF | **Real** pdfkit buffer (tests assert `%PDF`). Not a placeholder. Hi/gu depend on font files. |
| Payments | **Real** — increment `amountPaidPaise`, pending via `pendingBalancePaise`. Payment `note` in schema but **no note field** in UI. |
| Credit notes | **Real** multi-line UI + balance reduction. Refund reason is accounting; cash returned is a separate `recordRefundRow` path (`isRefund: true`). No credit-note PDF. |
| Concurrent numbering (unit test) | **Fake** — in-memory lock in `tests/billing.test.ts`; real proof only in `tests/billing-db.test.ts`. |
| `/orders/[id]/billing` | Redirect stub by design → `?section=billing`. |
| Duplicate invoices | `createAnotherHint` allows another invoice from the **same** approved estimate lines — **no** guard against double-billing the same labour/parts. |
| Product Spec extras (out of Prompt 8 core, still absent) | No UPI QR/payment-link provider (that is Prompt **9**), no share/print UI beyond PDF download, no invoice discounts, no receipts list, no cash register / daily closing, no expenses, no profit-per-order report. Acceptable for Prompt 8 scope; do not mark Prompt 8 Done for those. |
| `assertInvoiceEditable` | **Wired** in `finalizeInvoice` (`src/modules/billing/service.ts`). |
| No `TODO` / `console.log` stubs | In billing sources reviewed. |

---

## Verdict

| Area | Call |
| --- | --- |
| Core create-from-approved + GST split + FY locked numbers + finalize | **Done** (POS defaults from vehicle state) |
| Payments + PDF + no e-invoice claim | **Done** |
| Credit notes | **Done** (multi-line + refund due / money returned) |
| Tests as specified | **Done** (unit + live DB proofs for payments, refunds, concurrency) |
| Rule hygiene | Payment `garageId` gap closed; immutability guard wired |
| ROADMAP 1.8 ship bar | Prompt 8 core bar met. Optional later: double-invoice guard, plate→state auto-suggest, UI-flows polish (Badge, toasts, shadcn Form). |

### Quality gates (re-run 2026-10-23)

| Command | Result |
| --- | --- |
| `npm run lint` | **Pass** (0 errors; 11 pre-existing warnings: jsx-no-literals on inventory, unused `_prev` on actions, TanStack Table) |
| `npm run typecheck` | **Pass** |
| `npm test` | **Pass** — 22 files, **204/204** tests |

**Still out of Prompt 8 / not blocking ship:** visual check at 360px/1440px in a browser; UI-flows gaps in §2; payment/refund note field; double-invoice guard; hi/gu PDF fonts if Noto TTF absent.
