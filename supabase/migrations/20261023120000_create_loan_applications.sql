-- Store loan applications under the authenticated customer.
-- This records application details only; it does not approve or disburse loans.

create table if not exists public.loan_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 500 and amount <= 25000),
  term_months integer not null check (term_months in (12, 24, 36, 48)),
  annual_rate numeric(5,2) not null check (annual_rate >= 0 and annual_rate <= 30),
  purpose text not null check (length(trim(purpose)) between 1 and 100),
  employment_status text not null check (length(trim(employment_status)) between 1 and 50),
  monthly_income numeric(12,2) not null check (monthly_income > 0),
  status text not null default 'submitted'
    check (status in ('submitted', 'under_review', 'declined', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists loan_applications_user_created_idx
  on public.loan_applications (user_id, created_at desc);

alter table public.loan_applications enable row level security;

drop policy if exists loan_applications_select_own on public.loan_applications;
create policy loan_applications_select_own
  on public.loan_applications for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists loan_applications_insert_own on public.loan_applications;
create policy loan_applications_insert_own
  on public.loan_applications for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'submitted'
  );

revoke all on public.loan_applications from anon, authenticated;
grant select on public.loan_applications to authenticated;
grant insert (user_id, amount, term_months, annual_rate, purpose, employment_status, monthly_income)
  on public.loan_applications to authenticated;
