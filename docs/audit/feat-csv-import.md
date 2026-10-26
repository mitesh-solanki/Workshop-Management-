# Audit: CSV / Excel import

Branch: `feat/csv-import`  
Scope: Prompt **10** in `docs/PROMPTS.md` and ROADMAP task **1.10** Done when.  
Date: 2026-10-26  

Working tree at audit time includes uncommitted import UI/service changes on top of `51dac56`. Be strict on missing product behaviour; **mocked service tests** that match this repo’s existing pattern are accepted proof (see product decision below).

**Overall verdict: Done for Prompt 10 / ROADMAP 1.10** — customers, vehicles and parts import (CSV + native Excel) with mapping, validation, modes (including update_existing), samples, i18n row errors and error report. **Product decision (2026-10-26):** mocked service/repo tests matching existing repo patterns are enough; no separate live-Postgres import suite required. Remaining notes (map-first preview, Settings card, redirect-only `/import` URLs) are out of Prompt 10 scope or UX preferences, not blockers.

---

## 1. Requirement checklist

### Prompt 10 (`docs/PROMPTS.md`)

| # | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| P10.1 | Import **customers**, **vehicles** and **parts** from **CSV or Excel** | **Done** | Entities: `src/modules/data-import/schema.ts` (`IMPORT_ENTITIES`). Parse CSV + `.xlsx`/`.xls` via `xlsx`: `src/lib/tabular.ts` (`parseTabularBuffer`, `parseExcelBuffer`). Wizard `accept`: `import-wizard.tsx`. Commit: `importCustomersBatch` / `importVehiclesBatch` / `importPartsBatch` in `src/modules/data-import/repo.ts`. Excel unit proof: `tests/tabular.test.ts` → `parses Excel .xlsx into headers and rows`. Dependency: `package.json` → `"xlsx"`. |
| P10.2 | Show a preview | **Partial** | After validate, preview step with stats + table (`import-wizard.tsx` preview step; `toValidationView` in `service.ts`, ~20 rows preferring invalid). Valid rows show all non-empty cells. No raw file preview before column mapping (map-first by design). |
| P10.3 | Map columns | **Done** | Auto-suggest: `suggestColumnMapping` (`tabular.ts`) + `fieldsForEntity` aliases (`fields.ts`); manual selects on map step (`import-wizard.tsx`); required-field check `assertRequiredFieldsMapped` (`schema.ts`). |
| P10.4 | Validate each row | **Done** | `validateImportRows` in `validate.ts` uses `createCustomerSchema` / `createVehicleSchema` / `createPartSchema`; vehicles resolve customer by phone and can create customer; duplicate phone/reg/SKU in-file and in-garage checks. Re-run on commit in `commitImport` (`service.ts`). |
| P10.5 | Downloadable error report | **Done** | Client rebuilds CSV with translated `formatRowError` (`import-wizard.tsx` `downloadErrorReport`). Unit: `tests/data-import.test.ts` → `builds a downloadable error report from row errors`. |
| P10.6 | All-or-nothing **or** skip bad rows after confirmation | **Done** | Modes `all_or_nothing` / `skip_invalid` / `update_existing` in `schema.ts`; UI radios + amber skip-confirm panel (`import-wizard.tsx`). Service enforces all-or-nothing when errors exist (`commitImport`). Proof: `tests/data-import-service.test.ts` → `refuses all-or-nothing when any row is invalid`, `imports only valid rows when skip_invalid is confirmed`. |
| P10.7 | Provide sample files | **Done** | `public/samples/{customers,vehicles,parts}-sample.csv` present; wizard download link uses `dataImport.downloadSample` (`import-wizard.tsx`). Proof: `tests/import-samples.test.ts` → `%s sample maps all required fields`. |
| P10.8 | Tests | **Done** | Unit: `tests/data-import.test.ts`, `tests/tabular.test.ts`, `tests/import-samples.test.ts`. Service with mocked repo (same pattern used elsewhere in this repo): `tests/data-import-service.test.ts` — role block, all-or-nothing, skip_invalid, update_existing (customers + parts), vehicles commit happy path. **Product decision:** no separate live-Postgres import tests required. |

### ROADMAP 1.10 “Done when”

