# Marketing Site — Designer Brief

**Working product name:** Garage Management Software  
*(Replace with the final brand name when decided.)*

## Purpose of this document

This document explains what the product does and how garage staff use each module. Use it as the source of truth for features and claims on the marketing site. Do not invent modules, integrations, or claims that are not listed here.

This is not a brief for the logged-in workshop app UI.

---

## Product snapshot

**One-line pitch:** One system for the full workshop visit — customer, vehicle, job card, inspection, estimate, parts, GST bill, UPI payment, and follow-up reminders.

**Who it is for:** Owners and staff of independent, multi-brand garages (two-wheelers and four-wheelers). Busy floors, phone-first staff, Hindi/Gujarati/English speaking teams.

**Languages:** English, Hindi, Gujarati.

**Core idea:** Every vehicle visit is one **Service Order** (Job Card). Inspection, estimate, parts, invoice, and payments all attach to that one visit.

**Optional channel:** WhatsApp messages for approvals and reminders. WhatsApp is optional, not the whole product.

---

## Roles

| Role | What they care about |
| --- | --- |
| Owner | Full picture: money, GST bills, staff, reports, growth |
| Manager | Smooth intake, estimates, customer approvals, workshop flow |
| Technician | Clear jobs, inspection on phone, status updates, less paperwork |
| Accountant | Correct GST invoices, payments, outstanding, daily closing |

Technicians only see their jobs. Accountants see money, not workshop settings. Owners see everything.

---

## How the flow works (basic steps)

One vehicle visit runs through these steps. Everything hangs off one Job Card.

1. **Book (optional)** — Customer books a slot on the appointments calendar, or walks in without a booking.
2. **Find or add customer and vehicle** — Staff search by name, phone, or registration. If new, they create the customer and vehicle. They can check past service history and document expiry (insurance, PUC, fitness).
3. **Open a Job Card** — Staff create a Service Order for this visit: complaints, required services, assigned technician, expected completion time. Optional check-in receipt and voice note.
4. **Inspect** — Technician runs the digital checklist, takes photos/videos, and adds suggested repairs with parts and labour.
5. **Estimate and get approval** — Manager builds a GST estimate from the inspection. Customer approves fully, partly, or rejects (in person, phone, WhatsApp, or Live Link). Extra work later needs a revised estimate.
6. **Do the work on the workshop board** — The Job Card moves across statuses: Waiting → Inspection → In Progress → Waiting for Parts → Ready → Completed. Manager watches technician load, deadlines, and bays.
7. **Get parts if needed** — Parts are issued from stock onto the Job Card. If stock is short, staff raise a parts request → purchase order → receive goods (stock goes up) → continue the job.
8. **Bill and collect payment** — When work is done, create the GST invoice from the Job Card. Customer pays cash, UPI, card, or mixed (including partial). Share invoice and receipt.
9. **Deliver the vehicle** — Mark the visit complete / delivered when the customer takes the vehicle.
10. **Follow up** — Reminders for next service, document expiry, pending dues, or the next appointment. Optional WhatsApp/SMS.
11. **Review the business** — Owner checks dashboard and reports: sales, profit, stock, outstanding, technician performance.

**Shortcut paths that still fit the same spine**
- Counter sale of a part with no Job Card (Inventory only).
- Customer uses the Live Link during steps 5–8 for status, photos, line approval, and UPI pay.
- Returning vehicle with a similar complaint can link to the earlier Job Card (Repeat Problem / Warranty Autolink).

---

## Modules

For each module: what it is, who uses it, how they use it, and the benefit.

---

### 1. Customer and Vehicle

**What it is**  
A garage CRM for people and their vehicles: contact details, registration numbers, service history, document expiry dates, and simple leads for new walk-ins or enquiries.

**Who uses it**  
Managers and owners. Technicians may look up a vehicle’s past work.

**How they use it day-to-day**
1. Walk-in or call: search by name, phone, or registration number.
2. Create or open the customer; add or select the vehicle (make, model, year, odometer).
3. Check insurance, PUC, and fitness expiry before promising a date.
4. Open past service history for that vehicle before starting a new job.
5. Capture a lead when someone enquires but has not booked yet.
6. Later, review communication history tied to that customer.

**Benefit**  
Know every customer and every vehicle — history, papers, and next visit — in seconds.

---

### 2. Service Order (Job Card)

