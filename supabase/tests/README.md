# Database test plan

Add database tests for:

- RLS isolation between two customer identities.
- Denial of direct balance and ledger writes.
- Rejection of invalid and insufficient-funds transfers.
- Atomic rollback when a transfer cannot be completed.
- Idempotent retries and duplicate keys.
- Concurrent debits against the same source account.
- Per-currency balance of every posted ledger transaction.
- Restricted demo funding and admin-only actions.

Use deterministic fixtures and test-only identities. Never use real customer data or real funds in tests.
