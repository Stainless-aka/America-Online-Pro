# America-Online-Pro

A portfolio digital-banking simulation inspired by the engineering lessons of Wells-Banking, with an independent identity, interface, and codebase.

> **Simulation only.** This project uses demo funds and is not a real bank. It does not accept deposits, process withdrawals, or move real money.

## Product goals

- Responsive customer banking dashboard with accounts and transaction history.
- Safe simulated internal transfers backed by PostgreSQL transactions.
- Double-entry ledger with auditable, immutable posted entries.
- Supabase authentication and database-enforced authorization.
- Restricted admin operations and security-focused automated tests.

## Architecture

- **Frontend:** React, Vite, TypeScript, Tailwind CSS, React Router, TanStack Query.
- **Backend:** Supabase Auth and PostgreSQL.
- **Financial operations:** trusted PostgreSQL functions; no client-side balance writes.
- **Authorization:** least-privilege database grants, RLS, and explicit role checks.
- **Testing:** Vitest, React Testing Library, PostgreSQL tests, and Playwright.

See [`docs/architecture.md`](docs/architecture.md), [`docs/database-design.md`](docs/database-design.md), and [`docs/security-model.md`](docs/security-model.md).

## Current implementation

- Email/password signup, sign-in, sign-out, and password recovery/update flows.
- Responsive Overview, Accounts, Transfers, Cards (visual preview only), Transactions, Analytics, Add Demo Funds, Settings, Notifications, and Help Center pages.
- Account and transaction views load from Supabase; profile edits are persisted.
- Demo-fund credits and internal demo transfers are performed through scoped PostgreSQL functions and recorded in the ledger.
- Row Level Security and restricted direct-write grants are defined in migrations.
- Vitest and Playwright tests cover the authentication shell and registration navigation.

The database migrations must be applied to a dedicated Supabase project and the frontend must be configured with its public URL and publishable/anon key before backend features can run. The repository has not yet been verified with a completed local build or live end-to-end run.

## Local setup

Prerequisites: Node.js LTS, npm, and the Supabase CLI (for local database development).

```bash
npm install
cp .env.example .env.local
npm run dev
```

Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`. Never put a Supabase service-role key or other secret in frontend environment variables. Apply migrations in `supabase/migrations/` in timestamp order. Configure the Supabase Auth site URL and redirect allowlist to include your local development URL and deployed domain.

## Financial invariants

- Posted ledger entries must sum to zero per currency for each ledger transaction.
- Transfers must debit and credit atomically.
- Insufficient funds and invalid amounts must be rejected in trusted database logic.
- Idempotent retries must not duplicate financial effects.
- Concurrent transfers must not overspend available funds.
- Customers must not read or mutate another customer's private records.
- Posted ledger entries are not edited or deleted; corrections use explicit reversals.

## License

To be determined.