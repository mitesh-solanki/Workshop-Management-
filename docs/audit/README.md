# Branch / prompt audits

Strict audits against `docs/PROMPTS.md` and `docs/ROADMAP.md` “Done when” rows.  
Statuses: **Done** / **Partial** / **Missing**. If unsure, marked Partial.

| Prompt | ROADMAP | Primary branch audited | Doc |
| --- | --- | --- | --- |
| 0 | 1.0 Project setup | `origin/feat/project-setup` (docs only) + setup as it exists on later tips | [project-setup.md](./project-setup.md) |
| 1 | 1.1 Auth, garages, roles, i18n | `feat/auth-garages-roles` | [auth-garages-roles.md](./auth-garages-roles.md) |
| 2 | 1.2 Customers and vehicles | `feat/customers-vehicles` @ `86f738c` | [customers-vehicles.md](./customers-vehicles.md) |
| 3 | 1.3 Service orders | `feat/service-orders` @ `a644d85` | [service-orders.md](./service-orders.md) |
| 4 | 1.4 Inspection | same (`feat/service-orders`) | [inspections.md](./inspections.md) |
| 5 | 1.5 Estimates and approval | same | [estimates-approval.md](./estimates-approval.md) |
| 6 | 1.6 Workshop board | same | [workshop-board.md](./workshop-board.md) |

Also present but not a product prompt: `feat/playwright-e2e-smoke-tests` (Playwright smoke coverage on top of merged service-orders work).

**Note:** Prompts 3–6 were developed on one long-lived `feat/service-orders` branch (later merged to `main`). Prompt 0’s *named* branch never received the Next.js app; setup artifacts landed with later feature work.

Date of this pass: 2026-10-22.

Extra findings from follow-up branch audits ([customers-vehicles](ecc06e95-b578-4c3a-831b-e5fe8241a158), [service-orders prompts 3–6](f5d91330-71c3-4dc7-b5c6-c5e08059ddcb)) were merged into the per-prompt files above (empty-copy wording, vehicle detail gap, inspection notes UI, estimate revision history UX, mobile board drag quirks). No separate combined `prompts-3-6-*.md` was added — use the split files instead.
