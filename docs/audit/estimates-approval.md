# Audit: Estimates and approval

Branch: `feat/service-orders` @ `a644d85` (estimates in `4b76cf9`)  
Scope: Prompt 5 in `docs/PROMPTS.md` and ROADMAP task **1.5** Done when.  
Date: 2026-10-22  

Be strict: if behaviour is incomplete, unproven, or only works in a mocked path, it is **Partial**.

---

## 1. Requirement checklist

### Prompt 5 (`docs/PROMPTS.md`)

| # | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| P5.1 | Estimates from inspection suggestions and order lines | **Done** | `createEstimate` in `src/modules/estimates/service.ts` collects order lines + suggested repairs; UI `create-estimate-form.tsx`. |
| P5.2 | Labour and parts with GST rate and HSN/SAC | **Done** | Line schema with `gstRatePercent`, `hsnOrSac`; defaults `DEFAULT_LABOUR_SAC` / `DEFAULT_PART_HSN` / GST options in `schema.ts`. |
| P5.3 | Per-line approval: Pending, Approved, Rejected | **Done** | `EstimateLineApprovalState`; `line-approval-form.tsx`. |
| P5.4 | Approval method (manual, phone, WhatsApp, online) + who recorded | **Done** | `EstimateApprovalMethod` enum; `EstimateApproval` rows with `method`, actor; recorded in `recordLineApproval` repo/service. |
| P5.5 | Revised estimates without deleting history | **Done** | `createEstimateRevision` supersedes prior (`supersededAt`) and increments `revisionNumber`; previous rows kept. Tested in `tests/estimates.test.ts`. |
| P5.6 | Show approval history | **Partial** | Current revision lists `current.approvals` on `src/app/(app)/orders/[id]/estimate/page.tsx`. Revision list shows metadata only — **no drill-down** into superseded revisions’ lines/approvals. |
| P5.7 | Totals: integer paise + per-line GST rounding | **Done** | `src/modules/estimates/totals.ts` + `lib/money` percentage helpers; unit tests for rounding and partial-approval splits. |
| P5.8 | Tests for totals and partial approval | **Done** | `tests/estimates.test.ts` — GST rounding, partial approval totals, create/approve/revision/cross-garage (mocked repos). |

### ROADMAP 1.5 “Done when”

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| D1 | Estimate with GST | **Done** | Create + totals. |
| D2 | Approve / partly approve / reject per line | **Done** | Line-level states + UI. |
| D3 | Revision for extra work | **Done** | Revision flow. |
| D4 | History kept | **Partial** | History kept in DB (supersede + approvals). Current-revision approval history UI **Done**; full history UI across revisions **Partial**. |

---

## 2. UI problems

| Area | Finding |
| --- | --- |
| Loading / error | No `(app)/loading.tsx` / `error.tsx`; NotFound/Forbidden → `notFound()`. |
| Empty | Copy when no sources / no estimate / empty approvals via i18n. |
| Hard-coded English | `src/app/actions/estimates.ts` still uses `"Something went wrong"` and may surface `AppError.message`. |
| hi/gu | `estimates` namespace present; key parity OK on tip. |
| Mobile | Forms stacked; approval controls `min-h-12`-style; usable but dense on small screens. |

---

## 3. Rule violations

| Rule | Status | Evidence |
| --- | --- | --- |
| `garageId` | **OK** | All estimate repos filter by `garageId`; service uses session. |
| Prisma only in repo | **OK** for module | |
| Money floats | **OK** | Paise integers; tests assert per-line GST rounding (not float across lines). |
| Audit | **Partial** | Estimate create/revision/approval write audit in repo transactions. Confirm coverage for every money-touching path — present for main estimate mutations. |
| Zod | **Done** | `src/modules/estimates/schema.ts`. |

---

## 4. Stubbed or fake features

- Online approval method is recorded as an enum value; there is **no customer Live Link approval path** yet (Prompt 9). Selecting `ONLINE` is staff-recorded, not a public self-serve flow.
- Part lines still do not pull live inventory SKUs/prices (inventory later).

---

## Summary verdict

Prompt 5 is the strongest of the mid-MVP set: **Done** for GST/paise totals, per-line approval with method/actor, revisions kept in DB, and dedicated tests. Remaining **Partial** items: approval history UX across superseded revisions, UI i18n of action errors, missing route loading/error boundaries, and “online” approval being staff-only until Live Link exists.
