# Audit: Workshop board

Branch: `feat/service-orders` @ `a644d85` (board in `cbef7eb`)  
Scope: Prompt 6 in `docs/PROMPTS.md` and ROADMAP task **1.6** Done when.  
Date: 2026-10-22  

Be strict: if behaviour is incomplete, unproven, or only works in a mocked path, it is **Partial**.

---

## 1. Requirement checklist

### Prompt 6 (`docs/PROMPTS.md`)

| # | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| P6.1 | Columns by status | **Done** | `workshop-board.tsx` renders a column per `BOARD_STATUSES`; page `src/app/(app)/workshop/page.tsx`. |
| P6.2 | Cards: registration, customer, technician, due time, priority | **Done** | `BoardCard` shows registration, customer name, technician, due, priority badge, bay. |
| P6.3 | Drag card to change status via same service as order page | **Done** | Drop calls `moveServiceOrderStatusAction` → `changeOrderStatus` (same as `updateServiceOrderStatusAction` in `src/app/actions/service-orders.ts`). Transition rules via `canTransitionStatus`. |
| P6.4 | Filter by technician | **Done** | Query `?technicianId=` + select on board; service `listOrdersForBoard` respects filter for non-technicians; technicians forced to own jobs. |
| P6.5 | Show bay occupancy | **Done** | `buildBayOccupancy` in `schema.ts` / service; bay chips section on board (`bayOccupancy`). |
| P6.6 | Phone usable with column switcher | **Done** | Mobile block with `columnSwitcher` select + single column; desktop shows all columns (`md+`). |

### ROADMAP 1.6 “Done when”

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| D1 | Columns by status | **Done** | As P6.1. |
| D2 | Drag to change status | **Partial** | HTML5 drag/drop works on desktop/tablet; mobile uses move buttons / column context more than drag. Same service used. Not Playwright-covered. |
| D3 | Technician filter | **Done** | As P6.4; unit tests for filter behaviour in `tests/service-orders.test.ts`. |

---

## 2. UI problems

| Area | Finding |
| --- | --- |
| Loading / error | No dedicated workshop `loading.tsx` / `error.tsx`. Board shows inline `error` state string from failed moves. |
| Empty | Per-column empty copy (`columnEmpty`); bay empty copy. |
| Hard-coded English | Move failures may show `AppError.message` / `"Something went wrong"` from action. |
| hi/gu | `workshop` namespace present; keys matched across en/hi/gu. |
| Mobile | Column switcher present; drag is weak on touch (mitigated by move controls). |
| Desktop | Multi-column board intentional; still inside narrow shell on this tip → horizontal scroll risk if many columns inside `max-w-lg` parent. **Partial layout concern** at 1440px if shell not widened. |

---

## 3. Rule violations

| Rule | Status | Evidence |
| --- | --- | --- |
| `garageId` | **OK** | Board data loaded through service with session garage. |
| Prisma only in repo | **OK** | Board is client UI over existing service/actions. |
| Money | **N/A** | |
| Audit | **OK** | Status changes still go through audited `changeOrderStatus` path. |
| Zod | **OK** | Status validated by existing order status schema/service. |

---

## 4. Stubbed or fake features

- None major for the board itself. Priority is real (`ServiceOrderPriority`) and shown.
- Touch drag-and-drop is effectively **degraded** to buttons (acceptable UX, but not true drag on phones).
- On mobile, cards may still be marked `draggable` while column drop is a no-op — can confuse touch users.
- No Playwright coverage for board drag/filter (only `tests/e2e/home.spec.ts` on this tip).

---

## Summary verdict

Prompt 6 is **mostly Done**: status columns, rich cards, technician filter, bay occupancy, shared status service for drag/drop, and a mobile column switcher. Mark drag-to-change **Partial** on touch devices and watch shell width causing cramped multi-column layout on desktop until the UI-foundation shell (`max-w-6xl` / sidebar) is merged onto this lineage.
