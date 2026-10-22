-- America Online Pro demo banking actions.
-- All amounts are integer minor units (kobo); no real payment rails are involved.

create or replace function public.open_demo_account_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_id uuid;
  v_txn_id uuid;
  v_account_number text;
begin
  v_account_number := 'AOP' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 9));

  insert into public.accounts (owner_id, account_number, display_name, currency, status, is_demo)
  values (new.id, v_account_number, 'Everyday demo account', 'NGN', 'active', true)
  returning id into v_account_id;

  insert into public.ledger_transactions (description, status, posted_at)
  values ('Welcome demo balance', 'posted', now())
  returning id into v_txn_id;

  insert into public.ledger_entries (ledger_transaction_id, account_id, amount_minor, currency)
  values (v_txn_id, v_account_id, 248560000, 'NGN');

  insert into public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  values (new.id, 'demo_account_created', 'account', v_account_id::text, jsonb_build_object('is_demo', true));

  return new;
end;
$$;

revoke all on function public.open_demo_account_for_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_demo_account_created on auth.users;
create trigger on_auth_user_demo_account_created
  after insert on auth.users
  for each row execute function public.open_demo_account_for_new_user();

create or replace function public.send_demo_transfer(
  p_source_account_id uuid,
  p_destination_account_number text,
  p_amount_minor bigint,
  p_description text default '',
  p_idempotency_key text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_source public.accounts%rowtype;
  v_destination public.accounts%rowtype;
  v_transfer_id uuid;
  v_txn_id uuid;
  v_balance bigint;
  v_description text := left(coalesce(p_description, ''), 120);
begin
  if v_actor is null then raise exception 'Sign in before making a transfer.'; end if;
  if p_amount_minor is null or p_amount_minor <= 0 then raise exception 'Transfer amount must be greater than zero.'; end if;
  if p_amount_minor > 100000000 then raise exception 'Single transfer limit is ₦1,000,000.'; end if;
  if length(trim(coalesce(p_idempotency_key, ''))) < 8 then raise exception 'A valid idempotency key is required.'; end if;
  if p_destination_account_number is null or length(trim(p_destination_account_number)) < 6 then raise exception 'Enter a valid recipient account number.'; end if;

  select * into v_source from public.accounts
  where id = p_source_account_id and owner_id = v_actor and is_demo = true
  for update;
  if not found then raise exception 'Source demo account was not found.'; end if;
  if v_source.status <> 'active' then raise exception 'Source account is not active.'; end if;

  select * into v_destination from public.accounts
  where account_number = upper(trim(p_destination_account_number)) and is_demo = true
  for update;
  if not found then raise exception 'Recipient demo account was not found.'; end if;
  if v_destination.status <> 'active' then raise exception 'Recipient account is not active.'; end if;
  if v_source.id = v_destination.id then raise exception 'You cannot transfer to the same account.'; end if;
  if v_source.currency <> v_destination.currency then raise exception 'Accounts must use the same currency.'; end if;

  select coalesce(sum(amount_minor), 0) into v_balance
  from public.ledger_entries where account_id = v_source.id;
  if v_balance < p_amount_minor then raise exception 'Insufficient demo funds.'; end if;

  insert into public.transfers (actor_id, source_account_id, destination_account_id, amount_minor, currency, status, idempotency_key, description)
  values (v_actor, v_source.id, v_destination.id, p_amount_minor, v_source.currency, 'posted', trim(p_idempotency_key), v_description)
  on conflict (actor_id, idempotency_key) do nothing
  returning id into v_transfer_id;
  if v_transfer_id is null then
    select id into v_transfer_id from public.transfers where actor_id = v_actor and idempotency_key = trim(p_idempotency_key);
    return v_transfer_id;
  end if;

  insert into public.ledger_transactions (transfer_id, status, description, posted_at)
  values (v_transfer_id, 'posted', coalesce(nullif(v_description, ''), 'Demo transfer'), now())
  returning id into v_txn_id;

  insert into public.ledger_entries (ledger_transaction_id, account_id, amount_minor, currency)
  values (v_txn_id, v_source.id, -p_amount_minor, v_source.currency),
         (v_txn_id, v_destination.id, p_amount_minor, v_destination.currency);

  insert into public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  values (v_actor, 'demo_transfer_posted', 'transfer', v_transfer_id::text,
          jsonb_build_object('amount_minor', p_amount_minor, 'source_account_id', v_source.id, 'destination_account_id', v_destination.id));

  return v_transfer_id;
end;
$$;

create or replace function public.add_demo_funds(
  p_account_id uuid,
  p_amount_minor bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_account public.accounts%rowtype;
  v_txn_id uuid;
begin
  if v_actor is null then raise exception 'Sign in before adding demo funds.'; end if;
  if p_amount_minor is null or p_amount_minor < 10000 or p_amount_minor > 100000000 then
    raise exception 'Add-funds amount must be between ₦100 and ₦1,000,000.';
  end if;

  select * into v_account from public.accounts
  where id = p_account_id and owner_id = v_actor and is_demo = true
  for update;
  if not found then raise exception 'Demo account was not found.'; end if;
  if v_account.status <> 'active' then raise exception 'Account is not active.'; end if;

  insert into public.ledger_transactions (description, status, posted_at)
  values ('Demo funds added', 'posted', now())
  returning id into v_txn_id;

  insert into public.ledger_entries (ledger_transaction_id, account_id, amount_minor, currency)
  values (v_txn_id, v_account.id, p_amount_minor, v_account.currency);

  insert into public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  values (v_actor, 'demo_funds_added', 'account', v_account.id::text, jsonb_build_object('amount_minor', p_amount_minor));

  return v_txn_id;
end;
$$;

revoke all on function public.send_demo_transfer(uuid, text, bigint, text, text) from public, anon;
revoke all on function public.add_demo_funds(uuid, bigint) from public, anon;
grant execute on function public.send_demo_transfer(uuid, text, bigint, text, text) to authenticated;
grant execute on function public.add_demo_funds(uuid, bigint) to authenticated;
