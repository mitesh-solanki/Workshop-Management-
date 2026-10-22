# Audit: CSV import

Branch: `feat/csv-export`  
Scope: Prompt **10** in `docs/PROMPTS.md` and ROADMAP task **1.10** Done when.  
Date: 2026-10-22  

**Decision (2026-10-22):** Import is **CSV-only**. No `xlsx` package. Excel users use File → Save As → CSV. Export also uses hand-rolled `src/lib/csv.ts` (no CSV library).

Be strict: if behaviour is incomplete, unproven, or only works in a mocked / simulated path, it is **Partial**.

---

## 1. Requirement checklist

### Prompt 10 (`docs/PROMPTS.md`)

| # | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| P10.1 | Import **customers**, **vehicles** and **parts** from **CSV** (Excel via Save As → CSV) | **Done** | CSV-only: `parseTabularBuffer` + `parseCsvText` in `src/lib/tabular.ts` (no third-party parser); wizard accepts `.csv`; commit paths `importCustomersBatch` / `importVehiclesBatch` / `importPartsBatch` in `src/modules/data-import/repo.ts`. `.xlsx`/`.xls` rejected with `import.unsupported_type`. |
| P10.2 | Show a preview | **Partial** | After validate, preview step shows up to ~20 rows with valid/invalid status (`toValidationView` in `src/modules/data-import/service.ts`; UI table in `import-wizard.tsx`). No separate file-content preview before column mapping (dead `previewRows` removed). |
| P10.3 | Map columns | **Done** | Auto-suggest via `suggestColumnMapping` + `fieldsForEntity` aliases (`src/lib/tabular.ts`, `src/modules/data-import/fields.ts`); manual selects on map step (`import-wizard.tsx`); required-field check `assertRequiredFieldsMapped` (`schema.ts`). |
| P10.4 | Validate each row | **Done** (with gaps noted below) | `validateImportRows` in `src/modules/data-import/validate.ts` uses `createCustomerSchema` / `createVehicleSchema` / `createPartSchema`; vehicles resolve customer by phone and block existing regs; parts block existing SKUs and in-file duplicates. Re-run on commit in `commitImport` (`service.ts`). Gaps: customers are **not** checked against existing phones in the garage; `import.sku_exists` path has **no dedicated test**. |
| P10.5 | Downloadable error report | **Done** | `buildErrorReportRows` (`validate.ts`) → client CSV via `rowsToCsv` + blob download (`import-wizard.tsx` `downloadErrorReport`). Covered by `tests/data-import.test.ts` → `builds a downloadable error report from row errors`. |
| P10.6 | All-or-nothing **or** skip bad rows after confirmation | **Done** | Modes `all_or_nothing` / `skip_invalid` in `schema.ts`; UI radio + **Confirm import** (`import-wizard.tsx`); service enforces all-or-nothing when errors exist (`commitImport`). Proof: `tests/data-import-service.test.ts` → `refuses all-or-nothing when any row is invalid`, `imports only valid rows when skip_invalid is confirmed`. |
| P10.7 | Provide sample files | **Done** (CSV only) | `public/samples/customers-sample.csv`, `vehicles-sample.csv`, `parts-sample.csv`; linked from wizard `SAMPLE_HREF`. No Excel samples (acceptable if CSV samples satisfy “sample files”; Excel still unproven — see P10.1). |
| P10.8 | Tests | **Partial** | Unit: `tests/data-import.test.ts`, `tests/tabular.test.ts`, `tests/csv.test.ts`. Service (mocked repo): `tests/data-import-service.test.ts` (role block, modes). **Missing:** Excel parse test; live Postgres import / unique-constraint race; garage isolation for import; vehicles/parts `commitImport` happy path; `import.sku_exists` assertion. |

