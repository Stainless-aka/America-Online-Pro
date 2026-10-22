-- New accounts start with a zero USD balance.
-- Balances are derived from ledger entries; intentionally create no opening credit.

create or replace function public.open_demo_account_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_id uuid;
  v_account_number text;
begin
  v_account_number := 'AOP' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 9));

  insert into public.accounts (owner_id, account_number, display_name, currency, status, is_demo)
  values (new.id, v_account_number, 'Everyday account', 'USD', 'active', true)
  returning id into v_account_id;

  -- No ledger entry is inserted, so the initial available balance is $0.00.
  insert into public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  values (new.id, 'account_created', 'account', v_account_id::text,
          jsonb_build_object('currency', 'USD', 'initial_balance_minor', 0));

  return new;
end;
$$;

revoke all on function public.open_demo_account_for_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_demo_account_created on auth.users;
create trigger on_auth_user_demo_account_created
  after insert on auth.users
  for each row execute function public.open_demo_account_for_new_user();