**What it is**  
The job card for one vehicle visit. Complaints, required services, technician, expected completion, and optional check-in receipt and voice note all live here. Everything else in the visit hangs off this record.

**Who uses it**  
Managers create it and assign work; technicians execute it; owners review stuck jobs.

**How they use it day-to-day**
1. Open the vehicle and create a new Service Order for today’s visit.
2. Capture customer complaints and required services (oil change, brake job, diagnosis, and so on).
3. Assign a technician and set expected completion time.
4. Optionally print or share a check-in receipt.
5. Optionally attach a voice note of the customer’s complaint (especially useful in Hindi or Gujarati).
6. Move the same order through inspection, estimate, workshop, billing, and delivery — one record, no re-entry.

**Benefit**  
One Job Card for the whole visit — from gate to delivery.

---

### 3. Digital Inspection

**What it is**  
A structured inspection on the floor: checklist, photos and videos, suggested repairs, and recommended parts and labour — attached to the Service Order.

**Who uses it**  
Technicians (primary), reviewed by managers and shown to customers for trust.

**How they use it day-to-day**
1. Open the Service Order on a phone or tablet in the bay.
2. Work through the checklist for that vehicle type.
3. Shoot photos or short videos of wear, damage, or findings.
4. Add suggested repairs with parts and labour.
5. Save; the findings feed the estimate the customer will approve.
6. Customer can later see inspection media on the Live Link (see Signature features).

**Benefit**  
Show the problem, don’t just describe it — checklist, photos, and clear repair suggestions.

---

### 4. Estimate and Approval

**What it is**  
A GST-aware estimate of labour and parts. The customer can approve fully, partly, or reject. Extra work gets a revised estimate. Every approval is kept in history.

**Who uses it**  
Managers prepare estimates; customers approve; owners watch high discounts and pending approvals.

**How they use it day-to-day**
1. Build the estimate from inspection suggestions and planned labour/parts.
2. See line totals with GST.
3. Share for approval: in person, by phone, WhatsApp, or online via the customer link.
4. Customer approves all lines, some lines, or rejects.
5. If more damage is found mid-job, send a revised estimate for the extra work.
6. Workshop only proceeds on approved lines; history stays attached to the order.

**Benefit**  
Transparent estimates with GST — approve line by line, before the work starts.

---

### 5. Workshop Board

**What it is**  
A live board of active Job Cards so the floor knows what is waiting, in inspection, in progress, stuck on parts, ready, or completed. Includes technician load, priorities, deadlines, and bay occupancy.

**Who uses it**  
Managers and owners for floor control; technicians for their queue.

**How they use it day-to-day**
1. Open the board in the morning to see today’s active work.
2. Filter by technician or scan bay occupancy.
3. Move a Job Card when status changes (Waiting → Inspection → In Progress → Waiting for Parts → Ready → Completed).
4. Spot jobs waiting on parts or missing the deadline.
5. Rebalance workload when one technician is overloaded.
6. Mark Ready when the vehicle can be delivered.

**Statuses:** Waiting, Inspection, In Progress, Waiting for Parts, Ready, Completed.

**Benefit**  
See the whole workshop at a glance — who is busy, what is stuck, what is ready.

---

### 6. Inventory

**What it is**  
Live parts stock for the garage: on-hand quantity, low-stock alerts, reservations for a Job Card, parts requests, stock adjustments/transfers, optional batch/serial and barcode, and direct counter sales without a Job Card. Stock falls when parts are used or sold and rises when goods are received.

**Who uses it**  
Parts counter / store person, managers, technicians requesting parts, accountants watching value.

**How they use it day-to-day**
1. Maintain a parts catalogue (name, SKU, prices, GST/HSN, reorder level).
2. When a Job Card needs a part, issue it from stock (or reserve it for that order).
3. If stock is short, raise a parts request (feeds purchasing).
4. Get low-stock alerts before the shelf goes empty.
5. Adjust stock for counts, damage, or transfers; optional barcode scan.
6. Sell a part over the counter without opening a Job Card when needed.

**Benefit**  
Know what is on the shelf — and stop jobs stalling for missing parts.

---

### 7. Vendor and Purchase

**What it is**  
Buying workflow: vendors, parts requests turned into purchase orders, receiving (full or partial), vendor bills and outstanding balances, and purchase returns. Receiving updates stock automatically.

**Who uses it**  
Managers and owners for purchasing; store staff for receiving; accountants for vendor outstanding.