### ROADMAP 1.10 “Done when”

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| D1 | Customers import | **Partial** | End-to-end path exists (wizard → `parseImportFileAction` → validate → `commitImportAction` → `importCustomersBatch`). Commit proven only with **mocked** repo (`data-import-service.test.ts`). No DB integration test. Feature **uncommitted** on branch tip. |
| D2 | Vehicles import | **Partial** | Validation + phone lookup + registration uniqueness tested in `tests/data-import.test.ts`. Repo write + audit in `importVehiclesBatch`. **No** service/DB test that commits vehicles. |
| D3 | Parts import | **Partial** | Validation (rupees → paise, duplicate SKU in file) tested; opening stock creates `StockMovement` IN in `importPartsBatch`. **No** commit/service test for parts; Excel unproven. |
| D4 | With an error report | **Done** | Downloadable CSV error report in UI + unit test for `buildErrorReportRows`. |

### Supporting product / architecture expectations (Prompt 10 scope)

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| S1 | Layering: actions → service → repo; Zod in `schema.ts` | **Done** | `src/app/actions/data-import.ts` → `modules/data-import/service.ts` → `repo.ts`; Zod `validateImportInputSchema` / `commitImportInputSchema`. Row validation reuses entity Zod schemas. |
| S2 | Money as integer paise | **Done** | Parts prices via `rupeesToPaiseSchema` on `createPartSchema`; stored `purchasePricePaise` / `sellingPricePaise` Int in repo. Proof: `tests/data-import.test.ts` → `100.50` → `10050` paise. |
| S3 | Session `garageId` on all business queries | **Done** | Repo helpers take `garageId`; `where: { garageId }`; creates set `garageId` from session (`repo.ts`). Actions use `requireSession()` only. |
| S4 | Audit log on import / stock-adjacent writes | **Done** | `import.customers_completed` / `import.vehicles_completed` / `import.parts_completed`; per-part `inventory.part_created` with `source: "import"` (`repo.ts`). Opening stock as `StockMovement` in same transaction. |
| S5 | i18n en / hi / gu for UI chrome | **Done** (keys) | `dataImport` namespace: 80 keys, parity across `messages/en.json`, `hi.json`, `gu.json`. Error codes mapped in `src/lib/translate-error.ts`. |
| S6 | Role limits (settings import) | **Done** | Page forbids non-OWNER/MANAGER (`settings/import/page.tsx`); service `requireRole(..., ["OWNER","MANAGER"])`; settings card only if `canEdit` (`settings/page.tsx`). Proof: service test `blocks technicians from importing`. |
| S7 | Settings entry (PRODUCT_SPEC module 11) | **Done** | Card + link to `/settings/import` on `src/app/(app)/settings/page.tsx`. |

---

## 2. UI problems

| Area | Finding |
| --- | --- |
| Loading | Shared `(app)/loading.tsx` spinner only. Wizard uses `useTransition` + button `loading` / “Reading file…” — OK for client steps. No route-level skeleton under `settings/import/`. |
| Empty | Upload step is the empty start — OK. No dedicated empty-state component (acceptable for a wizard). If validation returns zero valid rows, commit is disabled / `import.no_valid_rows` — OK. |
| Error | Inline `role="alert"` for action failures (translated AppError codes). Shared `(app)/error.tsx` only — no import-specific `error.tsx`. **Row-level** errors shown as raw English `message` strings (see Hard-coded English). |
| Hard-coded English | `validate.ts`: `"Duplicate phone…"`, `"Customer phone is required"`, `"No customer with this phone…"`, `"Duplicate registration…"`, `"Registration already exists…"`, `"Duplicate SKU…"`, `"SKU already exists…"`. Zod defaults from `createCustomerSchema` (e.g. min length) are English and are **not** passed through `translateError` / Zod i18n helpers — they appear in the preview table and error CSV. Repo note `"Opening stock (import)"` stored and shown on stock history. CSV report headers `rowNumber` / `errors` left English in hi/gu JSON (intentional for spreadsheet headers, but not localised). |
| hi / gu | `dataImport` key trees match en. Residual English is runtime validation messages above, not missing JSON keys. Field labels in errors use English keys (`phone`, `sku`, …). |
| Mobile (360px) | `flex-wrap` steps; `min-h-11` tap targets; mapping/preview tables use `overflow-x-auto` — usable but horizontal scroll required. Entity help + mode radios stack — OK. |
| Desktop (1440px) | Wizard is full width within app shell `max-w-[1600px]` — does **not** look like a lone narrow column. Stats grid `sm:grid-cols-3` — fine. |
| Other | Preview table only shows first ~4 cells of valid rows (`slice(0, 4)`), so “preview” of good rows is thin. List pages have Export CSV beside Add. |

