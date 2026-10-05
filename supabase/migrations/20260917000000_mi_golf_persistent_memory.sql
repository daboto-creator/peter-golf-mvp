-- PR81: durable, user-owned Mi Golf memory and immutable recommendation history.
-- Additive only; existing Mi Golf rows remain valid and keep their provenance.

alter table public.mi_golf_profiles
  add column handicap_status text not null default 'UNKNOWN',
  add column handicap_source text not null default 'USER_DECLARED',
  add column handedness_source text not null default 'USER_DECLARED',
  add column skill_level_source text not null default 'DERIVED_FROM_HANDICAP';

alter table public.mi_golf_profiles
  drop constraint mi_golf_profiles_source_valid;
alter table public.mi_golf_profiles
  add constraint mi_golf_profiles_source_valid check (
    memory_source in (
      'USER_MANUAL_EDIT','USER_DECLARED','PURCHASE_HISTORY','DERIVED',
      'AI_INFERENCE','MEASURED','FUTURE_VIDEO','EXTERNAL_IMPORT',
      'SYSTEM_INFERRED','EXTERNAL_SOURCE'
    )
  );
alter table public.mi_golf_profiles
  add constraint mi_golf_profiles_handicap_status_valid check (
    handicap_status in ('KNOWN','NONE','UNKNOWN','DECLINED')
  );
alter table public.mi_golf_profiles
  add constraint mi_golf_profiles_handicap_source_valid check (
    handicap_source in (
      'USER_MANUAL_EDIT','USER_DECLARED','PURCHASE_HISTORY','DERIVED',
      'AI_INFERENCE','MEASURED','FUTURE_VIDEO','EXTERNAL_IMPORT',
      'SYSTEM_INFERRED','EXTERNAL_SOURCE'
    )
  );
alter table public.mi_golf_profiles
  add constraint mi_golf_profiles_handedness_source_valid check (
    handedness_source in (
      'USER_MANUAL_EDIT','USER_DECLARED','PURCHASE_HISTORY','DERIVED',
      'AI_INFERENCE','MEASURED','FUTURE_VIDEO','EXTERNAL_IMPORT',
      'SYSTEM_INFERRED','EXTERNAL_SOURCE'
    )
  );
alter table public.mi_golf_profiles
  add constraint mi_golf_profiles_skill_source_valid check (
    skill_level_source in (
      'USER_MANUAL_EDIT','USER_DECLARED','PURCHASE_HISTORY','DERIVED',
      'AI_INFERENCE','MEASURED','FUTURE_VIDEO','EXTERNAL_IMPORT',
      'SYSTEM_INFERRED','EXTERNAL_SOURCE','DERIVED_FROM_HANDICAP'
    )
  );

alter table public.mi_golf_equipment
  drop constraint mi_golf_equipment_source_valid;
alter table public.mi_golf_equipment
  add constraint mi_golf_equipment_source_valid check (
    source in (
      'USER_MANUAL_EDIT','USER_DECLARED','PURCHASE_HISTORY','DERIVED',
      'AI_INFERENCE','MEASURED','FUTURE_VIDEO','EXTERNAL_IMPORT',
      'SYSTEM_INFERRED','EXTERNAL_SOURCE'
    )
  );

alter table public.mi_golf_objectives
  drop constraint mi_golf_objectives_source_valid;
alter table public.mi_golf_objectives
  add constraint mi_golf_objectives_source_valid check (
    source in (
      'USER_MANUAL_EDIT','USER_DECLARED','PURCHASE_HISTORY','DERIVED',
      'AI_INFERENCE','MEASURED','FUTURE_VIDEO','EXTERNAL_IMPORT',
      'SYSTEM_INFERRED','EXTERNAL_SOURCE'
    )
  );

create table public.mi_golf_recommendation_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  product_family text,
  technical_compatibility text,
  player_level_fit text,
  recommendation_outcome text not null,
  recommendation_strength text,
  key_reasons jsonb not null default '[]'::jsonb,
  caveats jsonb not null default '[]'::jsonb,
  rule_version text not null default 'pr81-v1',
  profile_snapshot jsonb not null default '{}'::jsonb,
  recipient_context text not null default 'SELF',
  created_at timestamptz not null default now(),
  constraint mi_golf_recommendation_snapshot_recipient_valid
    check (recipient_context = 'SELF'),
  constraint mi_golf_recommendation_snapshot_outcome_valid
    check (recommendation_outcome in (
      'RECOMMENDED','RECOMMENDED_WITH_CAVEAT','NOT_RECOMMENDED',
      'HARD_INCOMPATIBLE','NO_COMPATIBLE_INVENTORY','NEED_MORE_INFORMATION'
    )),
  constraint mi_golf_recommendation_snapshot_json_valid check (
    jsonb_typeof(key_reasons) = 'array' and
    jsonb_typeof(caveats) = 'array' and
    jsonb_typeof(profile_snapshot) = 'object'
  )
);

create index mi_golf_recommendation_snapshots_user_created_idx
  on public.mi_golf_recommendation_snapshots(user_id, created_at desc);

alter table public.mi_golf_recommendation_snapshots enable row level security;
create policy "golfer reads own recommendation snapshots"
  on public.mi_golf_recommendation_snapshots for select to authenticated
  using (user_id = auth.uid());
create policy "golfer creates own recommendation snapshots"
  on public.mi_golf_recommendation_snapshots for insert to authenticated
  with check (user_id = auth.uid() and recipient_context = 'SELF');
revoke all on public.mi_golf_recommendation_snapshots from anon;
grant select, insert on public.mi_golf_recommendation_snapshots to authenticated;