**How they use it day-to-day**
1. Keep vendor contacts and GSTIN.
2. Collect open parts requests from the floor or low-stock list.
3. Create a purchase order for a vendor from one or more requests.
4. When goods arrive, record full or partial receipt — stock increases.
5. Record the vendor bill and payments against it; see what is still owed.
6. Handle purchase returns when goods are wrong or damaged.

**Benefit**  
From “we need this part” to purchase order, receipt, and vendor balance — without a spreadsheet.

---

### 8. Billing and Payment

**What it is**  
GST invoicing and collection for the visit: create, download, print, and share invoices; take cash, UPI, card, or mixed payments; support partial payments, discounts, refunds, credit notes, and receipts. Also expenses, cash register, daily closing, and profit per Service Order.

**Who uses it**  
Accountants, managers, owners. Managers may collect payment at delivery.

**How they use it day-to-day**
1. When work is done (and approved), generate a GST invoice from the Job Card.
2. Invoice numbers stay sequential per garage per financial year (April–March).
3. Share UPI QR or payment link; accept cash/card/mixed; allow partial payment.
4. Apply discounts carefully; use credit notes for corrections (finalized invoices are not edited).
5. Print or share the invoice and payment receipt with the customer.
6. Track expenses, cash register, and daily closing; see profit on each Job Card.

**GST:** CGST + SGST for same-state sales, IGST for other states; HSN/SAC on lines.

**Benefit**  
Correct GST invoices, UPI-ready payments, and clear money in / money out for every job.

---

### 9. Reminders

**What it is**  
Scheduled follow-ups: next service, appointments, document expiry (insurance / PUC / fitness), pending payments, plus optional WhatsApp/SMS, promotions, and loyalty nudges.

**Who uses it**  
Owners and managers for retention; accountants for payment follow-up.

**How they use it day-to-day**
1. After delivery, the system (or staff) schedules the next service reminder.
2. Warn customers before insurance, PUC, or fitness expires.
3. Remind about unpaid balances.
4. Send appointment reminders before the slot.
5. Optionally send via WhatsApp or SMS.
6. Run simple promotions or loyalty messages when the garage chooses.

**Benefit**  
Bring customers back before they forget you — service, papers, and pending dues.

---

### 10. Reports and Dashboard

**What it is**  
Owner-facing numbers: sales (daily / weekly / monthly), profit, stock movement, vendor outstanding, customer pending dues, technician performance, and average completion time.

**Who uses it**  
Owners primarily; managers and accountants for their slices.

**How they use it day-to-day**
1. Open the dashboard each morning for yesterday’s / today’s sales.
2. Check pending customer dues and vendor outstanding.
3. Review stock movement and low movers when planning purchases.
4. Compare technician performance and average job time.
5. Zoom to weekly or monthly sales and profit for decisions.
6. Dig into a weak day or a slow job without leaving the product.

**Benefit**  
Numbers you can trust — sales, profit, stock, and who is delivering on time.

---

### 11. Settings

**What it is**  
Garage setup: name, address, GSTIN, labour rates, service packages, invoice look, working hours and holidays, languages, Excel/CSV import, and optional multiple locations.

**Who uses it**  
Owners (and sometimes managers). Not a daily technician screen.

**How they use it day-to-day / at setup**
1. Enter garage details and GSTIN once.
2. Set labour rates and common service packages.
3. Choose invoice design defaults.
4. Set working hours and holidays for scheduling.
5. Import existing customers, vehicles, or parts from Excel/CSV.
6. Switch UI language (English / Hindi / Gujarati); add locations later if needed.

**Benefit**  
Set up once — your rates, GST details, hours, and data — then run the floor.

---

### 12. Team

**What it is**  
People management: profiles, roles (Owner / Manager / Technician / Accountant), attendance, shifts, leave, time on jobs, salary records, productivity, and activity log.

**Who uses it**  
Owners and managers.

**How they use it day-to-day**
1. Invite staff and assign a role.
2. Track who is on shift and attendance.
3. See time spent on jobs for productivity.
4. Record leave and basic salary records.
5. Review activity log when something changes on money or stock.
6. Keep technicians limited to their jobs; accountants limited to money screens.

**Benefit**  
Right access for every role — and a clear record of who did what.

---

### 13. Appointments

**What it is**  
Booking calendar with time slots, reschedule and cancel, and optional online booking for customers.

**Who uses it**  
Managers for the calendar; customers if online booking is enabled.

