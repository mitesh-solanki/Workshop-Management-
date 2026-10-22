# Audit: Project setup

Branch named: `origin/feat/project-setup` (tip = docs-only initial upload)  
Effective code for Prompt 0: present on later tips (`feat/auth-garages-roles`, `feat/service-orders`, `origin/main`)  
Scope: Prompt 0 in `docs/PROMPTS.md` and ROADMAP task **1.0** Done when.  
Date: 2026-10-22  

Be strict: if behaviour is incomplete, unproven, or only works in a mocked path, it is **Partial**.

---

## 1. Requirement checklist

### Prompt 0 (`docs/PROMPTS.md`)

| # | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| P0.1 | Next.js App Router, TypeScript strict | **Done** (on later tips) | `package.json` (`next`, `typescript`), `tsconfig.json` strict on `feat/service-orders` / auth tips. **Missing** on `origin/feat/project-setup` (only docs + PDF + rules). |
| P0.2 | Tailwind, shadcn/ui | **Partial** | Tailwind v4 via `@import "tailwindcss"` in `src/app/globals.css`. Minimal UI primitives / CVA present; no full shadcn component set under `src/components/ui` on the audited tips (mostly empty `.gitkeep` until later UI work). |
| P0.3 | Prisma + PostgreSQL | **Done** (later tips) | `prisma/schema.prisma`, migrations, `DATABASE_URL` in `.env.example`. |
| P0.4 | Zod | **Done** (later tips) | Dependency + module `schema.ts` files. |
| P0.5 | next-intl (en, hi, gu) | **Done** (later tips) | `messages/en.json`, `hi.json`, `gu.json`, `src/i18n/*`. |
| P0.6 | Vitest and Playwright | **Done** (later tips) | `vitest.config.ts`, `playwright.config.ts`, scripts `test` / `test:e2e`. |
| P0.7 | `docker-compose.yml` for Postgres and Redis | **Done** (later tips) | `docker-compose.yml` — postgres + redis (+ MinIO added for Prompt 4). |
| P0.8 | `.env.example`, ESLint, Prettier | **Done** (later tips) | `.env.example`, eslint/prettier configs, scripts. |
| P0.9 | Scripts `dev`, `lint`, `typecheck`, `test` | **Done** (later tips) | `package.json` scripts. |
| P0.10 | Folder layout from `docs/ARCHITECTURE.md` | **Partial** | Module folders exist with many `.gitkeep` placeholders; structure matches the doc at a high level. |
| P0.11 | `lib/money.ts` integer paise helpers + unit tests | **Done** (later tips) | `src/lib/money.ts`, `tests/money.test.ts`. |
| P0.12 | Do not build features yet | **N/A on named branch** | Named branch has no app. Later branches intentionally add features. |

### ROADMAP 1.0 “Done when”

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| D1 | App runs locally | **Partial** | App exists on later branches; not verified in this audit run. Named `feat/project-setup` cannot run. |
| D2 | Lint, typecheck and tests pass | **Partial** | Scripts exist on later tips; this audit did not re-run CI on every tip. |
| D3 | Docker Postgres works | **Partial** | Compose file present; not runtime-verified here. |

---

## 2. UI problems

N/A for the named branch (no UI). On later tips, see feature audits.

---

## 3. Rule violations

N/A on named branch. Later tips introduce known layering exceptions (`src/lib/otp.ts`, `src/lib/auth.ts`, `src/lib/audit.ts` use Prisma outside `repo.ts`) — see auth audit.

---

## 4. Stubbed or fake features

- Named branch `feat/project-setup` is effectively a **docs stub**: `docs/*`, README, PDF, `.cursor/rules` only (7 files). Prompt 0 was never completed *on that branch*.

---

## Summary verdict

**`feat/project-setup` does not deliver Prompt 0.** Setup was absorbed into subsequent feature branches. Against the *repo as of Prompt 6* (`feat/service-orders` / `main`), Prompt 0 is largely **Done**, with **Partial** shadcn coverage and unproven local Docker/CI in this audit pass.
