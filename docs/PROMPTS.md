# Cursor Prompts

Use Cursor in Agent mode. Start a new chat for each prompt. Replace nothing unless it is in [brackets]. Prompts 11 to 22 follow the same shape and are listed briefly; ask Cursor to follow the rules file.

Always end by checking: `npm run lint`, `npm run typecheck`, `npm test`, then run the app.

---

## Prompt 0: Project setup
Create a Next.js (App Router, TypeScript strict) project in this folder. Add Tailwind, shadcn/ui, Prisma with PostgreSQL, Zod, next-intl (en, hi, gu), Vitest and Playwright. Add `docker-compose.yml` for Postgres and Redis, `.env.example`, ESLint, Prettier, and scripts `dev`, `lint`, `typecheck`, `test`. Create the folder layout in `docs/ARCHITECTURE.md`. Add `lib/money.ts` (integer paise helpers: add, multiply by quantity, percentage with rounding, format as rupees) with unit tests. Do not build features yet.

## Prompt 1: Auth, garages, roles, languages
Read `docs/PRODUCT_SPEC.md` and `docs/ARCHITECTURE.md`. Build sign-up and login with Auth.js (email OTP is enough for now). A new user creates a Garage and becomes Owner. Owner can invite Manager, Technician and Accountant. Add Prisma models Garage, User, AuditLog. Add a `requireSession` helper that returns userId, garageId and role, and a `requireRole` helper. Build a basic app shell with a mobile bottom navigation, a language switcher (English, Hindi, Gujarati) and a settings page for garage name, address and GSTIN. Write tests proving that a user in garage A cannot read or change garage B's records.

## Prompt 2: Customers and vehicles
Build the customers and vehicles modules. Customer: name, phone, address, notes. Vehicle: registration number (unique per garage, normalised to uppercase without spaces), make, model, year, odometer, insurance, PUC and fitness expiry dates. Pages: list with search by name, phone or registration; create and edit forms; a detail page that shows service history (empty for now) and communication history placeholder. Follow the layering rules and add Zod schemas, tests for the duplicate-registration rule and `garageId` filtering, and all three language strings.

## Prompt 3: Service orders
Build service orders. From a vehicle, create an order with complaint text, requested services, odometer in, expected completion, assigned technician and bay. Statuses: Waiting, Inspection, In Progress, Waiting for Parts, Ready, Completed. Record every status change with who and when in the audit log. Add order lines for labour and parts (parts link to inventory later). Page: order detail with timeline. A Technician sees only orders assigned to them. Add tests for status rules and role limits.

## Prompt 4: Inspection
Add digital inspection to a service order. Configurable checklist (default items for brakes, tyres, battery, lights, fluids, suspension, AC), each item OK, Needs attention or Urgent, with notes, photos and short videos. Compress images in the browser before upload to S3-compatible storage (use a local MinIO container in Docker for development). Allow "suggested repair" lines with labour and part. Mobile first.

## Prompt 5: Estimates and approval
Build estimates from inspection suggestions and order lines: labour and parts with GST rate and HSN or SAC codes. Each line has its own approval state: Pending, Approved, Rejected. Record approval method (manual, phone, WhatsApp, online) and who recorded it. Support revised estimates for extra repairs without deleting history. Show the approval history. Totals use integer paise and per-line GST rounding. Write tests for totals and partial approval.

## Prompt 6: Workshop board
Build the workshop board: columns by status, cards showing registration, customer, technician, due time and priority. Drag a card to change its status (use the same service as the order page). Filter by technician. Show bay occupancy. Make it usable on a phone with a column switcher.

## Prompt 7: Inventory basics
Add parts (name, SKU, unit, purchase price, selling price, GST rate, HSN, low-stock level) and `StockMovement` (in, out, adjustment) as the only way stock changes. Current stock is derived from movements. Using a part on a service order creates an out movement in the same transaction. Show low-stock alerts on the dashboard. Add a direct sale of parts without a service order. Tests: stock never goes negative unless the garage setting allows it; concurrent use does not oversell.

## Prompt 8: GST billing and payments
Build invoices from approved estimate lines. Compute CGST and SGST for same-state sales and IGST otherwise. Allocate sequential invoice numbers per garage per financial year (April to March) inside the finalization transaction with a counter row lock. Finalized invoices cannot be edited; add credit notes for corrections and refunds. Add payments: cash, UPI, card, mixed, partial, with pending balance. Generate an invoice PDF with an English, Hindi or Gujarati label set. Tests: GST totals, rounding, number sequence under concurrent finalization, credit notes. Do not claim e-invoice support.

## Prompt 9: UPI link and Customer Live Link
Add a UPI payment (QR and payment link) through Razorpay or Cashfree [choose one] with webhook reconciliation that marks payments as paid exactly once. Build the Customer Live Link: a public page `/live/[token]` with a 32-byte random token (store only its hash), expiry and rate limiting. It shows status, inspection photos and videos, the estimate with approve or reject per line, the invoice and a pay button. It exposes no other customer data. Tests for expired, wrong and reused tokens.

## Prompt 10: Excel and CSV import
Import customers, vehicles and parts from CSV or Excel. Show a preview, map columns, validate each row, and give a downloadable error report. Import must be all-or-nothing per file, or allow skipping bad rows after confirmation. Provide sample files and tests.

## Prompts 11 to 22
For each task in `ROADMAP.md` (11 Vendors and purchases, 12 Full inventory, 13 Reminders, 14 Appointments, 15 Reports, 16 Team and expenses, 17 Smart Due Reminders, 18 Money Leak Alerts, 19 Repeat Problem and Warranty Autolink, 20 Speak-to-Job-Card, 21 Bill and job-card scanning, 22 Before and after photos), use this shape:

> Read `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md` and the "[task name]" row in `docs/ROADMAP.md`. Build only that task. Follow the project rules. List the tables and files you will change before coding. Add tests for the business rules. Finish with the "Done when" checklist and what remains.

For AI tasks (19 to 21), also say: "Put provider calls behind `lib/ai/*` interfaces, return drafts with a confidence note, and require a person to confirm. Include a way to run the feature against recorded samples so we can measure accuracy."

---

## Helpful follow-ups
- "Review this change against the project rules and list any violations."
- "Write Playwright tests for the flow we just built."
- "Find any query that does not filter by garageId."
- "Explain this error in plain language and fix it."
