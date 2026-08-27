# Boatogram

A marketplace MVP for booking Kerala houseboats (overnight) and Shikara rides
(hourly), with Customer / Owner / Admin roles, owner KYC + admin approval,
and a Razorpay Route marketplace split-payment flow (15% platform / 85%
owner).

## Stack

- **Next.js 16** (App Router, Turbopack, TypeScript), Tailwind CSS v4
- **PostgreSQL** via **Prisma ORM 7** (driver adapter: `@prisma/adapter-pg`)
- Cookie-based JWT sessions (`jose`), `bcryptjs` password hashing — no
  external auth provider
- **Razorpay** (`razorpay` SDK) behind a provider abstraction
  (`src/lib/payments/provider.ts`) for Route split settlements
- **Vitest** for unit tests

## Getting started

1. **Database**: point `DATABASE_URL` at a Postgres instance (see
   `.env.example`). Locally:
   ```bash
   cp .env.example .env
   # edit .env — DATABASE_URL, AUTH_SECRET at minimum
   npm install
   npx prisma migrate dev
   npm run db:seed   # creates the default cancellation policy + an admin user
   ```
   The seed prints the admin login it created
   (`admin@boatogram.example` / `ChangeMe123!` by default — override via
   `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`).

2. **Run the app**:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000.

3. **Tests**:
   ```bash
   npm test
   ```

## Payments (Razorpay Route)

Payments are implemented against the real Razorpay Node SDK
(`src/lib/payments/razorpay.ts`) behind a `PaymentProvider` interface
(`src/lib/payments/provider.ts`), so a different provider could be swapped
in without touching booking/webhook logic.

**Without credentials configured** (`RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`
unset), `isConfigured` is `false` and every payment operation throws a clear
`PaymentProviderNotConfiguredError` — booking creation surfaces this as an
explicit "payments are not configured" error rather than faking a
successful payment.

**With credentials configured**, the flow is:

1. `createBooking` locks the boat row, re-checks availability, creates a
   `Booking` row, then a Razorpay **order** for the full amount.
2. The client opens Razorpay Checkout; on success it POSTs to
   `/api/bookings/[id]/verify-payment`, which verifies the checkout
   signature and calls `markPaymentCaptured` — idempotent, keyed on the
   Razorpay order id.
3. `markPaymentCaptured` marks the booking `CONFIRMED`, writes
   `OWNER_EARNING` / `PLATFORM_COMMISSION` ledger entries, and attempts a
   **Route transfer** (`POST /payments/:id/transfers`) to the owner's linked
   account (created at KYC-approval time via `accounts.create`).
4. The async webhook (`/api/webhooks/razorpay`, verified against
   `RAZORPAY_WEBHOOK_SECRET`) calls the same `markPaymentCaptured` — whichever
   of steps 2/4 arrives first does the work; the other is a no-op. Every
   webhook delivery is recorded in `WebhookEvent` keyed by
   `x-razorpay-event-id` (idempotency; retries of a failed/partial delivery
   reuse the same row and re-run, since downstream handlers are themselves
   idempotent).
5. Cancellations compute a refund via the cancellation policy (see below),
   record a `RefundRecord`, and call Razorpay's refund API.

Razorpay Route's own linked-account onboarding also requires stakeholder
KYC and product/settlement configuration beyond account creation — this MVP
covers account creation (`ensureLinkedAccount`) and leaves the rest as a
manual Razorpay Dashboard step, since it can't be exercised without live
credentials.

## Cancellation / refund policy

Configurable per-tier policy (`CancellationPolicy` /
`CancellationPolicyTier`): each tier maps "at least N days before check-in"
to a refund percentage; the highest matching tier applies. The platform
ships with one default policy, editable by admins at
`/admin/cancellation-policy`:

| Days before check-in | Refund |
| --- | --- |
| ≥ 7 | 90% |
| ≥ 3 | 75% |
| ≥ 1 | 50% |
| < 1 | 0% |

A boat can point at its own `CancellationPolicy` to override the default
(the schema supports it; the admin UI only edits the platform default in
this MVP).

## Data model

See `prisma/schema.prisma`. Key pieces:

- `User` (role: `CUSTOMER` / `OWNER` / `ADMIN`) + `OwnerProfile` (KYC status,
  bank details, Razorpay linked account id)
- `Boat` (`HOUSEBOAT` overnight or `SHIKARA` hourly), `BoatImage`,
  `AvailabilityBlock` (owner-set blackout dates)
- `Booking` (immutable price snapshot: unit price, units, subtotal,
  platform fee, owner amount, total), `Payment`, `PaymentSplit`,
  `RefundRecord`
- `LedgerEntry` — audit trail of owner earnings / platform commission /
  refund debits, feeding the admin ledger dashboard
- `WebhookEvent` — webhook idempotency ledger

## Authorization model

- `src/proxy.ts` (Next's "middleware", renamed in v16) does a fast,
  Postgres-free check that a validly-signed session cookie with the right
  role prefix exists for `/dashboard`, `/owner`, `/admin`.
- Every server action and route handler additionally calls
  `requireUser()` / `requireRole()` (`src/lib/auth/session.ts`), which
  re-reads the live `User` row (so a deactivated account or role change
  takes effect immediately) — this is the actual authorization boundary,
  not the proxy check.

## Known MVP simplifications

- **File uploads**: KYC documents and boat photos are plain URL inputs
  (comma-separated). A production deployment would replace these with a
  real upload widget backed by an object storage provider (S3/Cloudinary/etc.).
- **Razorpay Route onboarding**: see above — account creation only, not the
  full stakeholder/product-configuration flow.
- **Notifications**: always persisted in-app; emailed via the Resend HTTP
  API if `RESEND_API_KEY` is set, otherwise logged to the server console.
- §7-style "later" features from the original spec (reviews, messaging,
  multi-currency, etc.) are intentionally out of scope for this MVP.

## Tests

`src/lib/booking/__tests__/` covers the pure business logic with Vitest:

- `pricing.test.ts` — 85/15 split calculation, rounding behavior
- `cancellation.test.ts` — days-before-checkin tier resolution, refund calc
- `availability.test.ts` — interval overlap / range availability logic

Run with `npm test`.
