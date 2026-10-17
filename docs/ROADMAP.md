# Roadmap

Work in this order. A task is finished only when every "Done when" item is true and the change is committed. Estimated times assume one person working with Cursor and are rough.

## Phase 0: Validate (calendar time, not coding)
- Visit 15 to 20 garages. Collect real job cards and vendor bills.
- Show a clickable prototype of the Live Link and voice job card to 10 owners.
- Gate: 10 garages agree to pilot.

## Phase 1: Core MVP (about 3 to 4 weeks)

| Task | Prompt | Done when |
| --- | --- | --- |
| 1.0 Project setup | 0 | App runs locally, lint, typecheck and tests pass, Docker Postgres works |
| 1.1 Auth, garages, roles, i18n | 1 | Owner signs up, creates a garage, invites staff; screens switch between English, Hindi and Gujarati; a user of one garage cannot read another's data (tested) |
| 1.2 Customers and vehicles | 2 | Add, search and edit customers and vehicles; history page; duplicate registration number blocked per garage |
| 1.3 Service orders | 3 | Create an order from a vehicle; complaints, technician, dates; status changes logged |
| 1.4 Inspection | 4 | Checklist with photo upload; suggested repairs saved |
| 1.5 Estimates and approval | 5 | Estimate with GST; approve, partly approve or reject per line; revision for extra work; history kept |
| 1.6 Workshop board | 6 | Columns by status; drag to change status; technician filter |
| 1.7 Inventory basics | 7 | Parts, stock in, stock out, low-stock alert; parts used on an order reduce stock |
| 1.8 GST billing and payments | 8 | Finalized invoice with correct GST and sequential number; PDF; partial and mixed payments; credit note; tests pass |
| 1.9 UPI link and Customer Live Link | 9 | Customer opens a link on a phone with no login, sees status and photos, approves lines, pays |
| 1.10 Excel and CSV import | 10 | Customers, vehicles and parts import with an error report |

Gate: 5 pilot garages use it daily for 4 weeks with correct invoices and payments.

## Phase 2: Operations (about 4 to 6 weeks)

| Task | Prompt | Done when |
| --- | --- | --- |
| 2.1 Vendors and purchases | 11 | Parts request becomes a purchase order; partial receipts raise stock; vendor outstanding correct |
| 2.2 Full inventory | 12 | Reservations, adjustments, batch and serial numbers, barcode scan |
| 2.3 Reminders | 13 | Service, document expiry and payment reminders sent on schedule and logged |
| 2.4 Appointments | 14 | Calendar, slots, reschedule and cancel |
| 2.5 Reports and dashboard | 15 | Sales, profit, stock, outstanding and technician reports agree with source data |
| 2.6 Team and expenses | 16 | Attendance, job time, expenses, cash register and daily closing |
| 2.7 Smart Due Reminders | 17 | Next service date predicted from odometer history, with a plain explanation |
| 2.8 Money Leak Alerts | 18 | Each alert type has a test case; owner digest generated daily |

Gate: pilots run billing and stock without paper, and leak alerts catch real losses.

## Phase 3: Signature AI (about 4 to 6 weeks)

| Task | Prompt | Done when |
| --- | --- | --- |
| 3.1 Repeat Problem and Warranty Autolink | 19 | Similar complaint links to earlier order; rework cost shown |
| 3.2 Speak-to-Job-Card | 20 | Voice note produces a draft that staff edit and confirm |
| 3.3 Bill and job-card scanning | 21 | Photo of a bill creates a draft purchase; photo of a job card creates a draft order |
| 3.4 Before and after photos | 22 | Optional photos attach to estimate lines and appear on the invoice |

Gate: most voice drafts need only small edits when tested with real recordings.

## Phase 4: Launch and scale (about 6 to 8 weeks)
AMC packages, loyalty rewards, multi-branch, attendance and payroll reports, owner chat on WhatsApp, vendor price memory, offline mode, security review, backups and monitoring, pricing and billing for your own customers.
