# Architecture

## Product boundary

America Online Pro is a portfolio banking **simulation**. The initial release uses isolated demo funds and does not move real money.

## System shape

- React + Vite + TypeScript provides the customer and admin interfaces.
- Supabase Auth handles identity and sessions.
- PostgreSQL is the source of truth for account state, transfers, and ledger postings.
- Row Level Security and database grants enforce data boundaries.
- Financial operations are exposed through narrowly scoped PostgreSQL functions.
- Vercel hosts the static frontend; Supabase hosts the managed backend.

## Transfer boundary

The client submits a transfer request with an idempotency key. A trusted database function validates the authenticated actor, account ownership, account status, currency, amount, and available funds. The function serializes competing debits as needed, creates a transfer record and balanced ledger postings in one database transaction, and returns the persisted result. A retry with the same key must not duplicate the financial effect.

## No microservices in the MVP

Keep the first version as a modular frontend and a PostgreSQL-centered backend. Introduce a separate API service only if a concrete requirement justifies it.

## Deployment boundary

Only the Supabase URL and public anon/publishable key belong in the browser. Service-role credentials and other secrets must never be committed or bundled into frontend code.
