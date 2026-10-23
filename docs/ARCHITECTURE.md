# Architecture

## Stack
- **App**: Next.js (App Router) with TypeScript, as a progressive web app
- **UI**: Tailwind CSS and shadcn/ui (`components.json`, CSS-variable tokens, `cn()`, cva, lucide-react). Components live in `src/components/ui`. Prefer `npx shadcn add` for primitives; modify those files when the design needs it, or add a new component in the same folder. Do not add a second overlay library (no Headless UI).
- **Database**: PostgreSQL with Prisma
- **Auth**: Auth.js (email or phone OTP), role in the session
- **Validation**: Zod on every API input
- **Jobs**: BullMQ with Redis (reminders, messages, digests)
- **Files**: S3-compatible storage (Cloudflare R2 or AWS S3 in production; local MinIO in Docker for development — see README). Photos are compressed in the browser before upload.
- **i18n**: next-intl with `en`, `hi`, `gu`
- **PDF**: server-side invoice PDFs
- **Tests**: Vitest for logic, Playwright for the main flows

Single deployable app (modular monolith). Do not split into services.

## Folder structure
```
src/
  app/                 # routes (grouped by module)
    (auth)/ (app)/ live/[token]/   # live/[token] is the public customer link
  modules/
    customers/ vehicles/ service-orders/ inspections/ estimates/
    inventory/ vendors/ purchases/ billing/ invoices/ payments/
    reminders/ reports/ team/ appointments/ settings/
    # each module: schema.ts (zod), service.ts (logic), repo.ts (db), components/
  lib/                 # db, auth, i18n, money, gst, audit, storage
  jobs/                # background workers
prisma/schema.prisma
messages/              # en.json hi.json gu.json
tests/
```
Rule: pages and API routes call `service.ts`. Services call `repo.ts`. Only repos touch Prisma.

## Multi-garage rules
- Every business table has `garageId`.
- Repos always receive a `garageId` from the session and always filter by it.
- Add Postgres row-level security as a second safety layer once the schema settles.
- Optional branches: `branchId` on orders, stock, cash register.

## Core tables (first version)
- `Garage`, `Branch`, `User` (role), `AuditLog`
- `Customer`, `Vehicle` (registration, make, model, odometer readings in `VehicleReading`)
- `ServiceOrder` (status, technician, bay, dates, complaint), `ServiceOrderLine` (labour or part)
- `Inspection`, `InspectionItem`, `Media`
- `Estimate`, `EstimateLine` (approval state per line), `EstimateApproval`
- `Part`, `StockMovement` (the only way stock changes), `StockReservation`
- `Vendor`, `PurchaseOrder`, `PurchaseOrderLine`, `GoodsReceipt`, `VendorBill`, `PurchaseReturn`
- `Invoice`, `InvoiceLine`, `CreditNote`, `Payment`, `Expense`, `CashRegisterDay`
- `Reminder`, `MessageLog`, `Appointment`, `LiveLink` (token hash, expiry, order)
- `Employee`, `Attendance`, `TimeEntry`

## Key technical decisions
1. **Money**: integer paise everywhere, helper in `lib/money.ts`. Round GST per line, then sum, and test it.
2. **Stock**: current quantity is computed from `StockMovement` rows (or a cached total updated in the same transaction). Never edit quantity directly.
3. **Transactions**: invoice finalization, stock changes and payments each run inside one database transaction.
4. **Invoice numbers**: allocated inside the finalization transaction with a per-garage counter row lock, to avoid gaps and duplicates.
5. **Live Link**: random 32-byte token, store only a hash, expiry date, read-only except approve and pay actions. Rate-limit it.
6. **Offline**: cache the job card and inspection capture in IndexedDB, then sync. Do this after Phase 1 basics work.
7. **AI**: put speech-to-text, structuring and scanning behind `lib/ai/*` interfaces so providers can be swapped. AI output is always a draft that a person confirms.
8. **Messages**: one `sendMessage` function with channels (WhatsApp, SMS, in-app). Log every send in `MessageLog`. Respect opt-out.
9. **Secrets**: only in environment variables. Provide `.env.example`, never real keys.
10. **Errors**: never show raw database errors to users. Log them with a request ID.

## Environments
Local: Docker Compose for Postgres, Redis, and MinIO (S3-compatible). Staging and production: managed Postgres, real S3/R2 credentials in env (not in `.env.example` secrets), daily backups, a restore test every month.
