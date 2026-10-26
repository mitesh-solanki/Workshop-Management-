# Cursor Prompts

Use Cursor in Agent mode. Start a new chat for each prompt. Replace nothing unless it is in [brackets]. From Prompt 11 onward follow the short contract below (detail in `.cursor/rules/surface.mdc`).

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

---

# Prompts 11 onward

Sources in brackets: Spec / Arch / Roadmap / PDF. Do not invent beyond those docs — list gaps at the end instead.

## Contract (full copy lives in `.cursor/rules/surface.mdc` — always on)

Not a separate chat. Applies when you run Prompt 11+. Short version:

1. **Surface first** — flow map + own list/detail/nav/roles for every record users will look for later. Wait for confirmation before coding.
2. **Only what’s listed** — no extra pages, tables, PDFs, settings, integrations. Ask before any new provider.
3. **Real only** — no stubs; sends must really send and log.
4. **Garage rules** — `garageId` from session, paise, `StockMovement`, audit, Zod, en/hi/gu.
5. **Proof** — for stock/money/numbering/concurrency, hit the **same local Postgres** (`DATABASE_URL` / docker) for real, not mocks; isolation per new table; one Playwright from nav. No separate test database.
6. **Finish** — Done / Partial / Missing + lint, typecheck, test. Do not start the next prompt.

---

## Prompt 11: Vendors and purchases

Read `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md` and the "Vendors and purchases" row in `docs/ROADMAP.md`. Build vendors and purchases as their own module with their own pages. Vendors: a list and a detail page with contact details, GSTIN, purchase history, bills and the amount outstanding. Parts requests: staff can request a part that is out of stock, from the low-stock list, from an order line whose stock is short, or by hand, and can see which requests are still open and which became a purchase order. Purchase orders: turn one or more requests into a purchase order for a vendor, with a list page, a detail page and a clear view of pending and partly received orders. Receiving: record a full or partial receipt against a purchase order; each receipt adds stock through a `StockMovement` IN in the same transaction and updates the received quantity on the order line. Vendor bills: record a bill, record payments against it, and show the outstanding amount per vendor and in total. Purchase returns: return parts to a vendor, which reduces stock through a `StockMovement` OUT and reduces what is owed on the bill. Owner and Manager see everything, the Accountant sees bills and outstanding, the Technician sees none of it. Do not build purchase order PDFs, emailing vendors or bill scanning. Tests: partial receipts raise stock exactly once; you cannot receive more than was ordered; vendor outstanding equals bills minus payments minus returns; concurrent receipts keep stock correct; role limits.

## Prompt 12: Full inventory

Read `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md` and the "Full inventory" row in `docs/ROADMAP.md`. Extend the existing inventory module. Reservations: reserve a part against a service order; reserved stock lowers available stock but not on-hand stock, a cancelled reservation is released, and using the part turns it into the normal stock-out. The part list and detail pages show on-hand, reserved and available. Adjustments: a page listing every stock adjustment with its reason, created only through `StockMovement`. Batch and serial numbers: a part can be marked batch-tracked or serial-tracked; receiving records the batch or serial numbers, and issuing a serial-tracked part requires a serial number. Barcode scanning: scan a barcode with the phone camera or a keyboard-style scanner to find a part, add it to an order line and pick it when receiving; ask me which scanning library to use before coding. Do not build stock transfers between locations, barcode label printing or new reports. Tests: a reservation cannot exceed available stock; concurrent reserve and use does not oversell; releasing a reservation restores availability; a serial number cannot be used twice; role limits.

## Prompt 13: Reminders and messages

Read `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md` and the "Reminders" row in `docs/ROADMAP.md`. Ask me which WhatsApp and SMS provider to use before coding. Build one `sendMessage` function with the channels WhatsApp, SMS and in-app. Every send is written to `MessageLog` with its status and failure reason, and opted-out customers are never messaged. WhatsApp and SMS are optional: when no provider is configured, tell the user so and do not fake a send. Add a settings page for the WhatsApp and SMS provider details. Build reminders for service due, vehicle document expiry (the insurance, PUC and fitness dates already on the vehicle) and pending payments, created and sent on schedule by a BullMQ job. Add a reminders page where staff can see what is due, sent or failed, create a manual reminder, send one now or mark it done. Replace the communication history placeholder on the customer page with that customer's real message log. Let staff send an estimate, an invoice or the Live Link to the customer through `sendMessage`. Do not build appointment reminders yet, promotions, loyalty rewards or email as a channel. Tests: every send writes a log row; an opted-out customer is never messaged; a failed send is logged with its reason; the daily job never creates the same reminder twice; role limits.