*Customers, vehicles and parts CSV import with an error report (Excel via Save As → CSV)*

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| D1 | Customers import | **Done** | Path: list `ImportModal` → actions → `commitImport` → `importCustomersBatch`. Commit proof: `tests/data-import-service.test.ts` (mocked repo — accepted). |
| D2 | Vehicles import | **Done** | Validation + phone lookup + registration uniqueness in `tests/data-import.test.ts`. Repo write + audit in `importVehiclesBatch`. Service commit: `tests/data-import-service.test.ts` → `imports vehicles and creates customer when phone is new` (mocked repo — accepted). |
| D3 | Parts import | **Done** | Validation (rupees → paise) tested; opening stock creates `StockMovement` IN in `importPartsBatch`. Commit: mocked create / `update_existing` in `data-import-service.test.ts` (accepted). |
| D4 | With an error report | **Done** | Downloadable CSV error report in UI (translated messages) + unit test for `buildErrorReportRows`. |
| D5 | Excel via Save As → CSV | **Done** (and exceeded) | ROADMAP wording allows CSV-only after Save As; this branch also imports native Excel (`tabular.ts`). CSV path remains valid. |

### Supporting product / architecture expectations (Prompt 10 scope)

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| S1 | Layering: actions → service → repo; Zod in `schema.ts` | **Done** | `src/app/actions/data-import.ts` → `modules/data-import/service.ts` → `repo.ts`; Zod `validateImportInputSchema` / `commitImportInputSchema`. Row validation reuses entity Zod schemas. |
| S2 | Money as integer paise | **Done** | Parts prices via entity `createPartSchema` / `rupeesToPaiseSchema`; stored `purchasePricePaise` / `sellingPricePaise` Int in `repo.ts`. Proof: `tests/data-import.test.ts` (rupees → paise). |
| S3 | Session `garageId` on all business queries | **Done** | Repo helpers take `garageId`; `where: { garageId }`; creates set `garageId` from session (`repo.ts`). Actions use `requireSession()` only — never body `garageId`. |
| S4 | Audit log on import / stock-adjacent writes | **Done** | Batch: `import.customers_completed` / `import.vehicles_completed` / `import.parts_completed`; per-part create/update and per-customer update; vehicle-import customer create audits (`repo.ts`). New customers in customer-import: **batch audit only** (no per-create row). |
| S5 | i18n en / hi / gu for UI chrome | **Done** | `dataImport` namespace key trees match across `messages/en.json`, `hi.json`, `gu.json`. Row error codes translated via `rowErrors.*`; Zod `validation.*` messages via `errors` namespace in wizard `formatRowError`. |
| S6 | Role limits | **Done** | List pages show Import only for OWNER/MANAGER (`customers/page.tsx`, `vehicles/page.tsx`, `inventory/page.tsx`); service `requireRole(..., WRITE_ROLES)`. Proof: service test `blocks technicians from importing`. Redirect import pages only call `requireSession()` (no role UI — they redirect). |
| S7 | Settings entry (PRODUCT_SPEC module 11) | **Partial** | Legacy `/settings/import` redirects to `/customers` (`settings/import/page.tsx`). Settings page no longer links to import. Entry is per-module list toolbar (+ empty-state Import CTA) — workable, but settings “Excel/CSV import” card is gone. Needs product decision to restore. |

---

## 2. UI problems

| Area | Finding | Status |
| --- | --- | --- |
| Loading | Shared app `loading.tsx` only. Wizard uses `useTransition` + button `loading` / “Reading file…” — OK for modal steps. No Skeleton on import routes (routes are redirects). List pages keep Suspense + Skeleton for tables. | **Partial** (acceptable for modal wizard; no route-level chrome) |
| Empty | Upload step includes sample download. List empty states include Import CTA next to create (`customers` / `vehicles` / `inventory` pages). | **Done** |
| Error | Inline `role="alert"` for action failures (translated AppError codes via `translateError`). Row-level errors use `rowErrors.*` / `errors.validation.*` in UI and downloaded report. | **Done** |
| Hard-coded English | Custom row errors use stable codes (`import.duplicate_phone_in_file`, etc.) with en/hi/gu keys. Zod entity schemas emit `validation.*` keys translated in the wizard. Repo stock note `"Opening stock (import)"` remains English internal history text (same pattern as inventory `"Opening stock"`). | **Partial** (UI Done; stock movement note still English) |
| hi / gu | `dataImport` key parity OK including specific duplicate phone/reg/SKU keys, `customer_phone_required`, `row_invalid`. | **Done** |
| Mobile (360px) | Modal `w-[calc(100%-1rem)]`, sticky step header on small screens, `min-h-11` tap targets, map/preview cards under `md` — generally OK. Mapping/preview tables need horizontal scroll on phone. | **OK** with scroll |
| Desktop (1440px) | Modal/dialog wizard — not a full-bleed admin page. Upload step has choose file + sample download. List pages remain full-width shell — OK. | **Done** (for modal entry) |
| Page chrome | Dedicated routes `customers/import`, `vehicles/import`, `inventory/import`, `settings/import` are **redirect stubs** — no title, description, breadcrumb, or primary button on those URLs. Real UX is `ImportModal` on list pages. Needs product decision for full pages. | **Partial** |

