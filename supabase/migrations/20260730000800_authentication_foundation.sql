-- Create a minimal profile and customer role assignment for every Auth user.

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text;

alter table public.profiles
  drop constraint if exists profiles_first_name_length;
alter table public.profiles
  add constraint profiles_first_name_length
    check (first_name is null or char_length(first_name) between 1 and 80);

alter table public.profiles
  drop constraint if exists profiles_last_name_length;
alter table public.profiles
  add constraint profiles_last_name_length
    check (last_name is null or char_length(last_name) between 1 and 80);

insert into public.roles (name, description)
values ('customer', 'Cliente autenticado')
on conflict (name) do nothing;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  customer_role_id uuid;
  new_first_name text;
  new_last_name text;
begin
  new_first_name := nullif(btrim(new.raw_user_meta_data ->> 'first_name'), '');
  new_last_name := nullif(btrim(new.raw_user_meta_data ->> 'last_name'), '');

  if new_first_name is not null and char_length(new_first_name) > 80 then
    raise exception 'Invalid profile metadata';
  end if;

  if new_last_name is not null and char_length(new_last_name) > 80 then
    raise exception 'Invalid profile metadata';
  end if;

  select id
    into customer_role_id
    from public.roles
    where name = 'customer';

  if customer_role_id is null then
    raise exception 'Required customer role is unavailable';
  end if;

  insert into public.profiles (
    id,
    first_name,
    last_name,
    display_name
  )
  values (
    new.id,
    new_first_name,
    new_last_name,
    nullif(concat_ws(' ', new_first_name, new_last_name), '')
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role_id)
  values (new.id, customer_role_id)
  on conflict (user_id, role_id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_auth_user()
  from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