## Prompt 14: Appointments

Read `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md` and the "Appointments" row in `docs/ROADMAP.md`. First add a settings page for weekly working hours and a holiday list, because they decide which slots are available. Then build appointments: create one for a customer and vehicle with a date and time slot, reschedule it and cancel it, with a list page and a detail page. Add a calendar of upcoming bookings and a view of available workshop slots; on a phone show a list instead of a grid. Let staff create the service order from an appointment without retyping the customer and vehicle. Send an appointment reminder through the messaging from Prompt 13. Do not build online booking by customers. Tests: a slot cannot be booked twice; holidays and non-working hours are not offered; rescheduling and cancelling free the slot; creating an order keeps the customer and vehicle; role limits.

## Prompt 15: Reports and dashboard

Read `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md` and the "Reports and dashboard" row in `docs/ROADMAP.md`. Build read-only reports computed from the source tables, never from stored totals. Reports: daily, weekly and monthly sales; profit per service order (invoice taxable amount minus the purchase cost of the parts used, shown on the order and in a report) and overall business profit; stock movement; vendor outstanding; customers with pending payments; technician performance from completed orders; and average vehicle service completion time. State your definition of profit in your reply so I can correct it. Rebuild the dashboard to show today's workshop and business numbers by role: the Technician sees only their own jobs, the Accountant sees money. Every number must open the list or report behind it. Do not add exports or any report not listed. Tests: each report total equals a hand-checked example and equals the sum of the invoices, payments, stock movements and bills behind it; date ranges and the April to March year; role limits.

## Prompt 16: Team management

Read `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md` and the "Team and expenses" row in `docs/ROADMAP.md`. Extend the existing team page, which only invites users. Add employee and technician profiles with list and detail pages; attendance; shifts and leave; job time tracking where a technician starts and stops time on a service order, with a timesheet per technician and per order; salary and payment records visible only to the Owner and Accountant; technician productivity; and a staff activity log page that shows the audit log by staff member. Add job time to the technician performance report from Prompt 15. Do not build payroll tax. Tests: attendance entries cannot overlap; leave maths; a timer cannot run on two orders at once; salary is visible only to the Owner and Accountant; a technician sees only their own attendance and time.

## Prompt 17: Expenses, cash register and daily closing

Read `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md`, the "Team and expenses" row in `docs/ROADMAP.md` and the Daily Owner Summary item in the requirement PDF. Build daily expense tracking: record, list and view expenses with amount in paise, date, payment method and who recorded it. Build a cash register page for one day showing opening cash, cash received from payments, cash refunds, expenses paid in cash and petty cash in and out. Build daily cash closing: count the cash, compare it with the expected amount and close the day; a closed day cannot be closed twice or changed without an audit note. Build the Daily Owner Summary: vehicles serviced, payments received, expenses, pending payments and unfinished work for a day. Tests: cash register maths in paise; closing twice is blocked; entries after closing are blocked; concurrent closing; role limits for Owner and Accountant.

## Prompt 18: Smart Due Reminders

Read `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md` and the "Smart Due Reminders" row in `docs/ROADMAP.md`. Predict each vehicle's next service date from its odometer history in `VehicleReading` instead of using a fixed interval. Show the predicted date with a plain-language explanation on the vehicle page, and feed the prediction into the service reminders from Prompt 13. Tests: predictions for a steady driver, a heavy driver, a vehicle with one reading and a vehicle with none; the explanation text for each case; a reminder is created from a prediction.

## Prompt 19: Money Leak Alerts

Read `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md` and the "Money Leak Alerts" row in `docs/ROADMAP.md`. Build each alert as its own tested function: parts issued but not billed, unbilled labour, negative-margin jobs and stock mismatches. Skip the high-discounts alert because invoice discounts are not built; list it as remaining. Add an alerts page listing open alerts, each linked to its order or invoice, with a way to mark it reviewed. Send the Owner a daily digest through the messaging from Prompt 13. Tests: each alert has a case that triggers it, a case that does not and a boundary case; the daily job creates an alert only once; the digest is generated and logged.

