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

## Prompt 11: Surface gap pass (invoices, payments, estimates, live links as real modules)

Read `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md`, `docs/audit/feat-gst-billing-payments.md`, `docs/audit/feat-upi-customer-live-link.md`, `docs/audit/estimates-approval.md` and the Prompt 11 onward contract. Prompts 8, 9 and 5 built their logic inside the job card. Do not rebuild the logic. Add the missing top-level modules on top of the existing services, and write the Surface Map first.

Build:

1. **Invoices module** at `/invoices`: list all invoices for the garage with columns number, date, customer, vehicle registration, order link, total, paid, pending, status (Draft, Finalized, Partly paid, Paid, Credit-noted). Filters: status, date range (this month, last month, financial year, custom), customer, payment status. Search by invoice number, customer name, phone, registration. Totals strip above the list (billed, collected, pending for the filtered rows). Detail page `/invoices/[id]` with lines, GST split, payments, credit notes, refunds, PDF download (language choice), print, share link, audit timeline, and a link back to the service order. Add "Create invoice" from this page by choosing a completed or ready order with approved estimate lines.
2. **Payments module** at `/payments`: all payments and refunds (cash, UPI, card, mixed), with method, reference, who recorded, invoice link, and status (Pending UPI, Paid, Failed). Filters by method, date and status. Add a **Pending payments** tab listing customers who owe money, oldest first, with days overdue, and a "Record payment" action. Add payment receipts: generate a receipt PDF (en, hi, gu) for each payment and show receipt number (sequential per garage per financial year, same locked-counter approach as invoices).
3. **Credit notes** list as a tab inside `/invoices` with its own detail page and PDF.
4. **Estimates module** at `/estimates`: all estimates across orders with status tabs (Awaiting approval, Partly approved, Approved, Rejected, Revised), age, customer, vehicle, total, and approved amount. A **Pending approvals** queue is the default tab. Detail opens the existing estimate view and shows full revision history including lines and approvals of superseded revisions (this was Partial in the estimates audit).
5. **Live Links** page at `/live-links` under Settings or Orders (decide in the Surface Map): list active, expired and revoked links with order, created by, expiry, last viewed time and view count; revoke and renew actions. Add last-viewed tracking without storing customer data.
6. Fix known gaps from the audits that belong to these pages: block double-billing the same estimate lines on a second invoice, add payment note field to the UI, add expire/fail handling for stale PENDING UPI links, show unavailable reasons as one generic message but log the real reason, replace `toLocaleString()` with locale-aware helpers, add `loading.tsx` and `error.tsx` for each new route.
7. Dashboard: add widgets for today's collections, pending payments total, invoices awaiting payment, and estimates awaiting approval. Each links to the filtered list.
8. Nav: add Invoices, Payments and Estimates to the sidebar and mobile menu (Accountant sees Invoices and Payments but not workshop settings; Technician sees none of them).

Tests: invoice list filters and totals match source rows; pending-payments ageing; receipt number sequence under concurrent payments (live Postgres); double-billing guard; role matrix; garage isolation for every new query; Playwright: nav click to Invoices, filter to Pending, open invoice, record payment, see it in Payments.

Done when: an owner can find any invoice, payment, estimate or live link without opening an order; pending money is visible on the dashboard and in one list; receipts and credit notes download as PDF.

## Prompt 12: Settings completion (rates, packages, hours, invoice design)

Read the contract, `docs/PRODUCT_SPEC.md` module 11 and `docs/audit/auth-garages-roles.md`. Settings must become a real section with sub-pages, not one form. Write the Surface Map first.

Build under `/settings`: **Garage profile** (name, address, GSTIN, state, logo upload, contact), **Labour rates** (named rates, default per hour or per job, SAC and GST), **Service packages** (name, included labour and parts, price, GST; apply a package to an estimate in one click), **Working hours and holidays** (weekly hours, holiday calendar, used later by appointments), **Invoice design** (logo, footer text, bank and UPI details, terms, show or hide columns, language default; live preview that renders the real PDF), **Numbering and tax defaults** (default GST rates, default HSN and SAC, financial year start shown read-only), **Preferences** (allow negative stock, default language, currency format), **Integrations status** (email provider, WhatsApp/SMS provider, Razorpay keys present or missing, storage reachable, with a Test button for each that really sends or pings). Estimates and order lines must use labour rates and packages in their pickers.