---

## 3. Rule violations

| Rule | Status | Evidence |
| --- | --- | --- |
| Every business query filters by session `garageId` | **OK** for this feature | `listCustomerPhoneIndex` / `listRegistrationSet` / `listSkuSet` / batch creates all scoped by `garageId` from session (`repo.ts` + `service.ts`). |
| Never take `garageId` from request body | **OK** | Actions: `requireSession()` only (`data-import.ts`). |
| Prisma only in `repo.ts` | **OK** | Prisma confined to `src/modules/data-import/repo.ts`. Service/actions/UI do not import `prisma`. |
| Money: no floats for stored amounts | **OK** | Int paise via `rupeesToPaiseSchema`; no float money columns written. |
| Stock changes only through `StockMovement` in a transaction | **OK** | Opening stock `tx.stockMovement.create` inside `importPartsBatch` transaction (same pattern as `inventory/repo.ts` `createPart`). Does **not** call `applyStockMovement` (locks / negative-stock checks) — acceptable for IN on a brand-new part, but diverges from the shared stock helper. |
| Audit log for money / stock / approvals | **OK** for import | Batch + per-part audits (see S4). |
| Zod on every input | **OK** | Validate/commit payloads parsed with Zod; rows via entity schemas. Parse action checks entity + non-empty `File` before service. |
| No hard-coded user-facing text | **Violation** | Row error `message` strings in `validate.ts` (and default Zod English for customers) shown in UI and downloaded report without `messages/*` keys. |
| Gaps / strict notes | **Partial** proofs | Garage isolation for import is **not** covered by a dedicated test (rely on `garageId` in repo). Concurrent duplicate SKU/reg at commit may throw Prisma unique errors — unlikely to be a friendly translated message. Customer phone duplicates across garage allowed (schema has index, not unique) — product gap, not a Prompt 10 must. |

---

## 4. Stubbed or fake features

| Item | Assessment |
| --- | --- |
| Excel (.xlsx / .xls) import | **Out of scope** — CSV-only; Excel via Save As → CSV. Non-CSV rejected. |
| File preview before mapping | **Removed** — unused `previewRows` dropped; validation-step preview remains. |
| Skip-invalid “confirmation” | **Real** — mode radio + Confirm import; not a separate confirm dialog, but matches prompt wording and is tested. |
| Commit / DB write path | **Implemented** in repo, but service tests **mock** batch functions — live import not proven in CI. |
| Vehicles/parts commit | **Not stubbed** in code, but **untested** at service layer (only customers mocked commit). |
| Sample files | **Real** CSV samples for all three entities. |
| Error report download | **Real** (client-side CSV blob). |
| ROADMAP row | Marks 1.10 **Done (`feat/csv-export`)** while import files are still **untracked / uncommitted** — status is ahead of the tree. |
| Out of scope (correctly absent) | Export of existing data, WhatsApp, Live Link pay, billing — not required by Prompt 10. |

---

## Summary verdict

Prompt 10 / ROADMAP 1.10 is **mostly built but not Done under a strict reading**: CSV import for customers, vehicles and parts with column mapping, row validation, all-or-nothing / skip-invalid modes, downloadable error report, samples, Owner/Manager gating, paise money, garage-scoped repos, audits, and en/hi/gu UI keys are present.

Mark **Partial** overall because: (1) Excel intentionally unsupported (CSV-only); (2) tests stop at unit + mocked service — **no live DB import**; (3) row errors are **hard-coded English**; (4) no pre-map file preview; (5) feature may still be uncommitted while ROADMAP says Done. List CSV export buttons now wired on customers / customer vehicles / parts.
