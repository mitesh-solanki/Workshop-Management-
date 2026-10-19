# Garage Management Software

Next.js App Router foundation for multi-garage workshop software (customers, service orders, GST billing, inventory). Specs and build prompts live in `docs/`.

## Stack

Next.js (App Router, TypeScript strict), Tailwind, shadcn/ui, PostgreSQL + Prisma, Zod, next-intl (`en` / `hi` / `gu`), Vitest, Playwright.

## Local setup

1. Install Node.js 20+.
2. Copy env: `copy .env.example .env` (Windows) or `cp .env.example .env`.
3. Start Postgres and Redis: `docker compose up -d`
4. Generate the Prisma client: `npx prisma generate`  
   If engine download fails with a certificate error on your network, retry with  
   `set PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1` (Windows) then `npx prisma generate`.
5. Install Playwright browsers when you need e2e: `npx playwright install chromium`
6. Run the app: `npm run dev`

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript `--noEmit` |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright (needs browsers + app) |

## Docs and Cursor workflow

| File | Purpose |
| --- | --- |
| `docs/PRODUCT_SPEC.md` | What to build |
| `docs/ARCHITECTURE.md` | Stack, folders, tables, technical rules |
| `.cursor/rules/garage.mdc` | Standing rules for every chat |
| `docs/ROADMAP.md` | Phased tasks with done checks |
| `docs/PROMPTS.md` | One prompt per task — paste into Agent mode |

Do one prompt at a time. After each, run lint, typecheck, and tests, then commit.

## What you must do yourself

- WhatsApp Business API access (approval takes time).
- Payment gateway (Razorpay or Cashfree) for UPI.
- Have a CA check GST invoice format before real customers use it.
- Test every phase with real garages.
