# Audit: Digital inspection

Branch: `feat/service-orders` @ `a644d85` (inspections landed in `7a316a3` and follow-ups)  
Scope: Prompt 4 in `docs/PROMPTS.md` and ROADMAP task **1.4** Done when.  
Date: 2026-10-22  

Be strict: if behaviour is incomplete, unproven, or only works in a mocked path, it is **Partial**.

---

## 1. Requirement checklist

### Prompt 4 (`docs/PROMPTS.md`)

| # | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| P4.1 | Digital inspection on a service order | **Done** | `src/app/(app)/orders/[id]/inspection/page.tsx`; `src/modules/inspections/*`. |
| P4.2 | Configurable checklist with defaults: brakes, tyres, battery, lights, fluids, suspension, AC | **Partial** | Defaults in `DEFAULT_CHECKLIST_ITEMS` (`src/modules/inspections/schema.ts`); seeded in repo on create. Custom items via `add-checklist-item-form.tsx`. Defaults’ English labels stored in DB (`label: "Brakes"` etc.) — UI remaps known keys via `inspections.defaults.*`, but custom item labels stay raw. No per-garage checklist template settings. |
| P4.3 | Each item OK / Needs attention / Urgent | **Done** | Enum `InspectionItemResult`; UI on `checklist-item-card.tsx`. |
| P4.4 | Notes, photos and short videos | **Done** | Notes on items; `ItemMediaUploader` supports PHOTO + VIDEO. |
| P4.5 | Compress images in browser before upload | **Partial** | `compressImageFile` used for photos in `item-media-uploader.tsx` + `src/lib/compress-image.ts`. **Videos are not compressed**. |
| P4.6 | Upload to S3-compatible storage; MinIO in Docker for dev | **Partial** | `src/lib/storage.ts` (presigned put/get, bucket ensure); MinIO service in `docker-compose.yml` (Chainguard image). Requires env (`S3_*`); throws `STORAGE_NOT_CONFIGURED` if missing — works when configured, easy to miss locally. |
| P4.7 | Suggested repair lines with labour and part | **Done** | `SuggestedRepair` model; `suggested-repair-form.tsx`; service/repo create labour/part suggestions (no inventory FK yet). |
| P4.8 | Mobile first | **Partial** | Large controls, stacked layout on inspection page; inherits narrow app shell. No dedicated responsive audit/e2e. |

### ROADMAP 1.4 “Done when”

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| D1 | Checklist with photo upload | **Partial** | Checklist + photo upload path exists; depends on MinIO/env. |
| D2 | Suggested repairs saved | **Done** | Persisted via repo + audited; covered in `tests/inspections.test.ts`. |

---

## 2. UI problems

| Area | Finding |
| --- | --- |
| Loading / error routes | No `(app)/loading.tsx` or `error.tsx` on this tip. Forbidden/NotFound → `notFound()`. |
| Empty | New inspection seeds defaults (not empty). Media empty until upload. |
| Hard-coded English | Default checklist labels stored as English strings; action errors often English; storage error messages English. |
| hi/gu | `inspections` namespace present with matched keys. Default item *labels* still English in data. |
| Mobile | Uploader + cards usable; video capture depends on device. |

---

## 3. Rule violations

| Rule | Status | Evidence |
| --- | --- | --- |
| `garageId` filtering | **OK** | Inspection/media/repair repos always take `garageId`; technician assignment checks in service. |
| Prisma only in repo | **OK** for module | Storage uses AWS SDK (not Prisma). Shared lib Prisma leaks unchanged. |
| Money | **OK** | Suggested repair amounts via `rupeesToPaiseSchema` / integer paise. |
| Audit | **Done** for inspection mutations | `inspection.*` / media / suggested_repair actions via `writeAuditLog` in repo. |
| Zod | **Done** | `src/modules/inspections/schema.ts` including upload schemas. |

---

## 4. Stubbed or fake features

- Suggested **part** lines do not reference inventory Part rows (by design until Prompt 7).
- If `S3_*` unset, uploads fail — not a fake path, but local DevEx is brittle without compose + env.
- Default checklist labels are hard-coded English constants at seed time (UI remaps known keys).
- `Inspection.notes` exists on the Prisma model but **no inspection-level notes UI** on the page.
- Unit tests mock `@/lib/storage` — no live MinIO integration test.

---

## Summary verdict

Prompt 4 is **substantially implemented** (checklist, results, notes, photo compress + MinIO path, suggested repairs, tests). Mark **Partial** overall because: video not compressed, storage depends on env, checklist “configuration” is thin, English seeded labels, and no app-level loading/error UI.
