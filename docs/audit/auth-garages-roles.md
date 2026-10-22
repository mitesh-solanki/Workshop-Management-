# Audit: Auth, garages, roles, languages

Branch: `feat/auth-garages-roles`  
Scope: Prompt 1 in `docs/PROMPTS.md` and ROADMAP task **1.1** Done when.  
Date: 2026-10-22  

Be strict: if behaviour is incomplete, unproven, or only works in a mocked path, it is **Partial**.

> Follow-up (same day): a UI-foundation pass on this branch (wider shell, sidebar, Noto fonts, shared UI, dashboard placeholders, route loading/error) may fix some items in §2 (narrow desktop column, language glyph buttons, missing loading/error). Re-check §2 against the tip before treating those UI findings as current. Business-logic findings in §1 / §3 / §4 (OTP console-only, invite link-only, mocked isolation tests, Prisma in `lib/otp|auth|audit`) still apply unless separately fixed.

---

## 1. Requirement checklist

### Prompt 1 (`docs/PROMPTS.md`)

| # | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| P1.1 | Sign-up and login with Auth.js (email OTP) | **Done** | Auth.js Credentials OTP in `src/lib/auth.ts`, login/signup pages, and `src/modules/auth/service.ts`. OTP is emailed via Resend in development and production (`src/lib/email`). |
| P1.2 | New user creates a Garage and becomes Owner | **Done** | `createOwnerWithGarage` in `src/modules/auth/repo.ts` (role `OWNER`); called from `completeOtpSignIn` in `src/modules/auth/service.ts` on signup OTP. |
| P1.3 | Owner can invite Manager, Technician and Accountant | **Partial** | Invite form + role enum in `src/modules/team/schema.ts`, `src/modules/team/components/invite-form.tsx`, `inviteTeamMember` in `src/modules/team/service.ts` (Owner-only). Accept flow: `src/app/(auth)/invite/[token]/page.tsx`. Invite only creates a **shareable URL**; no invite email is sent. |
| P1.4 | Prisma models Garage, User, AuditLog | **Done** | `prisma/schema.prisma`; migration `prisma/migrations/20260319120000_auth_garages_roles/migration.sql`. (Also `Invite`, `EmailOtp`, Auth.js `Account`/`Session`/`VerificationToken`.) |
| P1.5 | `requireSession` returns userId, garageId and role | **Done** | `src/lib/session.ts` (`SessionContext` also includes email/name). |
| P1.6 | `requireRole` helper | **Done** | `src/lib/rbac.ts`; re-exported from `src/lib/session.ts`. Used by settings/team services. Covered in `tests/garage-isolation.test.ts`. |
| P1.7 | Basic app shell with mobile bottom navigation | **Done** | `src/app/(app)/layout.tsx`, `src/components/bottom-nav.tsx` (`min-h-14` tap targets, safe-area padding). |
| P1.8 | Language switcher (English, Hindi, Gujarati) | **Done** | `src/components/language-switcher.tsx`, `src/app/actions/locale.ts`, `src/i18n/config.ts`, messages in `messages/en.json`, `messages/hi.json`, `messages/gu.json`. |
| P1.9 | Settings page for garage name, address and GSTIN | **Done** | `src/app/(app)/settings/page.tsx`, `src/modules/settings/*`, Zod GSTIN check in `src/modules/settings/schema.ts`. |
| P1.10 | Tests: user in garage A cannot read or change garage B | **Partial** | `tests/garage-isolation.test.ts` proves service helpers reject a foreign `requestedGarageId` and that settings updates use `session.garageId`. Repos/DB are **mocked**; no integration/e2e test against a real database showing cross-garage denial. Helpers `getGarageSettingsForGarageId` / `getTeamMemberForGarage` exist mainly for these tests. |