Tests: package applied to an estimate creates correct lines and GST in paise; holiday and hours validation; integration Test buttons use a test double and show real success or error; role limits (only Owner edits integrations and invoice design); garage isolation; Playwright: edit invoice design and see it in the downloaded PDF.

Done when: a garage can set its own rates, packages, hours and invoice look, and those values are actually used by estimates, invoices and the future appointment calendar.

## Prompt 13: Vendors and purchases

Read the contract, the "Vendor and Purchase" module in `docs/PRODUCT_SPEC.md` and the "Vendors and purchases" row in `docs/ROADMAP.md`. Write the Surface Map first. This is a new module family with several top-level routes.

Build: **Vendors** `/vendors` (list, detail with contact, GSTIN, payment terms, outstanding, purchase history, bills, returns), **Parts requests** `/purchases/requests` (created from low stock, from an order line with unavailable stock, or manually; status Open, Ordered, Received, Cancelled; convert one or many requests into a Purchase Order grouped by vendor), **Purchase orders** `/purchases` (draft, sent, partly received, received, cancelled; PDF; email to vendor for real), **Goods receipts** (partial receipts, each creates `StockMovement` IN in one transaction and updates PO line received quantity), **Vendor bills** `/vendor-bills` (list with due date, amount, paid, outstanding; record vendor payments with method and reference; attach scanned bill file to S3), **Purchase returns** (reduce stock with OUT movement and create a debit note against the vendor bill), **Vendor outstanding** report page (ageing buckets). Add a "Vendor" and "last purchase price" field on parts. Stock never changes except through `StockMovement`.

Tests: partial receipts raise stock exactly once; receiving the same line twice cannot exceed ordered quantity unless confirmed; vendor outstanding equals bills minus payments minus returns (live Postgres); concurrent receipts; role matrix (Accountant sees bills, Technician sees nothing); isolation; Playwright: low stock, request, PO, partial receive, bill, pay.

Done when: a parts request becomes a PO, partial receipts raise stock, vendor outstanding is correct, and every step has its own list page.

## Prompt 14: Full inventory

Read the contract, the "Inventory" module in `docs/PRODUCT_SPEC.md` and the "Full inventory" ROADMAP row. Extend the existing inventory module; write the Surface Map first.

Build: **Stock reservations** (reserve parts against a service order; reserved stock reduces available but not on-hand; release on cancel; convert to OUT when used), **Stock adjustments page** `/inventory/adjustments` (list, reason codes, approval for large adjustments by Owner or Manager), **Stock transfers** between branches (only visible when the garage has more than one branch), **Batch and serial numbers** for parts flagged as tracked (receive with batch, issue by batch FIFO, serial required on issue), **Barcode** (generate labels as PDF, scan with the phone camera or a USB scanner into part search, order line picker and receiving), **Stock movement ledger** page `/inventory/movements` with filters by part, type, date, source document, and links to the source (order, sale, PO). Parts list shows on-hand, reserved and available.

Tests: reservation cannot exceed available; concurrent reserve and issue do not oversell (live Postgres); FIFO batch issue; serial uniqueness per garage; barcode lookup; adjustment approval rules; isolation; Playwright: reserve, issue, adjust, view ledger.

Done when: reservations, adjustments, batch and serial numbers and barcode scan work, and every stock change is visible in one ledger page.

## Prompt 15: Messaging and reminders

Read the contract, the "Reminders" module in `docs/PRODUCT_SPEC.md`, the "Reminders" ROADMAP row and `docs/audit/auth-garages-roles.md` (the earlier OTP and invite email problems must not repeat). Write the Surface Map first.

Build the **messaging foundation**: one `sendMessage` function with channels Email (Resend), WhatsApp and SMS behind `lib/messaging/`* provider interfaces, template registry per language (en, hi, gu), `MessageLog` for every attempt (queued, sent, delivered, failed with reason), opt-out per customer and channel, quiet hours from garage working hours, retry with backoff in BullMQ. WhatsApp and SMS need a real provider adapter and a sandbox mode; if no keys are set, the UI says so and nothing pretends to send. Then build **Reminders** `/reminders`: list with tabs (Due today, Upcoming, Sent, Failed, Opted out), rules for service due, appointment, insurance, PUC and fitness expiry, pending payment, and manual reminders; a daily BullMQ job creates reminders; staff can edit, snooze, send now or mark done. Add **Communication history** to the customer detail page (replace the placeholder) showing every `MessageLog` row. Add **Share buttons** that really send: share estimate, share live link, share invoice PDF and payment link by WhatsApp, SMS or email, from order, invoice and estimate pages. Add a **Messages log** page `/settings/messages` for Owner and Manager.

