alter table public.profiles
  add column if not exists full_name text not null default '';

insert into public.profiles (id, full_name)
select u.id, coalesce(u.raw_user_meta_data ->> 'full_name', '')
from auth.users u
on conflict (id) do update
set full_name = case
  when public.profiles.full_name = '' then excluded.full_name
  else public.profiles.full_name
end;

insert into public.user_roles (user_id, role)
select u.id, 'customer'::public.app_role
from auth.users u
on conflict (user_id, role) do nothing;
