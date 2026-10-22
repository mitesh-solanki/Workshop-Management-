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
| P2.8 | Tests: duplicate-registration + garageId filtering | **Done** | `tests/customers-vehicles.test.ts`: create duplicate, update-path duplicate (`rejects updating a vehicle to a registration already used in the garage`), unchanged-registration update, `P2002` mapped via `isUniqueConstraintError` (`maps unique-constraint failures on update to duplicate registration`), plus garageId filtering. Repos still mocked (no live Postgres); service + unique-constraint mapping are covered. |
| P2.9 | All three language strings | **Done** | `customers` / `vehicles` namespaces in `messages/en.json`, `hi.json`, `gu.json` (keys aligned on this branch; 113 keys, no missing hi/gu). |

### ROADMAP 1.2 “Done when”

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| D1 | Add customers and vehicles | **Done** | Create flows above. |
| D2 | Search | **Done** | Search by name/phone/registration. |
| D3 | Edit | **Done** | Edit pages/forms. |
| D4 | History page | **Partial** | Customer detail and vehicle detail show history sections with empty copy only (`serviceHistoryEmpty` / placeholders). Prompt 2 allows “empty for now”; real order history needs Prompt 3 service orders. Not finished as a live history page. |
| D5 | Duplicate registration blocked per garage | **Done** | Service + unique constraint + tests (mocked). |

---

## 2. UI problems

| Area | Finding | Status |
| --- | --- | --- |
| Loading | `(app)/loading.tsx` uses `PageSpinner`. | **Done** — `src/app/(app)/loading.tsx` |
| Empty | List distinguishes no customers vs no search matches via `hasQuery`. | **Done** — `src/app/(app)/customers/page.tsx` (`emptyTitle` / `emptySearchTitle`); proof `customers empty copy keys` in `tests/customers-vehicles.test.ts`. |
| Error | Customers/vehicles actions use `translateError`. | **Done** — `src/app/actions/customers.ts`, `vehicles.ts` + `src/lib/translate-error.ts` (`vehicles.duplicate_registration`). |
| Hard-coded English (Zod) | Customer/vehicle schemas emit `validation.*` keys. | **Done** — `src/modules/customers/schema.ts`, `src/modules/vehicles/schema.ts`; keys in `messages/{en,hi,gu}.json`; proof `schema validation messages are i18n keys` in `tests/customers-vehicles.test.ts`. |
| hi/gu | Feature message keys present and matched. | **Done** |
| Mobile / desktop | Forms use `min-h-12` targets; wider shell may still feel sparse at 1440px (shared layout, out of scope here). | Partial (layout) |
| Vehicle detail | Read-only vehicle page. | **Done** — `src/app/(app)/vehicles/[id]/page.tsx`; linked from customer detail. |
| Dates | Customer/vehicle detail use `getLocale()` + `Intl.DateTimeFormat`. | **Done** — `customers/[id]/page.tsx`, `vehicles/[id]/page.tsx`. |

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

Prompt 2 is **largely Done** on `feat/customers-vehicles`: solid layering, registration normalisation/uniqueness (create + update paths tested), search, CRUD + vehicle detail, i18n Zod/action errors, and matched message keys. Remaining gap: **D4** history stays placeholder empty copy until service orders exist (Prompt 2 allows this). Isolation tests still mock repos (no live Postgres), which is acceptable for the Prompt 2 unit-test bar.
