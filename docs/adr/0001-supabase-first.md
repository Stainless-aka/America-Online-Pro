# ADR 0001: Supabase-first architecture

- **Status:** Accepted
- **Decision:** Use React + Vite + TypeScript with Supabase Auth and PostgreSQL functions/RLS for the initial MVP.

## Context

The project is intended to demonstrate full-stack engineering and secure financial workflow design without introducing unnecessary service complexity.

## Consequences

- PostgreSQL constraints and transactions are central to financial correctness.
- SQL migrations and database tests are first-class source code.
- No dedicated Node/Express service is required initially.
- A dedicated API can be added later if requirements emerge that cannot be handled cleanly with trusted database functions.