### ROADMAP 1.1 “Done when”

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| D1 | Owner signs up | **Partial** | Signup + OTP verify path exists (`src/modules/auth/service.ts`, `src/app/actions/auth.ts`). OTP is emailed via Resend (dev and production). Optional `AUTH_DEV_OTP` for non-production e2e only. No Playwright signup coverage (`tests/e2e/home.spec.ts` only checks home heading). |
| D2 | Creates a garage | **Done** | Same as P1.2; garage created in the signup transaction. |
| D3 | Invites staff | **Partial** | Invite record + accept-via-link OTP works in code, but invite is “copy this link” only; no outbound invite message. |
| D4 | Screens switch between English, Hindi and Gujarati | **Partial** | Switcher + three message files with matching keys (64 keys each). Gaps: loading fallbacks hard-code **English** via `import en from messages/en.json` (`src/app/layout.tsx`, `src/app/(app)/layout.tsx`, `src/app/(auth)/layout.tsx`, `src/app/(auth)/loading.tsx`, `src/app/page.tsx`); root `<html lang>` is always `defaultLocale` (`en`) in `src/app/layout.tsx`; role enums shown raw (`OWNER`, etc.) in header/dashboard/invite subtitle. |
| D5 | User of one garage cannot read another’s data (tested) | **Partial** | Same as P1.10. Production settings/team paths correctly use `session.garageId` only (`src/modules/settings/service.ts`, `src/modules/team/service.ts`, repos filter by `garageId`). Isolation is **not** proven end-to-end against Postgres. |

---

## 2. UI problems

### Loading / empty / error states

| Page / surface | Loading | Empty | Error | Notes |
| --- | --- | --- | --- | --- |
| Home `/` | Partial | n/a | Missing | Suspense fallback uses hard-coded `en.common.loading` (`src/app/page.tsx`). |
| Login / signup | Partial | n/a | Partial | `(auth)/loading.tsx` exists but English-only. Form actions show `state.message` (often English `AppError` text). |
| Invite `/invite/[token]` | Partial | n/a | Partial | Invalid token → `notFound()` with **no** `not-found.tsx` in the app. No translated invalid-invite page. |
| Dashboard | Missing page-level | n/a (always content) | Missing | `getGarageSettings` can throw; no try/catch or error UI (`src/app/(app)/dashboard/page.tsx`). App layout Suspense only covers chrome. |
| Team | Missing page-level loading | **Done** (`emptyMembers`) | **Done** (forbidden/error) | `src/app/(app)/team/page.tsx`. |
| Settings | Missing page-level loading | n/a | Missing | No handling if garage missing (`src/app/(app)/settings/page.tsx`). Form shows action errors. |
| Orders | n/a | **Done** (placeholder copy) | n/a | Stub empty state only (`src/app/(app)/orders/page.tsx`). |
| App shell | Partial | n/a | Missing | Suspense fallback English-only (`src/app/(app)/layout.tsx`). No `(app)/loading.tsx`, no error boundary. |

### Hard-coded English (user-facing)

- Action fallbacks: `"Something went wrong"`, `"Invalid or expired code"` in `src/app/actions/auth.ts`, `src/app/actions/team.ts`, `src/app/actions/settings.ts`.
- `AppError` / `ForbiddenError` / etc. default messages in `src/lib/errors.ts` and service throw strings (e.g. `"An account with this email already exists"`) surface directly in the UI.
- Role labels rendered as enum strings: `session.role` in `src/components/app-header.tsx` and dashboard welcome; invite subtitle passes `role: invite.role` in `src/app/(auth)/invite/[token]/page.tsx` (shows `MANAGER`, not `team.roles.MANAGER`).
- Metadata: `title` / `description` in `src/app/layout.tsx` (“Workshop”, “Garage management software”).
- Loading strings imported from `messages/en.json` regardless of locale (layouts listed above).

### Missing hi/gu translations

- Message **keys** for en/hi/gu are aligned (no missing keys in the JSON files).
- Gaps are **runtime**: English fallbacks, untranslated role enums, and English error strings from the server (not missing JSON keys).

### Layout: 360px mobile / 1440px desktop

- **360px:** Bottom nav and forms use large tap targets (`min-h-11`–`min-h-14`, `min-h-12` inputs). Shell is `max-w-lg` + horizontal padding — should work at 360px. Not verified in Playwright viewport tests.
- **1440px:** Entire app chrome and content are capped at `max-w-lg` (~512px) centered (`src/app/(app)/layout.tsx`, header, bottom nav). On a wide desktop the sides are large empty margins; dashboard is a short welcome paragraph — looks sparse/empty by design of a phone shell with no desktop layout.

---

## 3. Rule violations

Scoped to files on this branch (`git ls-files` under `src/`).

### Queries without `garageId`