---

## 3. Rule violations

| Rule | Status | Evidence |
| --- | --- | --- |
| Every business query filters by session `garageId` | **OK** for this feature | `listCustomerPhoneIndex` / `listRegistrationSet` / `listSkuIndex` / batch creates & updates all scoped by `garageId` from session (`repo.ts` + `service.ts`). |
| Never take `garageId` from request body | **OK** | Actions: `requireSession()` only (`data-import.ts`). |
| Prisma only in `repo.ts` | **OK** | Prisma confined to `src/modules/data-import/repo.ts`. Service/actions/UI do not import `prisma`. |
| Money: no floats for stored amounts | **OK** | Int paise via rupees→paise schemas; no float money columns written. |
| Stock changes only through `StockMovement` in a transaction | **OK** | Opening stock `tx.stockMovement.create` inside `importPartsBatch` `$transaction`. Does **not** call shared `applyStockMovement` (locks / negative-stock) — acceptable for IN on a brand-new part, but diverges from the shared stock helper. |
| Audit log for money / stock / approvals | **OK** for import | Batch + per-part / update audits (see S4). |
| Zod on every input | **OK** | Validate/commit payloads parsed with Zod; rows via entity schemas. Parse action checks entity + non-empty `File`. |
| No hard-coded user-facing text | **OK** for import UI | Row errors go through `messages/*` via codes. Stock note on movements is internal English (see §2). |
| Gaps / strict notes | **OK** (waived) | Dedicated live-DB / garage-isolation import test **not required** (product decision 2026-10-26). Session `garageId` scoping remains in repo code. Concurrent duplicate SKU/reg at commit may still surface as Prisma unique errors — edge case, not a Prompt 10 blocker. |

---

## 4. Stubbed or fake features

| Item | Assessment |
| --- | --- |
| Sample CSV files | **Real** — three files under `public/samples/` + wizard download + `import-samples.test.ts`. |
| Dedicated `/…/import` pages | **Stub** — each page only `requireSession()` + `redirect` to the list. Real import is modal-only. Product decision pending. |
| `update_existing` mode | **Real** — backend + wizard radios for customers/parts (`import-wizard.tsx`); service tests cover customers and parts. |
| Excel import | **Real** — native `.xlsx`/`.xls` via `xlsx`, not a stub. |
| Skip-invalid confirmation | **Real** — amber confirm panel before commit; tested. |
| Commit / DB write path | **Real** in `repo.ts`; service tests mock batch helpers — **accepted** as sufficient proof (no separate DB suite). |
| Vehicles commit | **Done** — service test `imports vehicles and creates customer when phone is new` (`data-import-service.test.ts`). |
| Error report download | **Real** (client-side CSV blob with translated messages). |
| Settings import card | **Removed / redirected** — not a fake feature; entry moved to list toolbars + empty states. Restore needs product decision. |
| Out of scope (correctly absent) | Live Link, UPI, billing, WhatsApp — not required by Prompt 10. |

---

## Summary

| Lens | Verdict |
| --- | --- |
| Prompt 10 | **Done** — P10.1–P10.8 met (P10.2 map-first preview is intentional UX, not a missing feature). Mocked service tests accepted. |
| ROADMAP 1.10 “Done when” | **Done** — customers, vehicles, parts CSV/Excel import with error report; samples; mocked commit proof accepted. |
| Ship-ready under project rules | **Yes** for Prompt 10. Optional later: Settings import card (PRODUCT_SPEC §11), full `/import` pages instead of redirects — neither required by Prompt 10. |

**Product decision (2026-10-26):** mocked tests following existing repo patterns are enough; do **not** add a separate live-Postgres import test suite.

Compared with earlier audit pass: sample files restored and linked; row error i18n fixed; `update_existing` exposed in wizard; empty-list Import CTAs added; vehicles commit service test added; live-DB requirement waived.
