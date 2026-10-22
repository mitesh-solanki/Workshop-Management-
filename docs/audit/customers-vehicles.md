# Audit: Customers and vehicles

Branch: `feat/customers-vehicles` @ `86f738c`  
Scope: Prompt 2 in `docs/PROMPTS.md` and ROADMAP task **1.2** Done when.  
Date: 2026-10-22  

Be strict: if behaviour is incomplete, unproven, or only works in a mocked path, it is **Partial**.

---

## 1. Requirement checklist

### Prompt 2 (`docs/PROMPTS.md`)

| # | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| P2.1 | Customer: name, phone, address, notes | **Done** | `src/modules/customers/schema.ts` (`createCustomerSchema`); Prisma `Customer` in `prisma/schema.prisma`; form `src/modules/customers/components/customer-form.tsx`. |
| P2.2 | Vehicle: registration unique per garage, normalised uppercase without spaces | **Done** | `normaliseRegistration` + unique `@@unique([garageId, registrationNumber])` in schema; service duplicate checks in `src/modules/vehicles/service.ts`; DB unique via `isUniqueConstraintError`. |
| P2.3 | Vehicle: make, model, year, odometer, insurance / PUC / fitness expiry | **Done** | `createVehicleSchema` in `src/modules/vehicles/schema.ts`; Prisma `Vehicle` fields. |
| P2.4 | List with search by name, phone or registration | **Done** | `searchCustomers` in `src/modules/customers/repo.ts` (name/phone/registration OR); UI `CustomerSearch` + `src/app/(app)/customers/page.tsx`. |
| P2.5 | Create and edit forms | **Done** | `customers/new`, `customers/[id]/edit`, `customers/[id]/vehicles/new`, `vehicles/[id]/edit`. |
| P2.6 | Detail page: service history empty + communication history placeholder | **Done** | `src/app/(app)/customers/[id]/page.tsx` — `serviceHistory` / `serviceHistoryEmpty` and `communicationHistoryPlaceholder`. |
| P2.7 | Layering: pages/actions → service → repo; Zod in schema.ts | **Done** | `src/app/actions/customers.ts`, `vehicles.ts` → `modules/*/service.ts` → `repo.ts`; Zod schemas present. |
| P2.8 | Tests: duplicate-registration + garageId filtering | **Partial** | `tests/customers-vehicles.test.ts` covers normalise, duplicate on create, cross-garage helpers. Gaps: update-path duplicate not tested; repos mocked — no live Postgres / `P2002` integration test. |
| P2.9 | All three language strings | **Done** | `customers` / `vehicles` namespaces in `messages/en.json`, `hi.json`, `gu.json` (keys aligned on this branch; 113 keys, no missing hi/gu). |

### ROADMAP 1.2 “Done when”

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| D1 | Add customers and vehicles | **Done** | Create flows above. |
| D2 | Search | **Done** | Search by name/phone/registration. |
| D3 | Edit | **Done** | Edit pages/forms. |
| D4 | History page | **Partial** | Customer detail has history *sections*, but service history is always empty copy (no real orders yet on this branch tip). Acceptable per Prompt 2 “empty for now”, but ROADMAP “history page” is only a placeholder. |
| D5 | Duplicate registration blocked per garage | **Done** | Service + unique constraint + tests (mocked). |

---

## 2. UI problems

| Area | Finding |
| --- | --- |
| Loading | No `(app)/loading.tsx` on this branch; list/detail rely on navigation without skeletons. |
| Empty | List empty copy may always read like a “no search matches” message even when `q` is unset (`customers.empty` on `customers/page.tsx`). Vehicle empty on detail: `noVehicles` — OK. |
| Error | Actions return English `"Something went wrong"` / `AppError.message` in places (`src/app/actions/customers.ts`, `vehicles.ts`). Zod failures become the same generic English string. |
| Hard-coded English | Action/error strings; Zod messages in schemas (`"Invalid year"`, etc.) can surface. |
| hi/gu | Feature message keys present and matched. |
| Mobile / desktop | Forms use `min-h-12` targets; content still in narrow `max-w-lg` shell inherited from auth (looks sparse at 1440px). |
| Vehicle detail | No read-only `/vehicles/[id]` page — vehicles only on customer detail + edit. |
| Dates | Customer detail uses `toLocaleDateString()` without an explicit locale tied to next-intl. |

---

## 3. Rule violations

| Rule | Status | Evidence |
| --- | --- | --- |
| Every query filters by session `garageId` | **OK** for module repos | `findCustomerById(garageId, …)`, `searchCustomers(garageId, …)`, vehicle repo always takes `garageId`. |
| Prisma only in `repo.ts` | **OK** for customers/vehicles modules | Leakage remains in shared `src/lib/otp.ts`, `auth.ts`, `audit.ts` (pre-existing). |
| Money floats | **N/A** | No money fields in this module. |
| Audit log for money/stock/approvals/roles | **N/A** for plain CRM CRUD | Customer/vehicle edits are not audited on this branch. |
| Zod on inputs | **Done** | Module schemas; actions pass FormData into services that `.parse`. |

---

## 4. Stubbed or fake features

- Service history on customer detail: **placeholder empty text** (intentional for Prompt 2).
- Communication history: **placeholder only**.
- Cross-garage test helpers (`getCustomerForGarageId`, etc.): test-oriented, not product UI.

---

## Summary verdict

Prompt 2 is **largely Done** on `feat/customers-vehicles`: solid layering, registration normalisation/uniqueness, search, CRUD pages, and matched i18n. Gaps: mocked isolation tests (no update-path duplicate / live DB), English action errors, empty-list copy wording, no vehicle detail route, no page-level loading/error routes, and history remains placeholder (allowed by the prompt, weak against a strict “history page” reading of ROADMAP).
