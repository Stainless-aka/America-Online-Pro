-- America Online Pro: core schema foundation.
-- Simulation only. Financial writes will be added through narrowly scoped functions.
create extension if not exists pgcrypto;

create type public.account_status as enum ('active', 'frozen', 'closed');
create type public.transfer_status as enum ('pending', 'posted', 'failed', 'reversed');
create type public.ledger_transaction_status as enum ('pending', 'posted', 'reversed');
create type public.app_role as enum ('customer', 'admin', 'auditor');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'customer',
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users(id),
  primary key (user_id, role)
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  account_number text not null unique,
  display_name text not null default 'Everyday account',
  currency char(3) not null default 'NGN',
  status public.account_status not null default 'active',
  is_demo boolean not null default true,
  created_at timestamptz not null default now(),
  constraint account_number_nonempty check (length(trim(account_number)) >= 6),
  constraint currency_uppercase check (currency = upper(currency))
);

create index accounts_owner_id_idx on public.accounts(owner_id);

create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  source_account_id uuid not null references public.accounts(id),
  destination_account_id uuid not null references public.accounts(id),
  amount_minor bigint not null,
  currency char(3) not null default 'NGN',
  status public.transfer_status not null default 'pending',
  idempotency_key text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transfer_positive_amount check (amount_minor > 0),
  constraint transfer_distinct_accounts check (source_account_id <> destination_account_id),
  constraint transfer_idempotency_actor_key unique (actor_id, idempotency_key)
);

create index transfers_actor_created_idx on public.transfers(actor_id, created_at desc);
create index transfers_source_created_idx on public.transfers(source_account_id, created_at desc);
create index transfers_destination_created_idx on public.transfers(destination_account_id, created_at desc);

create table public.ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid unique references public.transfers(id),
  status public.ledger_transaction_status not null default 'pending',
  description text not null default '',
  created_at timestamptz not null default now(),
  posted_at timestamptz
);

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  ledger_transaction_id uuid not null references public.ledger_transactions(id),
  account_id uuid not null references public.accounts(id),
  amount_minor bigint not null,
  currency char(3) not null,
  created_at timestamptz not null default now(),
  constraint ledger_entry_nonzero check (amount_minor <> 0)
);

create index ledger_entries_account_created_idx on public.ledger_entries(account_id, created_at desc);
create index ledger_entries_transaction_idx on public.ledger_entries(ledger_transaction_id);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  action text not null,
  resource_type text not null,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_created_at_idx on public.audit_logs(created_at desc);
create index audit_logs_actor_created_idx on public.audit_logs(actor_id, created_at desc);

-- All application tables are protected by RLS. Privileged writes are added later
-- through explicitly granted database functions; browser clients cannot write ledger rows.
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.accounts enable row level security;
alter table public.transfers enable row level security;
alter table public.ledger_transactions enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "user_roles_select_own"
  on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()));

create policy "accounts_select_owned"
  on public.accounts for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "transfers_select_participant"
  on public.transfers for select to authenticated
  using (
    actor_id = (select auth.uid())
    or exists (
      select 1 from public.accounts a
      where a.id = transfers.source_account_id and a.owner_id = (select auth.uid())
    )
    or exists (
      select 1 from public.accounts a
      where a.id = transfers.destination_account_id and a.owner_id = (select auth.uid())
    )
  );

create policy "ledger_transactions_select_account_owner"
  on public.ledger_transactions for select to authenticated
  using (
    exists (
      select 1
      from public.ledger_entries le
      join public.accounts a on a.id = le.account_id
      where le.ledger_transaction_id = ledger_transactions.id
        and a.owner_id = (select auth.uid())
    )
  );

create policy "ledger_entries_select_account_owner"
  on public.ledger_entries for select to authenticated
  using (
    exists (
      select 1 from public.accounts a
      where a.id = ledger_entries.account_id and a.owner_id = (select auth.uid())
    )
  );

-- No customer policy is defined for audit_logs, so customer sessions cannot read it.
-- Revoke default table privileges and explicitly grant only required read operations.
revoke all on public.profiles, public.user_roles, public.accounts, public.transfers,
  public.ledger_transactions, public.ledger_entries, public.audit_logs from anon, authenticated;

grant select on public.profiles, public.user_roles, public.accounts, public.transfers,
  public.ledger_transactions, public.ledger_entries to authenticated;
grant update (full_name) on public.profiles to authenticated;

-- Do not grant direct INSERT/UPDATE/DELETE on accounts, transfers, or ledger tables.
-- Admin and transfer functions will be added in separate migrations with scoped grants.
