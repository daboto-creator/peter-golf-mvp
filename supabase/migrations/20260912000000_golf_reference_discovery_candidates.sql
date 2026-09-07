-- Bounded monthly discovery queue. Candidates are never canonical until
-- explicitly reviewed or strongly verified by a trusted official source.
create table public.golf_reference_discovery_candidates (
  id uuid primary key default gen_random_uuid(),
  raw_brand text not null,
  raw_model text not null,
  category_id uuid references public.categories(id) on delete set null,
  normalized_brand_key text not null,
  normalized_model_key text not null,
  source text not null,
  source_url text,
  status text not null default 'NEEDS_REVIEW',
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint golf_reference_candidate_status_valid check (status in ('DISCOVERED','NEEDS_REVIEW','VERIFIED','REJECTED')),
  constraint golf_reference_candidate_source_valid check (source in ('OFFICIAL_MANUFACTURER','SPECIALIST_RETAILER','FIRST_PARTY_ENTRY','PARTNER_ENTRY','IMPORT')),
  unique (normalized_brand_key, normalized_model_key, category_id)
);
create index golf_reference_candidate_status_idx on public.golf_reference_discovery_candidates(status, updated_at desc);
create trigger golf_reference_candidate_set_updated_at before update on public.golf_reference_discovery_candidates for each row execute function public.set_updated_at();
alter table public.golf_reference_discovery_candidates enable row level security;
create policy "catalog staff can read reference candidates" on public.golf_reference_discovery_candidates for select to authenticated using (public.can_manage_catalog());
revoke all on public.golf_reference_discovery_candidates from anon, authenticated;
grant select on public.golf_reference_discovery_candidates to authenticated;