Tests: every send writes a log row; opted-out customer is never messaged; quiet hours defer sends; failed send retries then shows Failed with reason; job runs once per day per rule (live Redis and Postgres); template has all three languages; isolation; Playwright against Mailpit: create a reminder, send, see it in the log and in the customer history.

Done when: service, document expiry and payment reminders send on schedule and are logged, customer history shows real messages, and sharing from invoice, estimate and live link really sends.

## Prompt 16: Appointments and booking

Read the contract, the "Appointments" module in `docs/PRODUCT_SPEC.md`, the "Appointments" ROADMAP row, and Prompt 12 settings (working hours, holidays). Write the Surface Map first.

Build `/appointments` with **calendar views** (day, week, month; list view on phones), slot length and capacity per day from settings, create from customer and vehicle (or a new walk-in), assign technician and bay, reschedule, cancel with reason, no-show, and **convert to service order** in one click. Add an **Available slots** view. Add optional **public booking page** `/book/[garageSlug]` (rate limited, captcha-free honeypot, shows only free slots, collects name, phone, registration, service wanted; creates a pending appointment that staff confirm). Reminders from Prompt 15 send confirmation and day-before messages. Dashboard widget for today's appointments and Workshop board shows converted orders.

Tests: no double-booking beyond capacity (live Postgres, concurrent); holidays and hours respected; timezone handling for Asia/Kolkata; convert keeps customer, vehicle and complaint; public page exposes no other customer data; rate limit; isolation; Playwright: book, reschedule, convert to order.

Done when: staff can run the garage calendar, customers can optionally book, and an appointment becomes a service order without retyping.

## Prompt 17: Expenses, cash register and daily closing

Read the contract, the "Billing and Payment" module in `docs/PRODUCT_SPEC.md` (expenses, cash register, petty cash, daily closing, profit per order) and `docs/audit/feat-gst-billing-payments.md`. Write the Surface Map first.