| Finding | Status | Evidence |
| --- | --- | --- |
| Business reads/writes for garage settings and team | OK | `session.garageId` only; repos take `garageId` (`src/modules/settings/repo.ts`, `src/modules/team/repo.ts`). |
| Auth lookups by email / invite token | Acceptable for auth | `findUserByEmail`, `findPendingInviteByEmail` / `ByTokenHash` in `src/modules/auth/repo.ts` — global by design (email unique, token hash unique). |
| JWT refresh loads user by id without garage filter | OK for session refresh | `prisma.user.findUnique({ where: { id } })` in `src/lib/auth.ts`. |

No case found where a **client-supplied** `garageId` is trusted for settings/team mutations.

### Prisma used outside `repo.ts`

| File | Violation |
| --- | --- |
| `src/lib/otp.ts` | Direct `prisma.emailOtp.*` — should live under an auth/OTP repo per ARCHITECTURE. |
| `src/lib/auth.ts` | Direct `prisma.user.findUnique` in JWT callback. |
| `src/lib/audit.ts` | Direct `prisma.auditLog.create` — shared helper, but still Prisma outside a module `repo.ts`. |

Module repos (`auth`, `settings`, `team`) correctly own their Prisma calls.

### Floats used for money

**None** in auth/garages/roles feature code. `src/lib/money.ts` remains integer-paise helpers (from Prompt 0). No billing on this branch.

### Missing audit log writes

| Change | Audited? | Evidence |
| --- | --- | --- |
| Garage created on signup | Yes | `garage.created` in `src/modules/auth/repo.ts` |
| Invite accepted | Yes | `invite.accepted` in `src/modules/auth/repo.ts` |
| Invite created | Yes | `invite.created` via `writeAuditLog` in `src/modules/team/service.ts` |
| Garage settings updated | Yes | `garage.settings_updated` in `src/modules/settings/service.ts` |
| Login / OTP request | No | Not required by “money, stock, approvals and roles” for a plain login; role **assignment** is covered via invite accept. |

### Missing Zod validation

| Input path | Validated? | Evidence |
| --- | --- | --- |
| Signup / login / invite OTP request & verify | Yes | `src/modules/auth/schema.ts` (+ credentials Zod in `src/lib/auth.ts`) |
| Create invite | Yes | `src/modules/team/schema.ts` |
| Garage settings | Yes | `src/modules/settings/schema.ts` |
| Locale cookie | Partial | `isLocale` check in `src/app/actions/locale.ts` (not Zod; acceptable for a cookie enum) |

---

## 4. Stubbed or fake features

| Feature | What it actually does | Files |
| --- | --- | --- |
| Email OTP delivery | Sent via Resend (`lib/email`) in development and production. Hashed storage, expiry, attempt limits, rate limits. Optional `AUTH_DEV_OTP` for non-production e2e only; UI never shows the code. | `src/lib/email/*`, `src/modules/auth/service.ts`, README |
| Staff invite notification | Invite email with accept link via Resend; token stored hashed; resend/revoke supported; send failures recorded for Owner retry. SMS/WhatsApp not wired (DLT). | `src/modules/team/service.ts`, `src/lib/email/*` |
| Service orders nav item | Placeholder page only (“will appear here in a later step”). | `src/app/(app)/orders/page.tsx` |
| Customer Live Link `/live/[token]` | Page returns `null`. | `src/app/live/[token]/page.tsx` |
| Isolation “cross-garage” APIs | Test-only helpers that reject mismatched ids; not used by UI. | `getGarageSettingsForGarageId`, `updateGarageSettingsForGarageId`, `getTeamMemberForGarage` |

---

## Summary verdict

Prompt 1 is **substantially implemented**: Auth.js session with role + garageId, Owner signup, invite-by-link with Resend email, settings, bottom nav, and three-language message files. Remaining gaps vs a strict ROADMAP 1.1 reading are mostly e2e/isolation coverage and leftover hard-coded English at some edges.

**Highest-priority gaps before calling 1.1 done**

1. Integration or e2e test that garage A cannot read/update garage B’s rows in Postgres.  
2. Replace remaining hard-coded English errors/loading/role enums with `next-intl` keys in all three locales where still present.  
3. Prefer Prisma only in repos for any leftover helpers.
