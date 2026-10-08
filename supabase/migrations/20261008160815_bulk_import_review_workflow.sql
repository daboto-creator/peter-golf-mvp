-- PR82 review foundation: review metadata only; no domain writes.
alter table public.bulk_import_jobs drop constraint if exists bulk_import_jobs_status_check;
alter table public.bulk_import_jobs add constraint bulk_import_jobs_status_check
  check (status in ('UPLOADED','PARSING','NORMALIZING','VALIDATING','RESOLVING_CATALOG','RESOLVING_ASSETS','ANALYZING_PRICING','READY_FOR_REVIEW','APPROVED_FOR_IMPORT','FAILED','CANCELLED'));

alter table public.bulk_import_rows
  add column if not exists excluded boolean not null default false,
  add column if not exists exclusion_reason text,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists normalization_accepted boolean not null default false,
  add column if not exists manual_resolution jsonb not null default '{}'::jsonb;

alter table public.bulk_import_job_events drop constraint if exists bulk_import_job_events_event_type_check;
alter table public.bulk_import_job_events add constraint bulk_import_job_events_event_type_check
  check (event_type in ('JOB_CREATED','PARSING_COMPLETE','NORMALIZATION_COMPLETE','VALIDATION_COMPLETE','PRICING_STARTED','PRICING_COMPLETED','JOB_READY','JOB_FAILED','REVIEW_OPENED','ROW_CORRECTED','NORMALIZATION_ACCEPTED','MODEL_RESOLVED','ROW_EXCLUDED','ROW_REINCLUDED','JOB_APPROVED_FOR_IMPORT','JOB_REOPENED_FOR_REVIEW'));

create index if not exists bulk_import_rows_review_idx on public.bulk_import_rows(job_id, excluded, severity);