Build **Expenses** `/expenses` (category, amount in paise, payment method, vendor optional, receipt photo, date, who recorded; categories managed in settings), **Cash register** `/cash-register` (opening balance, cash payments in, cash refunds out, expenses out, petty cash in and out, expected vs counted cash at close, difference with reason), **Daily closing** (cannot close twice; closing locks that day's cash entries; Owner can reopen with an audit note), **Customer advances** (take an advance against an order, apply it to the invoice later), **Discounts on invoices** (line and invoice level, with a reason, limit by role, audit log; high-discount flag for later leak alerts), and **Profit per service order** (revenue minus parts cost at purchase price minus labour cost if team costing exists) shown on the order and as a list `/reports/order-profit`. Add a **Daily owner summary** page and email: vehicles serviced, payments received by method, expenses, pending payments, unfinished work.

Tests: closing math in paise; closing twice blocked; cash entries after closing blocked; advances applied exactly once; discount limits by role; profit calculation against hand-checked fixture; live Postgres concurrency on closing; isolation; Playwright: record expense, take cash payment, close the day.

Done when: a garage can close the day with correct cash, see expenses and profit per order, and the owner gets a daily summary.

## Prompt 18: Team management

Read the contract, the "Team" module in `docs/PRODUCT_SPEC.md` and the "Team and expenses" ROADMAP row. Write the Surface Map first. The existing `/team` page only invites users; extend it into a real module.

Build: **Employee profiles** (role, phone, join date, salary type, documents), **Attendance** (check-in and check-out from phone, manual correction by Manager with audit note, monthly grid), **Shifts and leave** (shift templates, leave request and approval, leave balance), **Job time tracking** (technician starts and stops timer on an order line; timesheet per technician and per order), **Salary records** (monthly salary, advances, deductions, payment records; Owner and Accountant only; no payroll tax), **Technician productivity** (jobs done, average time vs estimate, rework count), and **Staff activity log** (searchable view of the audit log by user). Team list shows status (Active, On leave, Invited, Deactivated) and allows deactivate and role change with audit. Invite flow must really send email and allow resend and revoke (already built; keep it).

Tests: attendance cannot overlap; leave balance maths; timer cannot run on two orders at once; salary visible only to Owner and Accountant; technician sees only own attendance; isolation; Playwright: check in, run a job timer, view timesheet.

Done when: attendance, shifts, leave, job time and salary records work with correct role limits, and technician productivity numbers match source rows.

## Prompt 19: Reports and dashboard

Read the contract, the "Reports and Dashboard" module in `docs/PRODUCT_SPEC.md` and the "Reports and dashboard" ROADMAP row. Write the Surface Map first. Reports are read-only and must be computed from source tables, never from cached totals that can drift.

Build `/reports` as a hub with report pages: **Sales** (daily, weekly, monthly, by customer, by service type), **Profit** (per order, per day, per month), **GST summary** (outward tax by rate and state, CGST, SGST, IGST, credit notes netted; export for the CA as CSV), **Stock** (valuation, movement, low and dead stock), **Vendor outstanding**, **Customer pending**, **Technician performance**, **Average service completion time**, **Order profitability**. Every report has date range, branch filter, CSV export (hand-rolled `lib/csv.ts`) and print view. Rebuild the **Dashboard** by role: Owner (sales today and month, pending, cash, low stock, orders by status, appointments, alerts), Manager (workshop focus), Accountant (money focus), Technician (my jobs). Each widget links to the filtered list behind it.

Tests: each report total equals a hand-computed fixture and equals the sum of the underlying invoices, payments and stock rows (live Postgres); GST summary rounding per line; date ranges respect Asia/Kolkata and the April to March year; CSV export matches screen; role matrix; isolation; Playwright: open report, change range, export.

Done when: sales, profit, GST, stock, outstanding and technician reports agree with source data and every dashboard number opens its list.

## Prompt 20: Money Leak Alerts

Read the contract, signature feature 3 in `docs/PRODUCT_SPEC.md`, the "Money Leak Alerts" ROADMAP row and Prompts 14, 15, 17 and 19. Write the Surface Map first.

Build alert detectors, each as a pure function with its own test fixtures: **parts issued but not billed**, **labour done but not billed**, **high discounts** (above the garage threshold or role limit), **negative-margin jobs**, **stock mismatches** (ledger vs counted), **completed orders without invoice after N days**, **invoices unpaid after N days**, **cancelled or edited-after-approval estimates**. Build `/alerts` (list with severity, type, order or invoice link, amount at risk in paise, status Open, Acknowledged, Resolved, Dismissed with reason), alert settings (thresholds, which types are on), and a **daily owner digest** via the Prompt 15 messaging layer (email and optional WhatsApp) with amount at risk and top items. Dashboard widget shows open alerts and total at risk.

Tests: each detector has positive, negative and boundary cases; the daily job creates each alert once (idempotent); resolved alerts do not reappear unless the data changes; digest is generated and logged; role limits; isolation; Playwright: create an unbilled part, run the job, see the alert, resolve it.

Done when: every alert type has a test case, the owner digest is generated daily, and an owner can work through alerts from one page.

---

## Prompts 21 and beyond

Keep the ROADMAP order: 21 Smart Due Reminders, 22 Repeat Problem and Warranty Autolink, 23 Speak-to-Job-Card, 24 Bill and job-card scanning, 25 Before and after photos. Use the contract above plus this shape:

> Read `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md`, the "[task name]" row in `docs/ROADMAP.md` and the Prompt 11 onward contract. Write the Surface Map first, then build only that task. List the tables and files you will change before coding. Follow the project rules. Add tests for business rules, one live Postgres proof, and one Playwright flow from the nav. Finish with the report in contract section F.

For AI tasks (22 to 24), also say: "Put provider calls behind `lib/ai/*` interfaces, return drafts with a confidence note, and require a person to confirm. Include a way to run the feature against recorded samples so we can measure accuracy."

Update `docs/ROADMAP.md` numbering to match (new 2.0 "Surface gap pass" and 2.1b "Settings completion" before vendors) and mark old rows as moved, not done.

---

## Helpful follow-ups (add to the existing list)

- "List every entity in `prisma/schema.prisma` and tell me which ones have no top-level list page and nav entry."
- "Walk through the app as an Owner, a Manager, a Technician and an Accountant. For each, list the screens they can reach and any dead ends."
- "Find every user-facing string that is not read from `messages/*.json`."
- "Find every feature that says it sends something (email, SMS, WhatsApp, webhook) and show the code line and test that proves it really sends."

---

## Helpful follow-ups

- "Review this change against the project rules and list any violations."
- "Write Playwright tests for the flow we just built."
- "Find any query that does not filter by garageId."
- "Explain this error in plain language and fix it."

