-- Advisory flows, basic content/configuration, and minimal audit logging.

create table public.advisory_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  status public.advisory_session_status not null default 'active',
  context jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint advisory_sessions_context_object
    check (jsonb_typeof(context) = 'object'),
  constraint advisory_sessions_completed_at_consistent check (
    (status = 'completed' and completed_at is not null)
    or status <> 'completed'
  )
);

create table public.advisory_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null
    references public.advisory_sessions (id) on delete cascade,
  question_key text not null,
  answer jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, question_key),
  constraint advisory_answers_question_key_format
    check (question_key ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$')
);

create table public.advisory_recommendations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null
    references public.advisory_sessions (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  variant_id uuid references public.product_variants (id) on delete restrict,
  rank integer not null,
  rationale text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, rank),
  constraint advisory_recommendations_rank_positive check (rank > 0),
  constraint advisory_recommendations_rationale_length
    check (char_length(rationale) between 1 and 2000)
);

create table public.advisory_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  session_id uuid references public.advisory_sessions (id) on delete set null,
  product_id uuid references public.products (id) on delete restrict,
  name text not null,
  email text,
  phone text,
  preferred_channel public.contact_channel not null,
  message text,
  consent_at timestamptz not null,
  status public.advisory_request_status not null default 'new',
  assigned_to uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint advisory_requests_name_length
    check (char_length(name) between 1 and 120),
  constraint advisory_requests_email_length
    check (email is null or char_length(email) between 3 and 254),
  constraint advisory_requests_phone_length
    check (phone is null or char_length(phone) between 7 and 30),
  constraint advisory_requests_contact_available
    check (email is not null or phone is not null),
  constraint advisory_requests_preferred_contact_available check (
    (preferred_channel = 'email' and email is not null)
    or (preferred_channel in ('phone', 'whatsapp') and phone is not null)
  ),
  constraint advisory_requests_consent_not_future
    check (consent_at <= now()),
  constraint advisory_requests_resolved_at_consistent check (
    (status in ('resolved', 'closed') and resolved_at is not null)
    or status not in ('resolved', 'closed')
  )
);

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  content jsonb not null default '{}'::jsonb,
  status public.page_status not null default 'draft',
  seo_title text,
  seo_description text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pages_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint pages_title_length check (char_length(title) between 1 and 200),
  constraint pages_content_object check (jsonb_typeof(content) = 'object'),
  constraint pages_published_at_consistent check (
    (status = 'published' and published_at is not null)
    or status <> 'published'
  )
);

create table public.site_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null,
  description text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_settings_key_format
    check (key ~ '^[a-z0-9]+(?:[._][a-z0-9]+)*$')
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  request_id uuid,
  created_at timestamptz not null default now(),
  constraint audit_logs_action_format
    check (action ~ '^[a-z0-9]+(?:[._][a-z0-9]+)*$'),
  constraint audit_logs_entity_type_format
    check (entity_type ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  constraint audit_logs_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index advisory_sessions_user_id_idx
  on public.advisory_sessions (user_id);
create index advisory_sessions_status_created_at_idx
  on public.advisory_sessions (status, created_at desc);
create index advisory_answers_session_id_idx
  on public.advisory_answers (session_id);
create index advisory_recommendations_session_id_idx
  on public.advisory_recommendations (session_id);
create index advisory_recommendations_product_id_idx
  on public.advisory_recommendations (product_id);
create index advisory_recommendations_variant_id_idx
  on public.advisory_recommendations (variant_id);
create index advisory_recommendations_created_by_idx
  on public.advisory_recommendations (created_by);
create index advisory_requests_user_id_idx
  on public.advisory_requests (user_id);
create index advisory_requests_session_id_idx
  on public.advisory_requests (session_id);
create index advisory_requests_product_id_idx
  on public.advisory_requests (product_id);
create index advisory_requests_assigned_to_idx
  on public.advisory_requests (assigned_to);
create index advisory_requests_status_created_at_idx
  on public.advisory_requests (status, created_at desc);
create index pages_status_published_at_idx
  on public.pages (status, published_at desc);
create index audit_logs_actor_id_idx on public.audit_logs (actor_id);
create index audit_logs_entity_idx
  on public.audit_logs (entity_type, entity_id, created_at desc);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_request_id_idx
  on public.audit_logs (request_id)
  where request_id is not null;

create trigger advisory_sessions_set_updated_at
before update on public.advisory_sessions
for each row execute function public.set_updated_at();

create trigger advisory_answers_set_updated_at
before update on public.advisory_answers
for each row execute function public.set_updated_at();

create trigger advisory_recommendations_set_updated_at
before update on public.advisory_recommendations
for each row execute function public.set_updated_at();

create trigger advisory_requests_set_updated_at
before update on public.advisory_requests
for each row execute function public.set_updated_at();

create trigger pages_set_updated_at
before update on public.pages
for each row execute function public.set_updated_at();

create trigger site_settings_set_updated_at
before update on public.site_settings
for each row execute function public.set_updated_at();

create trigger audit_logs_are_immutable
before update or delete on public.audit_logs
for each row execute function public.reject_immutable_row_change();

