-- Authentication-linked profiles, role assignments, and addresses.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  phone text,
  locale text not null default 'es-MX',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length
    check (display_name is null or char_length(display_name) between 1 and 120),
  constraint profiles_phone_length
    check (phone is null or char_length(phone) between 7 and 30)
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roles_name_allowed
    check (name in ('customer', 'operator', 'admin'))
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete restrict,
  assigned_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, role_id)
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null,
  recipient_name text not null,
  phone text,
  line_1 text not null,
  line_2 text,
  neighborhood text,
  city text not null,
  state text not null,
  postal_code text not null,
  country_code character(2) not null default 'MX',
  is_default boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint addresses_label_length check (char_length(label) between 1 and 60),
  constraint addresses_recipient_length
    check (char_length(recipient_name) between 1 and 120),
  constraint addresses_postal_code_format check (postal_code ~ '^[0-9]{5}$'),
  constraint addresses_country_mexico_only check (country_code = 'MX')
);

create index user_roles_user_id_idx on public.user_roles (user_id);
create index user_roles_role_id_idx on public.user_roles (role_id);
create index user_roles_assigned_by_idx on public.user_roles (assigned_by);
create index addresses_user_id_idx on public.addresses (user_id);
create unique index addresses_one_default_per_user_idx
  on public.addresses (user_id)
  where is_default and archived_at is null;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger roles_set_updated_at
before update on public.roles
for each row execute function public.set_updated_at();

create trigger addresses_set_updated_at
before update on public.addresses
for each row execute function public.set_updated_at();

