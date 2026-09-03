-- Mi Golf private memory foundation. Purchase history is intentionally not
-- copied here: ownership must be explicitly declared by the golfer.
create table public.mi_golf_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  handicap numeric(4,1),
  handedness text,
  skill_level text,
  play_frequency text,
  shot_tendency text,
  preferences jsonb not null default '{}'::jsonb,
  memory_source text not null default 'USER_DECLARED',
  memory_confidence text not null default 'HIGH',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mi_golf_profiles_handicap_valid check (handicap is null or (handicap >= 0 and handicap <= 54)),
  constraint mi_golf_profiles_handedness_valid check (handedness is null or handedness in ('right','left','unknown')),
  constraint mi_golf_profiles_source_valid check (memory_source in ('USER_DECLARED','PURCHASE_HISTORY','SYSTEM_INFERRED','MEASURED','EXTERNAL_SOURCE','FUTURE_VIDEO')),
  constraint mi_golf_profiles_confidence_valid check (memory_confidence in ('HIGH','MEDIUM','LOW'))
);

create table public.mi_golf_equipment (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null,
  brand text,
  model text,
  specifications jsonb not null default '{}'::jsonb,
  source text not null default 'USER_DECLARED',
  confidence text not null default 'HIGH',
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mi_golf_equipment_category_length check (char_length(category) between 1 and 80),
  constraint mi_golf_equipment_brand_length check (brand is null or char_length(brand) between 1 and 120),
  constraint mi_golf_equipment_model_length check (model is null or char_length(model) between 1 and 160),
  constraint mi_golf_equipment_source_valid check (source in ('USER_DECLARED','PURCHASE_HISTORY','SYSTEM_INFERRED','MEASURED','EXTERNAL_SOURCE','FUTURE_VIDEO')),
  constraint mi_golf_equipment_confidence_valid check (confidence in ('HIGH','MEDIUM','LOW'))
);

create table public.mi_golf_objectives (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  objective_type text not null,
  status text not null default 'ACTIVE',
  details text,
  source text not null default 'USER_DECLARED',
  confidence text not null default 'HIGH',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mi_golf_objectives_type_length check (char_length(objective_type) between 1 and 100),
  constraint mi_golf_objectives_status_valid check (status in ('ACTIVE','ACHIEVED','NO_LONGER_PRIORITY')),
  constraint mi_golf_objectives_source_valid check (source in ('USER_DECLARED','PURCHASE_HISTORY','SYSTEM_INFERRED','MEASURED','EXTERNAL_SOURCE','FUTURE_VIDEO')),
  constraint mi_golf_objectives_confidence_valid check (confidence in ('HIGH','MEDIUM','LOW'))
);

create index mi_golf_equipment_user_active_idx on public.mi_golf_equipment(user_id, is_active, updated_at desc);
create index mi_golf_objectives_user_status_idx on public.mi_golf_objectives(user_id, status, updated_at desc);

create trigger mi_golf_profiles_set_updated_at before update on public.mi_golf_profiles for each row execute function public.set_updated_at();
create trigger mi_golf_equipment_set_updated_at before update on public.mi_golf_equipment for each row execute function public.set_updated_at();
create trigger mi_golf_objectives_set_updated_at before update on public.mi_golf_objectives for each row execute function public.set_updated_at();

alter table public.mi_golf_profiles enable row level security;
alter table public.mi_golf_equipment enable row level security;
alter table public.mi_golf_objectives enable row level security;

create policy "golfer reads own mi golf profile" on public.mi_golf_profiles for select to authenticated using (user_id = auth.uid());
create policy "golfer manages own mi golf profile" on public.mi_golf_profiles for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "golfer reads own mi golf equipment" on public.mi_golf_equipment for select to authenticated using (user_id = auth.uid());
create policy "golfer manages own mi golf equipment" on public.mi_golf_equipment for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "golfer reads own mi golf objectives" on public.mi_golf_objectives for select to authenticated using (user_id = auth.uid());
create policy "golfer manages own mi golf objectives" on public.mi_golf_objectives for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.mi_golf_profiles, public.mi_golf_equipment, public.mi_golf_objectives from anon;
grant select, insert, update, delete on public.mi_golf_profiles, public.mi_golf_equipment, public.mi_golf_objectives to authenticated;
