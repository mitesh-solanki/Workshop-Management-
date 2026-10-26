# Audit: UPI link and Customer Live Link

Branch: `feat/upi-customer-live-link` (working tree largely **uncommitted**; tip `b827c59` is prior GST billing merge)  
Scope: Prompt **9** in `docs/PROMPTS.md` and ROADMAP task **1.9** Done when.  
Also checked against `docs/PRODUCT_SPEC.md` / `docs/ARCHITECTURE.md` rules that apply to Live Link and UPI.  
Date: 2026-10-23

Be strict: if behaviour is incomplete, unproven, or only works in a mocked path, it is **Partial**.

---

## 1. Requirement checklist

### Prompt 9 (`docs/PROMPTS.md`)

| # | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| P9.1 | UPI payment (QR and payment link) through Razorpay or Cashfree [choose one] | **Partial** | **Chose Razorpay** (`src/lib/razorpay.ts`, `.env.example`). Staff: `StartUpiPaymentForm` → `startUpiPaymentAction` → `startUpiPaymentForInvoice`. Customer: `LivePayPanel` → `liveStartPayAction` → `startPayViaLiveLink`. Creates Razorpay Payment Link with UPI-only checkout options; QR is a PNG of the **payment-link URL** via `paymentLinkQrDataUrl` (`src/lib/qr.ts`), not a raw `upi://` intent. **Unproven end-to-end** without live `RAZORPAY_*` keys (unit path mocks provider). |
| P9.2 | Webhook reconciliation marks payments as paid exactly once | **Partial** | Route `src/app/api/webhooks/razorpay/route.ts` → `reconcileRazorpayWebhook` → `markRazorpayPaymentPaidOnce` (`src/modules/payments/repo.ts`): pending→PAID + unique `(provider, providerPaymentId)` + invoice `amountPaidPaise` bump in one transaction; early idempotent return if already PAID. Proofs are **mocked only** (`tests/payments-webhook.test.ts`). No live-DB concurrent webhook test. |
| P9.3 | Public page `/live/[token]` | **Done** | `src/app/live/[token]/page.tsx` → `getPublicLiveView` → `PublicLiveViewPanel`. No session / login required. |
| P9.4 | 32-byte random token; store only its hash | **Done** | `randomBytes(32).toString("base64url")` in `createLiveLink` (`src/modules/live-link/service.ts`); DB column `LiveLink.tokenHash` only (`prisma/schema.prisma`). Hash via `hashToken` (SHA-256 of `token:AUTH_SECRET` pepper) in `src/lib/otp.ts`. Test: `stores only the hash when creating a link` (`tests/live-link.test.ts`). |
| P9.5 | Expiry | **Done** | Default 7 days (`LIVE_LINK_TTL_MS`); optional 1–168h in schema. Checked in `resolveLiveLink` / `inspectLiveTokenForTests`. Test: `rejects an expired token`. |
| P9.6 | Rate limiting | **Done** | IP + per-token buckets in `resolveLiveLink` using `LIVE_LINK_VIEW_RATE` / `LIVE_LINK_ACTION_RATE` (`src/lib/rate-limit.ts`). Proof: `denies public view when rate limited`, `denies approve when action rate limited` (`tests/live-link.test.ts`). DB fallback still not atomic under concurrency (ops note only). |
| P9.7 | Shows status | **Done** | `PublicLiveView.status` + `StatusBadge` + `orders.statuses.*` in `public-live-view.tsx`. |
| P9.8 | Shows inspection photos and videos | **Done** | Media from inspection items with presigned URLs (`getPublicLiveView` → `PublicLiveView`). Empty copy `mediaEmpty`. Storage failures still skip that item (page loads). Proof: `includes inspection photos and videos with download urls` (`tests/live-link.test.ts`). |
| P9.9 | Estimate with approve or reject per line | **Done** | Pending lines get `LiveApproveButtons` → `approveEstimateLineViaLiveLink` → `recordOnlineLineApproval` (`method: "ONLINE"`, audit `estimate.line_approval_online`). Proof: `approves a pending estimate line via live token`, `rejects a pending estimate line via live token` (`tests/live-link.test.ts`). |
| P9.10 | Shows the invoice and a pay button | **Done** (UI) | Latest finalized invoice (+ pending balance) and `LivePayPanel` / `payNow`. Empty: `invoiceEmpty`. Pay requires Razorpay env (see P9.1). |
| P9.11 | Exposes no other customer data | **Done** | Snapshot selects garage name, vehicle registration/make/model, order status/dates, inspection media, estimate lines, invoice lines — **no** customer name, phone, address, or email (`loadLiveOrderSnapshot` / `PublicLiveView`). |
| P9.12 | Tests for expired, wrong and reused tokens | **Partial** | `tests/live-link.test.ts`: wrong, expired, revoked-after-renew (“reused”). All use mocked repo. No Playwright / live DB. Reused = revoked after renew, not “pay twice with same token” or token replay after expiry. |

