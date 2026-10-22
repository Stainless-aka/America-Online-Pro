# Security model

## Authentication and authorization

- Supabase Auth establishes identity; policies use the verified `auth.uid()`.
- Customers may only read records explicitly associated with their identity.
- Customer-supplied role names are never trusted.
- Privileged roles are assigned through a restricted administrative process.
- RLS is used together with least-privilege SQL grants; RLS alone is not the entire authorization model.

## Financial writes

Customers cannot directly update balances or insert, update, or delete ledger entries. Transfer execution occurs through a narrowly scoped database function that validates identity and inputs and writes all related records atomically.

## Definer functions

Any `SECURITY DEFINER` function must use a safe fixed `search_path`, schema-qualified object names, explicit caller/role validation, and restricted `EXECUTE` grants. Prefer invoker privileges when practical.

## Secrets

Only public Supabase client configuration may be present in Vite environment variables. Never commit service-role keys, database passwords, JWT secrets, or provider credentials. `.env.example` contains placeholders only.

## Auditability

Record security-sensitive actions with actor, action, resource, and timestamp. Restrict audit-log access and prevent ordinary users from rewriting the audit trail.

## Portfolio disclaimer

The app is a demo simulation, not a licensed financial institution. No real deposits, withdrawals, or external money movement are supported by the initial scope.