**How they use it day-to-day**
1. Open the calendar and see free slots for the day/week.
2. Book a customer and vehicle into a slot.
3. Reschedule or cancel when plans change.
4. Link the appointment into a Service Order when they arrive.
5. Optionally let customers book online.
6. Use appointment reminders so no-shows drop.

**Benefit**  
Fill the bays with a clear calendar — book, reschedule, remind.

---

### 14. AMC (optional)

**What it is**  
Annual maintenance packages: sell a package, track validity, and count remaining services.

**Who uses it**  
Owners and managers selling packages; staff redeeming a visit against the package.

**How they use it day-to-day**
1. Sell an annual package to a customer/vehicle.
2. Record validity period.
3. On each visit under AMC, consume one remaining service.
4. See how many services are left before renewal.
5. Prompt renewal when the package is ending.
6. AMC is optional growth capability, not the core product story.

**Benefit**  
Lock in yearly service packages — validity and remaining visits, clearly tracked.

---

## Signature features

These are the product differentiators.

---

### S1. Speak-to-Job-Card

**What it is**  
Staff record a voice note in Hindi, Gujarati, or English. The product drafts complaint, labour, and parts. A person must confirm before anything is saved.

**Who uses it**  
Managers and technicians at intake — especially when typing is slow or hands are dirty.

**How they use it**
1. Tap record on the Job Card.
2. Speak the customer’s complaint in their language.
3. Review the draft (complaint / labour / parts).
4. Edit if needed, then confirm to save.
5. Never auto-saves AI output without human confirmation.

**Benefit**  
Talk the Job Card in — Hindi, Gujarati, or English. You confirm before it saves.

---

### S2. Customer Live Link

**What it is**  
One secure link, no login. Customer sees job status, inspection media, approves or rejects each estimate line, pays by UPI, and later gets invoice and warranty info. The link uses a long random token and expires.

**Who uses it**  
Customers on their phone; managers send the link; owners get fewer status phone calls.

**How they use it**
1. Garage shares the Live Link for this visit.
2. Customer opens it on mobile — no account.
3. Sees live status and inspection photos/videos.
4. Approves or rejects estimate lines.
5. Pays via UPI when ready.
6. Later views invoice / warranty on the same style of link.

**Benefit**  
One link for status, photos, approvals, and UPI pay — no app download.

---

### S3. Repeat Problem and Warranty Autolink

**What it is**  
When a vehicle returns with a similar complaint, the product links to the earlier Job Card and shows rework cost and possible warranty.

**Who uses it**  
Managers at intake; owners reviewing rework cost.

**How they use it**
1. Create a new Job Card for a returning vehicle.
2. Similar complaint is detected against history.
3. See the earlier order, rework cost, and warranty hint.
4. Decide: warranty / goodwill / charge the customer — with context.
5. Avoid repeating paid diagnosis blindly.

**Benefit**  
Returning with the same problem? See the last job, rework cost, and warranty risk.

---

### S4. Smart Due Reminders

**What it is**  
Next service date predicted from each vehicle’s odometer history — not only a fixed calendar interval — with a plain explanation.

**Who uses it**  
Owners and managers running retention; customers receive the reminder.

**How they use it**
1. Odometer readings accumulate across visits.
2. System predicts when that vehicle is due again.
3. Shows a simple reason (“based on your km history”).
4. Sends reminder at the right time.
5. Improves on one-size-fits-all “every 6 months” messaging.

**Benefit**  
Reminders based on how that vehicle actually runs — not a fixed calendar only.

---

### Coming later (not current launch features)

Evidence Cards, Vendor Price Memory, Owner Chat on WhatsApp, bill and job-card scanning.  
Do not present these as available features unless product marketing says otherwise.

---

## Do not claim

- Native mobile apps (iOS/Android stores)
- Full accounting suite
- Government e-invoicing integration
- Insurance claims workflow
- Payroll tax

---

## Product language and accuracy rules

1. Use garage language: Job Card, Estimate, Delivered, bay, parts — not database terms (entities, schemas, transactions).
2. Staff often work on phones on the workshop floor.
3. English, Hindi, and Gujarati are first-class product languages.
4. AI is assistive: voice drafts and predictions need human confirm — never claim AI runs the garage alone.
5. One visit = one Job Card.
6. Do not invent modules, payment providers, or pricing tiers unless product provides them separately.
7. GST and UPI behaviour must match what the product actually does.
