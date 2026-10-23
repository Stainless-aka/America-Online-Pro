-- Update the existing account ending FEC8 to USD.
-- This changes the currency designation, not the numeric balance.

begin;

do $$
declare
  v_account_id uuid;
begin
  select id into v_account_id
  from public.accounts
  where account_number like '%FEC8';

  if v_account_id is null then
    raise exception 'No account found ending in FEC8; no changes applied.';
  end if;

  update public.accounts
  set currency = 'USD',
      display_name = 'Everyday Account'
  where id = v_account_id;

  update public.ledger_entries
  set currency = 'USD'
  where account_id = v_account_id;
end $$;

commit;