### ROADMAP 1.9 “Done when”

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| D1 | Customer opens a link on a phone with no login | **Partial** | Public route exists and is unauthenticated. **Not proven** in browser/Playwright; layout is phone-oriented (`max-w-2xl`). |
| D2 | Sees status and photos | **Done** | Status + media payload proven (P9.8). |
| D3 | Approves lines | **Done** | Approve/reject via live token proven (P9.9). |
| D4 | Pays | **Partial** | Pay UI + Razorpay link/QR + webhook path; depends on configured keys and unproven live webhook/DB path (P9.1–P9.2). |

### Supporting product / architecture expectations (Prompt 9 scope)

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| S1 | Layering: pages/actions → service → repo; Zod in `schema.ts` | **Done** | `src/app/actions/live-link.ts`, `payments.ts` → `modules/*/service.ts` → `repo.ts`; Zod in `live-link/schema.ts`, `payments/schema.ts` (incl. webhook payload). |
| S2 | Money as integer paise | **Done** | `amountPaise` ints; Razorpay `amount` in paise; balance via `pendingBalancePaise`. No floats in payments/live-link modules. |
| S3 | Audit log on money / approvals | **Done** | Online line approval + webhook paid + live link create/revoke + pending UPI create (`payments.upi_pending_created` in `createPendingUpiPayment`, `src/modules/payments/repo.ts`). Proof: `writes an audit row when creating a pending UPI payment` (`tests/payments-pending.test.ts`). |
| S4 | i18n en / hi / gu | **Done** (keys) | `liveLink` **49/49/49**, `payments.errors` **5/5/5**, billing UPI keys present in all three `messages/*.json`. Residual English role words in hi/gu `readOnly` (see §2). |
| S5 | Garage-scoped staff queries; garageId from session | **Done** | Staff create/revoke/status use `session.garageId`. Public path scopes by verified link’s `garageId` + `serviceOrderId`. Webhook lookups by provider ids are intentionally global, then mark uses `pending.garageId`. |
| S6 | Nav / entry point | **Done** | Job-card section `liveLink` (`job-card-sections.ts`); staff panel on `orders/[id]`; UPI also on billing section. |
| S7 | Migration + env | **Partial** | Migration present uncommitted: `prisma/migrations/20260329120000_live_link_upi_payments/migration.sql`. `.env.example` documents Razorpay + webhook URL. Migration apply / migrate status not verified in this audit. |
| S8 | Product Spec “later … warranty” on Live Link | **Missing** | Prompt 9 does not require warranty; Product Spec signature table mentions warranty later. Not built. |

---

## 2. UI problems

| Area | Finding |
| --- | --- |
| Loading | Order detail has `src/app/(app)/orders/[id]/loading.tsx`. **No** `src/app/live/[token]/loading.tsx` (or `error.tsx`). Public live page blocks on server resolve with no Skeleton. |
| Empty | Present on live page: `mediaEmpty`, `estimateEmpty`, `invoiceEmpty`. Staff panel shows inactive/create state (no dedicated “never created” empty CTA beyond create button — acceptable). |
| Error | Bad/expired/revoked/rate-limited tokens share one generic `unavailableTitle` / `unavailableBody` (reason not distinguished in UI). Client actions use sonner toasts (Toaster in root `ToastShell`). Approve/pay error toasts show **already-translated** `message` strings — OK. |
| Hard-coded English | Razorpay link description / note: ``Invoice ${…}``, `"Invoice payment"`, `"Razorpay UPI"` in `src/modules/payments/service.ts` (provider-facing / DB note, still English). `toLocaleString()` for dates without locale in `public-live-view.tsx` / staff panel (may ignore app locale). hi/gu `liveLink.readOnly` still contains English role names “Owner, Manager or Accountant”. |
| hi / gu keys | **No missing keys** vs en for `liveLink` / `payments` / billing UPI strings. |
| Mobile (360px) | Live page: single column, `min-h-11` tap targets, media `grid-cols-2`, pay button full width — suitable for phone. Staff live-link section sits in job-card hub (existing pattern). |
| Desktop (1440px) | Public live deliberately `max-w-2xl` centered — fine for customer phone page; looks like a narrow column on wide screens by design. Staff section is full-width job-card hub — OK. |
| UI-flows gaps | Live Link is a **job-card section**, not a standalone list/detail page (no Breadcrumb of its own). Staff: create + revoke both primary-looking. Billing now has **two** UPI/manual payment entry points. Payment list shows PENDING / PAID / FAILED badges for rows. |
| Pending UPI visibility | **Done** — payment list shows `Badge` via `paymentStatusBadgeVariant` + `billing.paymentStatuses.*` (`job-card-billing-content.tsx`). Proof: `maps PENDING UPI to warning so staff can tell it from paid` (`tests/payments-pending.test.ts`). |

