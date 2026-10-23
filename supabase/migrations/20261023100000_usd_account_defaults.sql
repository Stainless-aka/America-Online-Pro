-- Default newly created accounts and ledger entries to USD.
alter table public.accounts
  alter column currency set default 'USD';

alter table public.ledger_entries
  alter column currency set default 'USD';
