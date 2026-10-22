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

## Planned implementation stages

1. Frontend foundation and design system.
2. Database schema, migrations, RLS, and role model.
3. Ledger, atomic transfers, idempotency, and concurrency tests.
4. Customer dashboard, accounts, and transaction workflows.
5. Restricted admin console, end-to-end tests, and deployment.

## Local setup

Prerequisites: Node.js LTS, npm, and the Supabase CLI (for local database development).

```bash
npm install
cp .env.example .env.local
npm run dev
```

Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`. Never put a Supabase service-role key or other secret in frontend environment variables. The app scaffold and database migrations will be added incrementally; see the repository for current implementation status.

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