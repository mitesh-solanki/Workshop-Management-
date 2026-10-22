# Garage Management Software

Next.js App Router foundation for multi-garage workshop software (customers, service orders, GST billing, inventory). Specs and build prompts live in `docs/`.

## Stack

Next.js (App Router, TypeScript strict), Tailwind, shadcn/ui, PostgreSQL + Prisma, Zod, next-intl (`en` / `hi` / `gu`), Vitest, Playwright.

## Local setup

1. Install Node.js 20+.
2. Copy env: `copy .env.example .env` (Windows) or `cp .env.example .env`.  
   `.env.example` keeps **production-style** S3 placeholders empty. For local photo/video uploads, uncomment the **Local MinIO** block at the bottom of `.env.example` into your `.env` (see below).
3. Start Postgres and Redis: `docker compose up -d postgres redis`
4. Generate the Prisma client and apply migrations: `npx prisma generate` then `npx prisma migrate dev`  
   If engine download fails with a certificate error on your network, retry with  
   `set PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1` (Windows) then `npx prisma generate`.
5. Configure Resend (required for development and production — see below).
6. Install Playwright browsers when you need e2e: `npx playwright install chromium`
7. Run the app: `npm run dev`

### Local MinIO (inspection photos / videos)

Official `minio/minio` Docker Hub images are no longer anonymously pullable. Compose uses `cgr.dev/chainguard/minio` instead.

1. Start storage: `docker compose up -d minio`
2. In `.env`, set the Local MinIO values from the commented block in `.env.example` (`S3_*` + `NEXT_PUBLIC_S3_ENDPOINT`).
3. API: http://127.0.0.1:9000 · Console: http://127.0.0.1:9001 (user/pass `minioadmin` / `minioadmin` for local only).
4. The app creates the `workshop` bucket on first upload — no separate init container.

**Production / staging:** leave the empty `S3_*` keys in `.env.example` as the template. Fill real Cloudflare R2 or AWS S3 values only in the server `.env` (never commit secrets).

## Email (Resend)

OTP codes and team invites are sent with **Resend** in both development and production. There is no console/SMTP mailer path.

1. Create an account at [resend.com](https://resend.com).
2. Verify a sending domain (DNS records), or while experimenting use Resend’s test sender `onboarding@resend.dev` (only delivers to your own Resend account email).
3. Create an API key under **API Keys** and set in `.env`:
   - `RESEND_API_KEY=re_...`
   - `EMAIL_FROM="Workshop <you@your-verified-domain.com>"` (or `Workshop <onboarding@resend.dev>` for the test sender)
   - `APP_URL=http://localhost:3000` (invite links are `APP_URL/invite/[token]`)
4. Request a login OTP or send a team invite — the message should arrive in the inbox. The UI never shows OTP codes or raw invite tokens.
5. For Playwright e2e only, you may set `AUTH_DEV_OTP=123456` when `NODE_ENV` is not `production`. That fixed code is never used in production and is never displayed in the UI.

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