## Prompt 20: Repeat Problem and Warranty Autolink

Read `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md` and the "Repeat Problem and Warranty Autolink" row in `docs/ROADMAP.md`. Put any AI provider call behind a `lib/ai/*` interface, return a draft with a confidence note, and require a person to confirm; ask me which provider to use before coding. When a vehicle returns with a similar complaint, suggest the earlier service order and let staff confirm the link. Show the rework cost of the linked orders. Let staff record a warranty period on a repair or part line, and show on a returning vehicle's order when an earlier line may still be under warranty. Include a way to run the matching against recorded sample complaints so we can measure accuracy. Tests: similar and unrelated complaints against the sample set with the accuracy printed; a link is never saved without confirmation; rework cost maths in paise; warranty dates.

## Prompt 21: Speak-to-Job-Card

Read `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md` and the "Speak-to-Job-Card" row in `docs/ROADMAP.md`. Put speech-to-text and structuring behind `lib/ai/*` interfaces, return a draft with a confidence note, and require staff to confirm; ask me which providers to use before coding. On a new service order, let staff record a voice note in Hindi, Gujarati or English. Turn it into a draft complaint, labour lines and parts lines that staff can edit and confirm before anything is saved. Include a way to run it against recorded samples so we can measure accuracy. Tests: sample recordings in all three languages with the error rate printed; nothing is saved without confirmation; the provider can be swapped without changing the order code.

## Prompt 22: Bill and job-card scanning

Read `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md` and the "Bill and job-card scanning" row in `docs/ROADMAP.md`. Use the same AI rules as Prompt 21. From a vendor's page, let staff upload a photo of a vendor bill; extract the details into a draft purchase from Prompt 11 and store the original bill. Let staff upload a photo of a handwritten job card to create a draft service order. Staff must review and confirm every draft before it is saved. Tests: sample bill and job-card photos with accuracy printed; nothing is saved without confirmation; the original file is stored per garage.

## Prompt 23: Before and after photos

Read `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md` and the "Before and after photos" row in `docs/ROADMAP.md`. Let mechanics optionally upload photos of the old and the replaced part on an estimate line; it must stay optional so it does not add work for them. Show those photos on the invoice that is shared with the customer. Tests: photos are optional; they attach to the right line; they appear on the invoice; garage isolation.

---

## How these prompts map to Roadmap rows

Spec modules 12 (Team) and 8 (expenses and cash) are separate modules, so Roadmap row 2.6 "Team and expenses" is two prompts. This table is guidance only; do not edit `docs/ROADMAP.md` from a prompt chat unless asked.


| Prompt | Roadmap row                                                    |
| ------ | -------------------------------------------------------------- |
| 11     | 2.1 Vendors and purchases                                      |
| 12     | 2.2 Full inventory                                             |
| 13     | 2.3 Reminders                                                  |
| 14     | 2.4 Appointments                                               |
| 15     | 2.5 Reports and dashboard                                      |
| 16     | 2.6 Team and expenses (team)                                   |
| 17     | 2.6 Team and expenses (expenses, cash register, daily closing) |
| 18     | 2.7 Smart Due Reminders                                        |
| 19     | 2.8 Money Leak Alerts                                          |
| 20     | 3.1 Repeat Problem and Warranty Autolink                       |
| 21     | 3.2 Speak-to-Job-Card                                          |
| 22     | 3.3 Bill and job-card scanning                                 |
| 23     | 3.4 Before and after photos                                    |


---

## Helpful follow-ups

- "Review this change against the project rules and list any violations."
- "Write Playwright tests for the flow we just built."
- "Find any query that does not filter by garageId."
- "Explain this error in plain language and fix it."
- "List every entity in `prisma/schema.prisma` and tell me which ones have no top-level list page and nav entry."
- "Walk through the app as an Owner, a Manager, a Technician and an Accountant. For each, list the screens they can reach and any dead ends."
- "Find every user-facing string that is not read from `messages/*.json`."
- "Find every feature that says it sends something (email, SMS, WhatsApp, webhook) and show the code line and test that proves it really sends."