---

## 3. Rule violations

| Rule | Status | Evidence |
| --- | --- | --- |
| Every business query filters by session `garageId` | **OK** (with webhook caveat) | Staff/live snapshot queries include `garageId`. `findLiveLinkByTokenHash` is global by unique hash (correct for public token). `findPendingByPaymentLinkId` / `findPaymentByProviderPaymentId` omit `garageId` (provider id uniqueness); paid path re-filters by `garageId`. |
| Never take `garageId` from request body | **OK** | Staff actions use `requireSession()`. Live actions derive garage from token hash. Webhook may read `notes.garageId` we ourselves set on the Payment Link as a **fallback** lookup only. |
| Prisma only in `repo.ts` | **OK** | Live-link and payments Prisma confined to their `repo.ts` files. |
| Money: no floats for stored amounts | **OK** | Integer paise throughout. |
| Audit log for money / approval changes | **Done** | Approvals + webhook paid + link create/revoke + pending UPI create audited (`payments.upi_pending_created`). Proof: `writes an audit row when creating a pending UPI payment`. |
| Zod on every input | **OK** | Create/approve/pay/start-UPI/webhook payload schemas. Actions pass structured args; service `.parse`s. |
| Stock via `StockMovement` | **N/A** | Feature does not change stock. |
| Secrets only in env; `.env.example` | **OK** | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` documented; no real secrets in tree from this audit. |

---

## 4. Stubbed or fake features

| Item | Notes |
| --- | --- |
| Razorpay Payment Link + QR | **Real code path** against Razorpay HTTP API when keys set. Without keys → `payments.razorpay_not_configured` (503). Not a fake in-app “paid” button. |
| Webhook paid-once | **Real** transaction + unique constraint; tests **mock** repo/signature — concurrent/live DB not proved. |
| Live link create | **Real** — stores hash, returns URL once, renew revokes prior. Not an invite-style dead link. |
| Rate limit | **Real** Redis/DB buckets; effectiveness under load untested; DB path race-prone. |
| Public approve / pay | **Real** server actions; approve untested; pay needs live Razorpay. |
| Warranty on live page | **Missing** (Product Spec “later”; out of Prompt 9 core wording). |
| Share live link via WhatsApp/SMS | **Missing** — staff copy URL only; no `sendMessage` / MessageLog. |
| Payment status FAILED / expire pending links | **Stubbed / incomplete** — enum has `FAILED`; no code marks failed or cancels stale PENDING links. |
| Billing payment list for PENDING UPI | **Done** — status Badge (Awaiting UPI / Paid / Failed). See §2 Pending UPI visibility. |
| Media when MinIO/S3 down | Silently empty gallery — soft stub of “photos”. |
| E2E “customer on phone” | **Missing** — no Playwright coverage for `/live/[token]`. |

---

## Verdict

| Area | Call |
| --- | --- |
| Token model (32-byte, hash-only, expiry, revoke/renew) | **Done** |
| Public `/live/[token]` status + estimate + invoice UI | **Done** (privacy OK) |
| Per-line online approve/reject | **Done** (tested) |
| Razorpay UPI QR + link + webhook once-paid | **Partial** (built; mocked tests; needs keys + live proof) |
| Rate limiting | **Done** (denial tested) |
| ROADMAP 1.9 ship bar | **Partial** — see/approve proven in unit tests; open→pay still needs Razorpay keys + stronger webhook/DB proof (D1/D4) |

### Quality gates (this audit)

| Command | Result |
| --- | --- |
| `npx vitest run tests/live-link.test.ts tests/payments-webhook.test.ts tests/payments-pending.test.ts` | **Pass** — 17/17 |
| `npm run lint` | **Pass** (existing warnings only; i18n OK 986 keys) |
| `npm run typecheck` | **Pass** |
| `npm test` | Unit/feature tests for this work pass; `billing-db.test.ts` 5 fails from missing `DATABASE_URL` on shared Prisma client (pre-existing env flake, unrelated) |

**Still open before calling Prompt 9 / 1.9 done:** live-DB or recorded webhook proof of once-paid (P9.1–P9.2, D4); customer open without login proven in Playwright (D1); distinguish unavailable reasons (or keep generic deliberately); apply migration; configure Razorpay in staging.
