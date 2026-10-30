# Product Spec: Garage Management Software

## Goal
Help garage owners run daily workshop work in one place: customers, vehicles, service orders, inspection, estimates, parts stock, vendors, GST billing, UPI payments and reminders. Optional WhatsApp messages. Target users: independent multi-brand garages in Gujarat and other Tier-2 cities. Languages: English, Hindi, Gujarati.

## Core rule
The **Service Order** (Job Card) is the spine for workshop work, estimate (for now), parts used, invoice and payments. **Inspection** is first-class on Customer + Vehicle and may exist before a Job Card; it can be linked to a Job Card later or never. Estimate remains on the Job Card until a later phase.

## Workshop flow
Appointment (optional) -> Customer and Vehicle -> Inspection (optional) -> Estimate and Approval (via Job Card for now) / Job Card (with or without inspection) -> Workshop Board -> Parts and Vendors (if needed) -> Billing and Payment -> Delivery -> Reminders -> Reports

## Roles
Owner, Manager, Technician, Accountant. Technicians see only their jobs. Accountants see money, not workshop settings. Owners see everything.

## Modules

1. **Customer and Vehicle**: customer (name, phone, address), vehicle (registration number, make, model), service history, communication history, document expiry (insurance, PUC, fitness), leads (simple CRM).
2. **Service Order**: complaints, required services, check-in receipt (optional), assign technician, expected completion, voice note (optional).
3. **Digital Inspection**: checklist, photos and videos, suggested repairs, parts and labour. Own list/detail pages and Customer/Vehicle sections; Job Card optional.
4. **Estimate and Approval**: labour + parts + GST. Approval can be manual, phone, WhatsApp or online. Full, partial or rejected. Revised estimates for extra repairs. Approval history.
5. **Workshop Board**: live list of active orders. Statuses: Waiting, Inspection, In Progress, Waiting for Parts, Ready, Completed. Technician workload, priorities, deadlines, bay occupancy.
6. **Inventory**: live stock, low-stock alerts, reserve parts for an order, parts requests, transfers and adjustments, batch and serial tracking, barcode (optional), direct sale without a Service Order. Stock goes down when parts are used or sold and up when received.
7. **Vendor and Purchase**: vendors, parts request -> purchase order, vendor bills and outstanding, partial receipts, purchase returns, receiving updates stock.
8. **Billing and Payment**: GST invoices (create, download, print, share), UPI QR and links, cash/UPI/card/mixed, partial payments, discounts, refunds, credit notes, receipts, expenses, cash register, daily closing, profit per Service Order.
9. **Reminders**: service, appointment, document expiry, pending payment, optional WhatsApp/SMS, promotions and loyalty.
10. **Reports and Dashboard**: sales (daily, weekly, monthly), profit, stock movement, vendor outstanding, customer pending, technician performance, average completion time.
11. **Settings**: garage and GST details, labour rates, service packages, invoice design, working hours and holidays, multiple locations (optional), Excel/CSV import, languages.
12. **Team**: profiles, roles, attendance, shifts, leave, job time, salary records, productivity, activity log.
13. **Appointments**: calendar, time slots, reschedule, cancel, online booking (optional).
14. **AMC (optional)**: annual packages, validity, remaining services.

## Signature features (what makes us different)

| # | Feature | Rule |
| --- | --- | --- |
| 1 | Speak-to-Job-Card | Voice note in Hindi, Gujarati or English becomes a draft complaint, labour and parts. Staff must confirm before saving. |
| 2 | Customer Live Link | One link, no login. Shows status, inspection media, approve or reject each estimate line, pay by UPI, later invoice and warranty. Link token is long, random and expires. |
| 3 | Money Leak Alerts | Flag parts issued but not billed, high discounts, unbilled labour, negative-margin jobs, stock mismatches. Owner gets a daily digest. |
| 4 | Repeat Problem and Warranty Autolink | A returning vehicle with a similar complaint links to the earlier order and shows rework cost and possible warranty. |
| 5 | Smart Due Reminders | Predict next service from each vehicle's odometer history instead of a fixed interval. |

Later: Evidence Cards, Vendor Price Memory, Owner Chat on WhatsApp, bill and job-card scanning.

## Business rules
- Prices are in rupees, stored as integer paise. Never use floating point for money.
- GST: split CGST+SGST for same-state sales and IGST for other states. Each line has an HSN or SAC code and rate.
- Invoice numbers are sequential per garage per financial year (April to March) with no gaps.
- A finalized invoice cannot be edited. Corrections use a credit note.
- Stock never goes negative unless the garage turns on that setting.
- Every change to money, stock or approvals is written to an audit log with who and when.
- Every query is limited to the signed-in garage. Garages never see each other's data.

## Out of scope for now
Native mobile apps, full accounting, e-invoicing integration, insurance claims, payroll tax.
