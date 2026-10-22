# Frontend feature modules

Organize feature-specific UI, hooks, schemas, services, and types under `src/features/` as implementation grows. Keep shared primitives in `src/components/ui/`, application wiring in `src/app/`, and the Supabase client in `src/lib/`. Do not implement financial rules or balance mutations in React components.
