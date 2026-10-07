-- PR82: safe bulk-import foundation. This migration stores previews and audit
-- snapshots only; it deliberately has no foreign key or trigger that writes
-- products, inventory units, listings, orders, or payment tables.

create table public.bulk_import_jobs (
  id uuid primary key default gen_random_uuid(),
  import_type text not null check (import_type in ('FIRST_PARTY', 'PARTNER')),
  partner_profile_id uuid references public.partner_profiles(id) on delete restrict,
  source_filename text not null check (char_length(btrim(source_filename)) between 1 and 255),
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  photo_source_type text check (photo_source_type is null or photo_source_type in ('GOOGLE_DRIVE_SHARED_FOLDER', 'ZIP_UPLOAD')),
  photo_source_reference text,
  status text not null default 'UPLOADED' check (status in ('UPLOADED','PARSING','NORMALIZING','VALIDATING','RESOLVING_CATALOG','RESOLVING_ASSETS','ANALYZING_PRICING','READY_FOR_REVIEW','FAILED','CANCELLED')),
  row_count integer not null default 0 check (row_count >= 0),
  ready_count integer not null default 0 check (ready_count >= 0),
  warning_count integer not null default 0 check (warning_count >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (created_by, source_hash)
);

create table public.bulk_import_rows (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.bulk_import_jobs(id) on delete cascade,
  row_number integer not null check (row_number > 0),
  external_id text,
  original_payload jsonb not null default '{}'::jsonb,
  normalized_payload jsonb not null default '{}'::jsonb,
  canonical_brand_id uuid references public.brands(id) on delete set null,
  canonical_category_id uuid references public.categories(id) on delete set null,
  canonical_model_id uuid references public.catalog_product_models(id) on delete set null,
  normalization_metadata jsonb not null default '{}'::jsonb,
  validation_result jsonb not null default '{}'::jsonb,
  pricing_result jsonb not null default '{}'::jsonb,
  photo_metadata jsonb not null default '{}'::jsonb,
  severity text not null default 'ERROR' check (severity in ('PENDING','READY','WARNING','ERROR')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, row_number)
);

create table public.bulk_import_row_issues (
  id uuid primary key default gen_random_uuid(),
  row_id uuid not null references public.bulk_import_rows(id) on delete cascade,
  severity text not null check (severity in ('ERROR','WARNING','INFO')),
  code text not null check (code ~ '^[A-Z][A-Z0-9_]{2,63}$'),
  field text,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.bulk_import_job_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.bulk_import_jobs(id) on delete cascade,
  event_type text not null check (event_type in ('JOB_CREATED','PARSING_COMPLETE','NORMALIZATION_COMPLETE','VALIDATION_COMPLETE','PRICING_STARTED','PRICING_COMPLETED','JOB_READY','JOB_FAILED')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index bulk_import_jobs_status_idx on public.bulk_import_jobs(status, created_at desc);
create index bulk_import_jobs_partner_idx on public.bulk_import_jobs(partner_profile_id, created_at desc);
create index bulk_import_rows_job_idx on public.bulk_import_rows(job_id, row_number);
create index bulk_import_issues_row_idx on public.bulk_import_row_issues(row_id, severity);
create index bulk_import_events_job_idx on public.bulk_import_job_events(job_id, created_at);

create or replace function public.bulk_import_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger bulk_import_jobs_updated_at before update on public.bulk_import_jobs
for each row execute function public.bulk_import_touch_updated_at();
create trigger bulk_import_rows_updated_at before update on public.bulk_import_rows
for each row execute function public.bulk_import_touch_updated_at();

alter table public.bulk_import_jobs enable row level security;
alter table public.bulk_import_rows enable row level security;
alter table public.bulk_import_row_issues enable row level security;
alter table public.bulk_import_job_events enable row level security;

create policy "Bulk import operators manage jobs"
on public.bulk_import_jobs for all to authenticated
using ((select public.can_manage_catalog()))
with check ((select public.can_manage_catalog()) and created_by = (select auth.uid()));

create policy "Partners read own bulk jobs"
on public.bulk_import_jobs for select to authenticated
using (exists (
  select 1 from public.partner_profiles p
  where p.id = bulk_import_jobs.partner_profile_id and p.user_id = (select auth.uid())
));

create policy "Bulk import operators manage rows"
on public.bulk_import_rows for all to authenticated
using (exists (select 1 from public.bulk_import_jobs j where j.id = bulk_import_rows.job_id and public.can_manage_catalog()))
with check (exists (select 1 from public.bulk_import_jobs j where j.id = bulk_import_rows.job_id and public.can_manage_catalog()));

create policy "Partners read own bulk rows"
on public.bulk_import_rows for select to authenticated
using (exists (
  select 1 from public.bulk_import_jobs j join public.partner_profiles p on p.id = j.partner_profile_id
  where j.id = bulk_import_rows.job_id and p.user_id = (select auth.uid())
));

create policy "Bulk import operators manage issues"
on public.bulk_import_row_issues for all to authenticated
using (exists (
  select 1 from public.bulk_import_rows r join public.bulk_import_jobs j on j.id = r.job_id
  where r.id = bulk_import_row_issues.row_id and public.can_manage_catalog()
))
with check (exists (
  select 1 from public.bulk_import_rows r join public.bulk_import_jobs j on j.id = r.job_id
  where r.id = bulk_import_row_issues.row_id and public.can_manage_catalog()
));

create policy "Partners read own bulk issues"
on public.bulk_import_row_issues for select to authenticated
using (exists (
  select 1 from public.bulk_import_rows r
  join public.bulk_import_jobs j on j.id = r.job_id
  join public.partner_profiles p on p.id = j.partner_profile_id
  where r.id = bulk_import_row_issues.row_id and p.user_id = (select auth.uid())
));

create policy "Bulk import operators manage events"
on public.bulk_import_job_events for all to authenticated
using (exists (select 1 from public.bulk_import_jobs j where j.id = bulk_import_job_events.job_id and public.can_manage_catalog()))
with check (exists (select 1 from public.bulk_import_jobs j where j.id = bulk_import_job_events.job_id and public.can_manage_catalog()));

create policy "Partners read own bulk events"
on public.bulk_import_job_events for select to authenticated
using (exists (
  select 1 from public.bulk_import_jobs j join public.partner_profiles p on p.id = j.partner_profile_id
  where j.id = bulk_import_job_events.job_id and p.user_id = (select auth.uid())
));

revoke all on public.bulk_import_jobs, public.bulk_import_rows, public.bulk_import_row_issues from anon;
revoke all on public.bulk_import_job_events from anon;
grant select, insert, update on public.bulk_import_jobs to authenticated;
grant select, insert, update on public.bulk_import_rows to authenticated;
grant select, insert, update on public.bulk_import_row_issues to authenticated;
grant select, insert on public.bulk_import_job_events to authenticated;
