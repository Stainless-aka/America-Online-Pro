# Database design

## Core tables

- `profiles`: application profile tied to `auth.users`.
- `user_roles`: privileged application roles, assigned only through trusted administration.
- `accounts`: owner, unique account reference, currency, and lifecycle status.
- `transfers`: transfer request and lifecycle metadata, including a scoped idempotency key.
- `ledger_transactions`: grouping record for a financial posting operation.
- `ledger_entries`: signed amount in integer minor units, account, currency, and ledger transaction reference.
- `audit_logs`: append-oriented record of security-sensitive operations.

## Money representation

Use integer minor units (for NGN, kobo) for amounts; do not use floating-point values. Enforce valid amount bounds and currency consistency. Format naira amounts only at the presentation boundary.

## Ledger invariants

1. Every posted ledger transaction balances to zero for each currency.
2. A transfer's debit and credit are committed atomically.
3. Posted entries cannot be edited or deleted by application roles.
4. Corrections are represented by explicit reversal entries, not destructive edits.
5. Account availability must remain correct under concurrent transfer attempts.
6. An idempotency key is unique within its documented actor/operation scope.

## Balance strategy

The ledger is the financial record. If a cached account balance is introduced for performance, update it in the same database transaction as ledger postings and add reconciliation checks. Never trust a balance supplied by the browser.

## Demo funding

Initial demo funding must use a restricted, idempotent seed/provisioning path separate from normal customer transfer functions. Do not expose unrestricted balance-crediting RPCs to authenticated clients.
