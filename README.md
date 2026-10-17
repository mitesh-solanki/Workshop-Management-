# Garage Management Software: Cursor Package

This package lets Cursor build the garage software step by step with the same plan every time.

## What is inside

| File | Purpose |
| --- | --- |
| `PRODUCT_SPEC.md` | What to build: modules, rules, signature features |
| `ARCHITECTURE.md` | Stack, folders, database tables, key technical rules |
| `.cursor/rules/garage.mdc` | Standing rules Cursor follows in every chat |
| `ROADMAP.md` | Phases broken into small tasks, each with a "done" check |
| `PROMPTS.md` | One prompt per task, in build order. Paste them into Cursor |

## How to set up (10 minutes)

1. Create an empty folder, e.g. `garage-software`, and open it in Cursor.
2. Copy these files into it. Keep `.cursor/rules/garage.mdc` at that exact path.
3. Put `PRODUCT_SPEC.md`, `ARCHITECTURE.md` and `ROADMAP.md` in a `docs/` folder.
4. Install Node.js 20+ and PostgreSQL (or use a free hosted Postgres such as Neon or Supabase).
5. Open Cursor chat in Agent mode and paste Prompt 0 from `PROMPTS.md`.

## How to work

- Do one prompt at a time. After each, run the app, check the "done" list in `ROADMAP.md`, then commit to git.
- If Cursor goes off the plan, tell it: "Follow `docs/ARCHITECTURE.md` and the project rules."
- Start a fresh chat for each prompt. The rules file and docs give it the context.
- Never skip the tests in a prompt. Money and stock bugs are costly later.

## Stack choice

This package assumes Next.js, TypeScript, PostgreSQL and Prisma. If your team prefers Django or another stack, ask Claude to convert `ARCHITECTURE.md`, the rules file and the prompts before you start.

## What you must do yourself

- Apply for WhatsApp Business API access early (approval takes time).
- Open a payment gateway account (Razorpay or Cashfree) for UPI links.
- Have a chartered accountant check the GST invoice format before real customers use it.
- Test every phase with real garages. Cursor cannot do this.
