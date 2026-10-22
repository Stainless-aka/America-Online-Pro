# Supabase migrations

Create timestamped migrations with the Supabase CLI, for example:

```bash
supabase migration new create_core_schema
supabase start
supabase db reset
supabase test db
```

Commit every schema, policy, grant, function, and seed change as a migration. Do not make undocumented production dashboard edits. The initial schema and secure transfer functions are planned next; do not treat this directory as a complete production database yet.
