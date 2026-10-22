-- Generate a unique AOP-prefixed account number for each newly created user.
-- Example format: AOPB2062FEC8. The accounts.account_number unique constraint
-- is the final safeguard against collisions; retry if a collision ever occurs.

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
  -- Retry if the generated number ever collides with an existing account number.
  loop
    v_account_number := 'AOP' || upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 9));

    begin
      insert into public.accounts (owner_id, account_number, display_name, currency, status, is_demo)
      values (new.id, v_account_number, 'Everyday account', 'USD', 'active', true)
      returning id into v_account_id;

      exit;
    exception
      when unique_violation then
        -- Retry only if the account number collided. Re-raise unrelated unique violations.
        if exists (select 1 from public.accounts where owner_id = new.id) then
          raise;
        end if;
    end;
  end loop;

  -- New accounts start at $0.00; no opening ledger entry is inserted.
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
