-- Marketplace Partner listings, immutable review snapshots and isolated
-- inventory foundation. Pricing, public publication, checkout and payouts are
-- intentionally deferred.

create type public.marketplace_listing_status as enum (
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'CHANGES_REQUESTED',
  'APPROVED',
  'PUBLISHED',
  'PAUSED',
  'SOLD',
  'REJECTED',
  'EXPIRED',
  'ARCHIVED'
);

create type public.marketplace_listing_version_state as enum (
  'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'
);

create type public.marketplace_listing_ownership as enum ('PARTNER_OWNED');
create type public.marketplace_listing_custody as enum (
  'PARTNER_CUSTODY', 'BEST_ROUND_CUSTODY'
);
create type public.marketplace_listing_fulfillment as enum (
  'PARTNER_FULFILLED', 'BEST_ROUND_FULFILLED'
);
create type public.marketplace_listing_image_requirement as enum (
  'REQUIRED', 'RECOMMENDED', 'OPTIONAL'
);
create type public.marketplace_listing_review_visibility as enum (
  'INTERNAL', 'PARTNER_VISIBLE'
);
create type public.marketplace_listing_review_area as enum (
  'PHOTOS', 'SPECS', 'CONDITION', 'DESCRIPTION',
  'PRODUCT_IDENTITY', 'QUANTITY', 'OTHER'
);
create type public.marketplace_listing_review_request_status as enum (
  'OPEN', 'RESOLVED'
);
create type public.marketplace_listing_evaluation_source as enum (
  'HUMAN', 'AI', 'HYBRID'
);
create type public.marketplace_listing_evaluation_status as enum (
  'NOT_STARTED', 'PENDING', 'COMPLETED', 'FAILED'
);
create type public.marketplace_inventory_movement_type as enum (
  'INITIAL', 'SET_QUANTITY', 'RESERVE', 'RELEASE',
  'SALE', 'RETURN', 'ADJUSTMENT'
);

create table public.catalog_product_models (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete restrict,
  category_id uuid not null references public.categories (id) on delete restrict,
  source_product_id uuid references public.products (id) on delete restrict,
  model_name text not null,
  normalized_model_name text not null,
  status public.catalog_record_status not null default 'active',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_product_models_name_length
    check (char_length(btrim(model_name)) between 1 and 160),
  constraint catalog_product_models_normalized_format check (
    normalized_model_name ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  unique (brand_id, category_id, normalized_model_name)
);

create table public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_profiles (id) on delete restrict,
  status public.marketplace_listing_status not null default 'DRAFT',
  lock_version integer not null default 1 check (lock_version > 0),
  current_version_id uuid,
  approved_version_id uuid,
  last_submitted_at timestamptz,
  approved_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_listings_state_timestamps check (
    (status <> 'APPROVED' or (approved_version_id is not null and approved_at is not null))
    and (status <> 'ARCHIVED' or archived_at is not null)
  )
);

create table public.marketplace_listing_versions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings (id) on delete restrict,
  version_number integer not null check (version_number > 0),
  state public.marketplace_listing_version_state not null default 'DRAFT',
  canonical_model_id uuid references public.catalog_product_models (id) on delete restrict,
  brand_id uuid references public.brands (id) on delete restrict,
  category_id uuid not null references public.categories (id) on delete restrict,
  proposed_brand text,
  proposed_model text,
  title text,
  description text,
  condition public.product_condition,
  condition_grade public.product_condition_grade,
  condition_notes text,
  declared_defects jsonb not null default '[]'::jsonb,
  defects_acknowledged boolean not null default false,
  accessories_included jsonb not null default '[]'::jsonb,
  specifications jsonb not null default '{}'::jsonb,
  serial_number_private text,
  quantity integer not null default 1 check (quantity > 0),
  ownership public.marketplace_listing_ownership not null default 'PARTNER_OWNED',
  custody public.marketplace_listing_custody not null default 'PARTNER_CUSTODY',
  fulfillment public.marketplace_listing_fulfillment not null default 'PARTNER_FULFILLED',
  evaluation_source public.marketplace_listing_evaluation_source not null default 'HUMAN',
  evaluation_status public.marketplace_listing_evaluation_status not null default 'NOT_STARTED',
  evaluation_confidence numeric(5, 4),
  evaluation_summary text,
  evaluation_output jsonb,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_listing_versions_unique unique (listing_id, version_number),
  constraint marketplace_listing_versions_listing_id_unique unique (listing_id, id),
  constraint marketplace_listing_versions_title_length
    check (title is null or char_length(btrim(title)) between 3 and 180),
  constraint marketplace_listing_versions_description_length
    check (description is null or char_length(btrim(description)) between 3 and 4000),
  constraint marketplace_listing_versions_description_plain_text
    check (description is null or description !~ '<[^>]+>'),
  constraint marketplace_listing_versions_condition_notes_length
    check (condition_notes is null or char_length(btrim(condition_notes)) between 3 and 1000),
  constraint marketplace_listing_versions_proposal_length check (
    (proposed_brand is null or char_length(btrim(proposed_brand)) between 1 and 120)
    and (proposed_model is null or char_length(btrim(proposed_model)) between 1 and 160)
  ),
  constraint marketplace_listing_versions_json_shapes check (
    jsonb_typeof(declared_defects) = 'array'
    and jsonb_typeof(accessories_included) = 'array'
    and jsonb_typeof(specifications) = 'object'
    and (evaluation_output is null or jsonb_typeof(evaluation_output) = 'object')
  ),
  constraint marketplace_listing_versions_new_condition_shape check (
    condition <> 'new' or condition_grade is null
  ),
  constraint marketplace_listing_versions_serial_length
    check (serial_number_private is null or char_length(btrim(serial_number_private)) between 2 and 120),
  constraint marketplace_listing_versions_evaluation_confidence check (
    evaluation_confidence is null or evaluation_confidence between 0 and 1
  ),
  constraint marketplace_listing_versions_evaluation_summary_length
    check (evaluation_summary is null or char_length(btrim(evaluation_summary)) between 3 and 2000),
  constraint marketplace_listing_versions_snapshot_timestamps check (
    (state = 'DRAFT' or submitted_at is not null)
    and (state not in ('APPROVED', 'REJECTED') or reviewed_at is not null)
  )
);

alter table public.marketplace_listings
  add constraint marketplace_listings_current_version_fk
    foreign key (id, current_version_id)
    references public.marketplace_listing_versions (listing_id, id) on delete restrict,
  add constraint marketplace_listings_approved_version_fk
    foreign key (id, approved_version_id)
    references public.marketplace_listing_versions (listing_id, id) on delete restrict;

create table public.marketplace_listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings (id) on delete restrict,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  width_pixels integer check (width_pixels is null or width_pixels between 1 and 12000),
  height_pixels integer check (height_pixels is null or height_pixels between 1 and 12000),
  sha256 text not null,
  uploaded_by uuid not null references public.profiles (id) on delete restrict,
  uploaded_at timestamptz not null default now(),
  constraint marketplace_listing_images_path_format check (
    storage_path ~ '^listings/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
  ),
  constraint marketplace_listing_images_mime_allowed
    check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  constraint marketplace_listing_images_sha256_format
    check (sha256 ~ '^[0-9a-f]{64}$')
);

create table public.marketplace_listing_version_images (
  version_id uuid not null references public.marketplace_listing_versions (id) on delete restrict,
  image_id uuid not null references public.marketplace_listing_images (id) on delete restrict,
  image_type text not null,
  requirement public.marketplace_listing_image_requirement not null,
  sort_order integer not null default 0 check (sort_order >= 0),
  alt_text text not null,
  is_sensitive boolean not null default false,
  primary key (version_id, image_id),
  constraint marketplace_listing_version_images_type_format
    check (image_type ~ '^[a-z][a-z0-9_]{1,63}$'),
  constraint marketplace_listing_version_images_alt_length
    check (char_length(btrim(alt_text)) between 3 and 240),
  unique (version_id, sort_order)
);

create table public.marketplace_listing_photo_requirements (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete restrict,
  condition public.product_condition,
  image_type text not null,
  requirement public.marketplace_listing_image_requirement not null,
  label text not null,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  constraint marketplace_listing_photo_requirements_type_format
    check (image_type ~ '^[a-z][a-z0-9_]{1,63}$'),
  constraint marketplace_listing_photo_requirements_label_length
    check (char_length(btrim(label)) between 2 and 80)
);

create unique index marketplace_listing_photo_requirements_generic_unique
  on public.marketplace_listing_photo_requirements (category_id, image_type)
  where condition is null;
create unique index marketplace_listing_photo_requirements_condition_unique
  on public.marketplace_listing_photo_requirements
  (category_id, condition, image_type)
  where condition is not null;

create table public.marketplace_listing_inventory (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null unique references public.marketplace_listings (id) on delete restrict,
  quantity_on_hand integer not null default 0 check (quantity_on_hand >= 0),
  quantity_reserved integer not null default 0 check (quantity_reserved >= 0),
  quantity_available integer generated always as (quantity_on_hand - quantity_reserved) stored,
  version integer not null default 1 check (version > 0),
  ownership public.marketplace_listing_ownership not null default 'PARTNER_OWNED',
  custody public.marketplace_listing_custody not null default 'PARTNER_CUSTODY',
  fulfillment public.marketplace_listing_fulfillment not null default 'PARTNER_FULFILLED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_listing_inventory_reserved_within_on_hand
    check (quantity_reserved <= quantity_on_hand)
);

create table public.marketplace_listing_inventory_movements (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references public.marketplace_listing_inventory (id) on delete restrict,
  listing_version_id uuid references public.marketplace_listing_versions (id) on delete restrict,
  movement_type public.marketplace_inventory_movement_type not null,
  quantity_on_hand_delta integer not null,
  quantity_reserved_delta integer not null default 0,
  quantity_on_hand_after integer not null check (quantity_on_hand_after >= 0),
  quantity_reserved_after integer not null check (quantity_reserved_after >= 0),
  actor_id uuid references public.profiles (id) on delete set null,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint marketplace_listing_inventory_movements_nonzero check (
    quantity_on_hand_delta <> 0 or quantity_reserved_delta <> 0
    or movement_type = 'INITIAL'
  ),
  constraint marketplace_listing_inventory_movements_balance check (
    quantity_reserved_after <= quantity_on_hand_after
  ),
  constraint marketplace_listing_inventory_movements_reason_length
    check (char_length(btrim(reason)) between 3 and 500)
);

create table public.marketplace_listing_status_history (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings (id) on delete restrict,
  listing_version_id uuid references public.marketplace_listing_versions (id) on delete restrict,
  from_status public.marketplace_listing_status,
  to_status public.marketplace_listing_status not null,
  actor_id uuid references public.profiles (id) on delete set null,
  reason text,
  lock_version integer not null check (lock_version > 0),
  created_at timestamptz not null default now(),
  constraint marketplace_listing_status_history_reason_length
    check (reason is null or char_length(btrim(reason)) between 3 and 1000)
);

create table public.marketplace_listing_review_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings (id) on delete restrict,
  listing_version_id uuid not null references public.marketplace_listing_versions (id) on delete restrict,
  area public.marketplace_listing_review_area not null,
  visibility public.marketplace_listing_review_visibility not null,
  status public.marketplace_listing_review_request_status not null default 'OPEN',
  comment text not null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint marketplace_listing_review_requests_comment_length
    check (char_length(btrim(comment)) between 3 and 1000),
  constraint marketplace_listing_review_requests_resolution check (
    (status = 'OPEN' and resolved_by is null and resolved_at is null)
    or (status = 'RESOLVED' and resolved_at is not null)
  )
);

create index catalog_product_models_search_idx
  on public.catalog_product_models (brand_id, category_id, normalized_model_name);
create index marketplace_listings_partner_status_idx
  on public.marketplace_listings (partner_id, status, updated_at desc, id);
create index marketplace_listings_review_queue_idx
  on public.marketplace_listings (status, last_submitted_at, updated_at, id);
create index marketplace_listing_versions_listing_idx
  on public.marketplace_listing_versions (listing_id, version_number desc);
create index marketplace_listing_images_listing_idx
  on public.marketplace_listing_images (listing_id, uploaded_at desc);
create index marketplace_listing_inventory_movements_idx
  on public.marketplace_listing_inventory_movements (inventory_id, created_at desc);
create index marketplace_listing_status_history_idx
  on public.marketplace_listing_status_history (listing_id, created_at desc);
create index marketplace_listing_review_requests_idx
  on public.marketplace_listing_review_requests (listing_id, status, visibility, created_at desc);

create trigger catalog_product_models_set_updated_at
before update on public.catalog_product_models
for each row execute function public.set_updated_at();
create trigger marketplace_listings_set_updated_at
before update on public.marketplace_listings
for each row execute function public.set_updated_at();
create trigger marketplace_listing_versions_set_updated_at
before update on public.marketplace_listing_versions
for each row execute function public.set_updated_at();
create trigger marketplace_listing_inventory_set_updated_at
before update on public.marketplace_listing_inventory
for each row execute function public.set_updated_at();

create trigger marketplace_inventory_movements_are_immutable
before update or delete on public.marketplace_listing_inventory_movements
for each row execute function public.reject_immutable_row_change();
create trigger marketplace_listing_history_is_immutable
before update or delete on public.marketplace_listing_status_history
for each row execute function public.reject_immutable_row_change();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'marketplace-listing-images',
  'marketplace-listing-images',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- A used Driver needs the three decision-making views. Other supported
-- categories start with one overview image and can evolve through data rather
-- than application changes.
insert into public.marketplace_listing_photo_requirements (
  category_id, condition, image_type, requirement, label, sort_order
)
select category_spec_profiles.category_id, null, 'overview', 'REQUIRED',
  'Vista general', 10
from public.category_spec_profiles
where category_spec_profiles.club_type is distinct from 'driver'
on conflict do nothing;

create or replace function public.can_manage_marketplace_listings()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    inner join public.roles on roles.id = user_roles.role_id
    where user_roles.user_id = (select auth.uid())
      and roles.name in ('operator', 'admin')
  );
$$;

create or replace function private.normalize_catalog_model_name(requested text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(
    lower(translate(btrim(requested),
      'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')),
    '[^a-z0-9]+', '-', 'g'
  ));
$$;

create or replace function private.marketplace_listing_owned_by_current_user(
  requested_listing_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.marketplace_listings
    inner join public.partner_profiles
      on partner_profiles.id = marketplace_listings.partner_id
    where marketplace_listings.id = requested_listing_id
      and partner_profiles.user_id = (select auth.uid())
  );
$$;

create or replace function private.marketplace_listing_partner_is_verified(
  requested_listing_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.marketplace_listings
    inner join public.partner_profiles
      on partner_profiles.id = marketplace_listings.partner_id
    where marketplace_listings.id = requested_listing_id
      and partner_profiles.user_id = (select auth.uid())
      and partner_profiles.status = 'VERIFIED'
  );
$$;

create or replace function private.guard_marketplace_listing_version_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  transition_write boolean :=
    current_setting('app.marketplace_listing_transition_write', true) = 'enabled';
  review_write boolean :=
    current_setting('app.marketplace_listing_review_write', true) = 'enabled';
begin
  if tg_op = 'DELETE' then
    raise exception 'Marketplace listing versions are immutable'
      using errcode = '55000';
  end if;

  if old.state = 'DRAFT' then
    return new;
  end if;

  if not (transition_write or review_write) then
    raise exception 'Submitted Marketplace listing version is immutable'
      using errcode = '55000';
  end if;

  if review_write and row(
      old.listing_id, old.version_number, old.brand_id, old.category_id,
      old.proposed_brand, old.proposed_model, old.title, old.description,
      old.condition, old.condition_grade, old.condition_notes,
      old.declared_defects, old.defects_acknowledged,
      old.accessories_included, old.specifications, old.serial_number_private,
      old.quantity, old.ownership, old.custody, old.fulfillment,
      old.created_by, old.created_at, old.submitted_at
    ) is distinct from row(
      new.listing_id, new.version_number, new.brand_id, new.category_id,
      new.proposed_brand, new.proposed_model, new.title, new.description,
      new.condition, new.condition_grade, new.condition_notes,
      new.declared_defects, new.defects_acknowledged,
      new.accessories_included, new.specifications, new.serial_number_private,
      new.quantity, new.ownership, new.custody, new.fulfillment,
      new.created_by, new.created_at, new.submitted_at
    )
  then
    raise exception 'Review may not rewrite submitted listing material data'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

-- Forward declarations keep privileges adjacent to the schema. Complete
-- transactional implementations replace these bodies below.
create function public.get_marketplace_listing_readiness(requested_listing_id uuid)
returns table (
  product_identity_complete boolean, required_specs_complete boolean,
  condition_complete boolean, required_photos_complete boolean,
  quantity_valid boolean, defects_acknowledged boolean, ready boolean,
  missing_fields text[]
) language sql stable security definer set search_path = ''
as $$ select false, false, false, false, false, false, false, array[]::text[] $$;

create function public.create_marketplace_listing(requested_category_id uuid)
returns public.marketplace_listings language sql security definer set search_path = ''
as $$ select null::public.marketplace_listings $$;
create function public.save_marketplace_listing_draft(
  requested_listing_id uuid, expected_lock_version integer, requested_payload jsonb
)
returns public.marketplace_listings language sql security definer set search_path = ''
as $$ select null::public.marketplace_listings $$;
create function public.register_marketplace_listing_image(
  requested_listing_id uuid, expected_lock_version integer,
  requested_image_id uuid, requested_storage_path text,
  requested_image_type text, requested_alt_text text,
  requested_mime_type text, requested_size_bytes bigint,
  requested_sha256 text, requested_width_pixels integer,
  requested_height_pixels integer
) returns public.marketplace_listing_images language sql security definer set search_path = ''
as $$ select null::public.marketplace_listing_images $$;
create function public.remove_marketplace_listing_image(
  requested_listing_id uuid, expected_lock_version integer,
  requested_image_id uuid
)
returns table (removed_storage_path text, delete_storage_object boolean)
language sql security definer set search_path = ''
as $$ select null::text, false $$;
create function public.reorder_marketplace_listing_images(
  requested_listing_id uuid, expected_lock_version integer,
  requested_image_ids uuid[]
)
returns public.marketplace_listings language sql security definer set search_path = ''
as $$ select null::public.marketplace_listings $$;
create function public.resolve_marketplace_listing_product(
  requested_listing_id uuid, expected_lock_version integer,
  requested_model_id uuid, requested_brand_id uuid,
  requested_model_name text, requested_reason text
) returns public.catalog_product_models language sql security definer set search_path = ''
as $$ select null::public.catalog_product_models $$;
create function public.submit_marketplace_listing(
  requested_listing_id uuid, expected_lock_version integer
)
returns public.marketplace_listings language sql security definer set search_path = ''
as $$ select null::public.marketplace_listings $$;
create function public.transition_marketplace_listing_status(
  requested_listing_id uuid, expected_lock_version integer,
  requested_status public.marketplace_listing_status,
  requested_reason text, requested_feedback jsonb,
  requested_internal_note text
) returns public.marketplace_listings language sql security definer set search_path = ''
as $$ select null::public.marketplace_listings $$;
create function public.archive_marketplace_listing(
  requested_listing_id uuid, expected_lock_version integer,
  requested_reason text
)
returns public.marketplace_listings language sql security definer set search_path = ''
as $$ select null::public.marketplace_listings $$;

create function private.marketplace_listing_specs_complete(
  requested_category_id uuid, requested_specs jsonb
) returns boolean language sql stable security definer set search_path = ''
as $$ select false $$;
create function private.marketplace_listing_required_photos_complete(
  requested_version_id uuid, requested_category_id uuid,
  requested_condition public.product_condition
) returns boolean language sql stable security definer set search_path = ''
as $$ select false $$;

alter table public.catalog_product_models enable row level security;
alter table public.marketplace_listings enable row level security;
alter table public.marketplace_listing_versions enable row level security;
alter table public.marketplace_listing_images enable row level security;
alter table public.marketplace_listing_version_images enable row level security;
alter table public.marketplace_listing_photo_requirements enable row level security;
alter table public.marketplace_listing_inventory enable row level security;
alter table public.marketplace_listing_inventory_movements enable row level security;
alter table public.marketplace_listing_status_history enable row level security;
alter table public.marketplace_listing_review_requests enable row level security;

create policy "Marketplace Partners can read active brands"
on public.brands for select to authenticated
using (
  status = 'active'
  and (select public.is_marketplace_enabled())
  and exists (
    select 1 from public.partner_profiles
    where partner_profiles.user_id = (select auth.uid())
  )
);

create policy "Marketplace Partners can read active categories"
on public.categories for select to authenticated
using (
  status = 'active'
  and (select public.is_marketplace_enabled())
  and exists (
    select 1 from public.partner_profiles
    where partner_profiles.user_id = (select auth.uid())
  )
);

create policy "Marketplace Partners can read category spec profiles"
on public.category_spec_profiles for select to authenticated
using (
  (select public.is_marketplace_enabled())
  and exists (
    select 1 from public.partner_profiles
    where partner_profiles.user_id = (select auth.uid())
  )
);

create policy "Partners can read canonical Marketplace models"
on public.catalog_product_models for select to authenticated
using (
  status = 'active'
  and (select public.is_marketplace_enabled())
  and exists (
    select 1 from public.partner_profiles
    where partner_profiles.user_id = (select auth.uid())
  )
);

create policy "Marketplace listing staff can read canonical models"
on public.catalog_product_models for select to authenticated
using ((select public.can_manage_marketplace_listings()));

create policy "Partners can read own Marketplace listings"
on public.marketplace_listings for select to authenticated
using (
  exists (
    select 1 from public.partner_profiles
    where partner_profiles.id = marketplace_listings.partner_id
      and partner_profiles.user_id = (select auth.uid())
  )
);

create policy "Marketplace listing staff can read listings"
on public.marketplace_listings for select to authenticated
using ((select public.can_manage_marketplace_listings()));

create policy "Partners can read own Marketplace listing versions"
on public.marketplace_listing_versions for select to authenticated
using (
  private.marketplace_listing_owned_by_current_user(listing_id)
);

create policy "Marketplace listing staff can read listing versions"
on public.marketplace_listing_versions for select to authenticated
using ((select public.can_manage_marketplace_listings()));

create policy "Partners can read own Marketplace listing image metadata"
on public.marketplace_listing_images for select to authenticated
using (private.marketplace_listing_owned_by_current_user(listing_id));

create policy "Marketplace listing staff can read listing image metadata"
on public.marketplace_listing_images for select to authenticated
using ((select public.can_manage_marketplace_listings()));

create policy "Partners can read own Marketplace listing image assignments"
on public.marketplace_listing_version_images for select to authenticated
using (
  exists (
    select 1 from public.marketplace_listing_versions
    where marketplace_listing_versions.id = marketplace_listing_version_images.version_id
      and private.marketplace_listing_owned_by_current_user(
        marketplace_listing_versions.listing_id
      )
  )
);

create policy "Marketplace listing staff can read image assignments"
on public.marketplace_listing_version_images for select to authenticated
using ((select public.can_manage_marketplace_listings()));

create policy "Partners can read Marketplace photo requirements"
on public.marketplace_listing_photo_requirements for select to authenticated
using (
  (select public.is_marketplace_enabled())
  and exists (
    select 1 from public.partner_profiles
    where partner_profiles.user_id = (select auth.uid())
  )
);

create policy "Marketplace listing staff can read photo requirements"
on public.marketplace_listing_photo_requirements for select to authenticated
using ((select public.can_manage_marketplace_listings()));

create policy "Partners can read own Marketplace listing inventory"
on public.marketplace_listing_inventory for select to authenticated
using (private.marketplace_listing_owned_by_current_user(listing_id));

create policy "Marketplace listing staff can read listing inventory"
on public.marketplace_listing_inventory for select to authenticated
using ((select public.can_manage_marketplace_listings()));

create policy "Partners can read own Marketplace inventory movements"
on public.marketplace_listing_inventory_movements for select to authenticated
using (
  exists (
    select 1 from public.marketplace_listing_inventory
    where marketplace_listing_inventory.id = marketplace_listing_inventory_movements.inventory_id
      and private.marketplace_listing_owned_by_current_user(
        marketplace_listing_inventory.listing_id
      )
  )
);

create policy "Marketplace listing staff can read inventory movements"
on public.marketplace_listing_inventory_movements for select to authenticated
using ((select public.can_manage_marketplace_listings()));

create policy "Partners can read own Marketplace listing history"
on public.marketplace_listing_status_history for select to authenticated
using (private.marketplace_listing_owned_by_current_user(listing_id));

create policy "Marketplace listing staff can read listing history"
on public.marketplace_listing_status_history for select to authenticated
using ((select public.can_manage_marketplace_listings()));

create policy "Partners can read visible own Marketplace review requests"
on public.marketplace_listing_review_requests for select to authenticated
using (
  visibility = 'PARTNER_VISIBLE'
  and private.marketplace_listing_owned_by_current_user(listing_id)
);

create policy "Marketplace listing staff can read all review requests"
on public.marketplace_listing_review_requests for select to authenticated
using ((select public.can_manage_marketplace_listings()));

create policy "Partners can read own private Marketplace listing images"
on storage.objects for select to authenticated
using (
  bucket_id = 'marketplace-listing-images'
  and name ~ '^listings/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
  and exists (
    select 1 from public.marketplace_listings
    inner join public.partner_profiles
      on partner_profiles.id = marketplace_listings.partner_id
    where partner_profiles.id::text = (storage.foldername(storage.objects.name))[2]
      and marketplace_listings.id::text = (storage.foldername(storage.objects.name))[3]
      and partner_profiles.user_id = (select auth.uid())
  )
);

create policy "Verified Partners can upload draft Marketplace listing images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'marketplace-listing-images'
  and name ~ '^listings/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
  and exists (
    select 1 from public.marketplace_listings
    inner join public.partner_profiles
      on partner_profiles.id = marketplace_listings.partner_id
    inner join public.marketplace_listing_versions
      on marketplace_listing_versions.id = marketplace_listings.current_version_id
    where partner_profiles.id::text = (storage.foldername(storage.objects.name))[2]
      and marketplace_listings.id::text = (storage.foldername(storage.objects.name))[3]
      and marketplace_listing_versions.id::text = (storage.foldername(storage.objects.name))[4]
      and partner_profiles.user_id = (select auth.uid())
      and partner_profiles.status = 'VERIFIED'
      and marketplace_listings.status in ('DRAFT', 'CHANGES_REQUESTED')
      and marketplace_listing_versions.state = 'DRAFT'
  )
);

create policy "Partners can delete unreferenced draft Marketplace images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'marketplace-listing-images'
  and exists (
    select 1 from public.marketplace_listings
    inner join public.partner_profiles
      on partner_profiles.id = marketplace_listings.partner_id
    inner join public.marketplace_listing_versions
      on marketplace_listing_versions.id = marketplace_listings.current_version_id
    where partner_profiles.id::text = (storage.foldername(storage.objects.name))[2]
      and marketplace_listings.id::text = (storage.foldername(storage.objects.name))[3]
      and marketplace_listing_versions.id::text = (storage.foldername(storage.objects.name))[4]
      and partner_profiles.user_id = (select auth.uid())
      and partner_profiles.status = 'VERIFIED'
      and marketplace_listing_versions.state = 'DRAFT'
  )
  and not exists (
    select 1 from public.marketplace_listing_images
    where marketplace_listing_images.storage_path = storage.objects.name
  )
);

create policy "Marketplace listing staff can read private listing images"
on storage.objects for select to authenticated
using (
  bucket_id = 'marketplace-listing-images'
  and (select public.can_manage_marketplace_listings())
);

revoke all on public.catalog_product_models from anon, authenticated;
revoke all on public.marketplace_listings from anon, authenticated;
revoke all on public.marketplace_listing_versions from anon, authenticated;
revoke all on public.marketplace_listing_images from anon, authenticated;
revoke all on public.marketplace_listing_version_images from anon, authenticated;
revoke all on public.marketplace_listing_photo_requirements from anon, authenticated;
revoke all on public.marketplace_listing_inventory from anon, authenticated;
revoke all on public.marketplace_listing_inventory_movements from anon, authenticated;
revoke all on public.marketplace_listing_status_history from anon, authenticated;
revoke all on public.marketplace_listing_review_requests from anon, authenticated;

grant select on public.catalog_product_models to authenticated;
grant select on public.marketplace_listings to authenticated;
grant select on public.marketplace_listing_versions to authenticated;
grant select on public.marketplace_listing_images to authenticated;
grant select on public.marketplace_listing_version_images to authenticated;
grant select on public.marketplace_listing_photo_requirements to authenticated;
grant select on public.marketplace_listing_inventory to authenticated;
grant select on public.marketplace_listing_inventory_movements to authenticated;
grant select on public.marketplace_listing_status_history to authenticated;
grant select on public.marketplace_listing_review_requests to authenticated;

revoke all on function public.can_manage_marketplace_listings()
  from public, anon;
revoke all on function public.get_marketplace_listing_readiness(uuid)
  from public, anon;
revoke all on function public.create_marketplace_listing(uuid)
  from public, anon;
revoke all on function public.save_marketplace_listing_draft(uuid, integer, jsonb)
  from public, anon;
revoke all on function public.register_marketplace_listing_image(
  uuid, integer, uuid, text, text, text, text, bigint, text, integer, integer
) from public, anon;
revoke all on function public.remove_marketplace_listing_image(uuid, integer, uuid)
  from public, anon;
revoke all on function public.reorder_marketplace_listing_images(uuid, integer, uuid[])
  from public, anon;
revoke all on function public.resolve_marketplace_listing_product(
  uuid, integer, uuid, uuid, text, text
) from public, anon;
revoke all on function public.submit_marketplace_listing(uuid, integer)
  from public, anon;
revoke all on function public.transition_marketplace_listing_status(
  uuid, integer, public.marketplace_listing_status, text, jsonb, text
) from public, anon;
revoke all on function public.archive_marketplace_listing(uuid, integer, text)
  from public, anon;

revoke all on function private.normalize_catalog_model_name(text)
  from public, anon, authenticated;
revoke all on function private.marketplace_listing_owned_by_current_user(uuid)
  from public, anon;
revoke all on function private.marketplace_listing_partner_is_verified(uuid)
  from public, anon, authenticated;
revoke all on function private.guard_marketplace_listing_version_change()
  from public, anon, authenticated;
revoke all on function private.marketplace_listing_specs_complete(uuid, jsonb)
  from public, anon, authenticated;
revoke all on function private.marketplace_listing_required_photos_complete(
  uuid, uuid, public.product_condition
) from public, anon, authenticated;

grant execute on function public.can_manage_marketplace_listings()
  to authenticated;
grant execute on function private.marketplace_listing_owned_by_current_user(uuid)
  to authenticated;
grant execute on function public.get_marketplace_listing_readiness(uuid)
  to authenticated;
grant execute on function public.create_marketplace_listing(uuid)
  to authenticated;
grant execute on function public.save_marketplace_listing_draft(uuid, integer, jsonb)
  to authenticated;
grant execute on function public.register_marketplace_listing_image(
  uuid, integer, uuid, text, text, text, text, bigint, text, integer, integer
) to authenticated;
grant execute on function public.remove_marketplace_listing_image(uuid, integer, uuid)
  to authenticated;
grant execute on function public.reorder_marketplace_listing_images(uuid, integer, uuid[])
  to authenticated;
grant execute on function public.resolve_marketplace_listing_product(
  uuid, integer, uuid, uuid, text, text
) to authenticated;
grant execute on function public.submit_marketplace_listing(uuid, integer)
  to authenticated;
grant execute on function public.transition_marketplace_listing_status(
  uuid, integer, public.marketplace_listing_status, text, jsonb, text
) to authenticated;
grant execute on function public.archive_marketplace_listing(uuid, integer, text)
  to authenticated;

comment on table public.catalog_product_models is
  'Canonical brand + model + category identity; it references and never replaces catalog taxonomy.';
comment on table public.marketplace_listing_versions is
  'Versioned Partner offer snapshots. Submitted/approved material data is immutable.';
comment on column public.marketplace_listing_versions.serial_number_private is
  'Private serial visible only to listing owner and authorized Operations; never public or audited.';
comment on table public.marketplace_listing_inventory is
  'Partner-owned Marketplace inventory, isolated from first-party inventory.';
comment on table public.marketplace_listing_review_requests is
  'Structured human review feedback; INTERNAL rows are never visible to Partners.';
comment on column public.marketplace_listing_versions.evaluation_output is
  'Reserved structured contract for future Product Evaluator output; no AI runs in PR 3.';

create or replace function public.resolve_marketplace_listing_product(
  requested_listing_id uuid,
  expected_lock_version integer,
  requested_model_id uuid,
  requested_brand_id uuid,
  requested_model_name text,
  requested_reason text
)
returns public.catalog_product_models
language plpgsql
security definer
set search_path = ''
as $$
declare
  listing_record public.marketplace_listings;
  version_record public.marketplace_listing_versions;
  model_record public.catalog_product_models;
  normalized_name text;
  reason_value text := btrim(requested_reason);
begin
  if not public.can_manage_marketplace_listings() then
    raise exception 'Marketplace listing review denied' using errcode = '42501';
  end if;
  if char_length(reason_value) not between 3 and 500 then
    raise exception 'A review reason between 3 and 500 characters is required'
      using errcode = '22023';
  end if;

  select * into listing_record from public.marketplace_listings
  where id = requested_listing_id for update;
  if not found or listing_record.status not in ('SUBMITTED', 'UNDER_REVIEW')
    or listing_record.lock_version <> expected_lock_version
  then
    raise exception 'Marketplace listing version conflict or not reviewable'
      using errcode = '40001';
  end if;
  select * into strict version_record from public.marketplace_listing_versions
  where id = listing_record.current_version_id and state = 'SUBMITTED'
  for update;

  if requested_model_id is not null then
    select * into model_record from public.catalog_product_models
    where id = requested_model_id and status = 'active';
    if not found or model_record.category_id <> version_record.category_id then
      raise exception 'Canonical model does not match listing category'
        using errcode = '23514';
    end if;
  else
    normalized_name := private.normalize_catalog_model_name(requested_model_name);
    if requested_brand_id is null or char_length(normalized_name) < 1
      or not exists (
        select 1 from public.brands
        where id = requested_brand_id and status = 'active'
      )
    then
      raise exception 'Active brand and valid model name are required'
        using errcode = '22023';
    end if;

    insert into public.catalog_product_models (
      brand_id, category_id, model_name, normalized_model_name, created_by
    ) values (
      requested_brand_id, version_record.category_id,
      regexp_replace(btrim(requested_model_name), '\s+', ' ', 'g'),
      normalized_name, (select auth.uid())
    )
    on conflict (brand_id, category_id, normalized_model_name)
      do update set model_name = catalog_product_models.model_name
    returning * into model_record;
  end if;

  perform set_config('app.marketplace_listing_review_write', 'enabled', true);
  update public.marketplace_listing_versions
  set canonical_model_id = model_record.id,
      brand_id = model_record.brand_id
  where id = version_record.id;

  update public.marketplace_listings
  set lock_version = lock_version + 1
  where id = listing_record.id;

  perform private.write_marketplace_audit(
    'marketplace.canonical_product_linked',
    'marketplace_listing', listing_record.id, reason_value,
    jsonb_build_object('canonical_model_id', version_record.canonical_model_id),
    jsonb_build_object(
      'canonical_model_id', model_record.id,
      'brand_id', model_record.brand_id,
      'category_id', model_record.category_id,
      'version_number', version_record.version_number
    )
  );

  return model_record;
end;
$$;

create or replace function public.submit_marketplace_listing(
  requested_listing_id uuid,
  expected_lock_version integer
)
returns public.marketplace_listings
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  listing_record public.marketplace_listings;
  version_record public.marketplace_listing_versions;
  listing_ready boolean;
  old_status public.marketplace_listing_status;
begin
  if current_user_id is null or not public.is_marketplace_enabled()
    or not private.marketplace_listing_partner_is_verified(requested_listing_id)
  then
    raise exception 'Verified Partner required' using errcode = '42501';
  end if;

  select * into listing_record from public.marketplace_listings
  where id = requested_listing_id for update;
  if not found or listing_record.status not in ('DRAFT', 'CHANGES_REQUESTED')
    or listing_record.lock_version <> expected_lock_version
  then
    raise exception 'Marketplace listing version conflict or not submittable'
      using errcode = '40001';
  end if;
  select * into strict version_record from public.marketplace_listing_versions
  where id = listing_record.current_version_id and state = 'DRAFT'
  for update;

  select readiness.ready into listing_ready
  from public.get_marketplace_listing_readiness(requested_listing_id) readiness;
  if not coalesce(listing_ready, false) then
    raise exception 'Marketplace listing is not ready to submit'
      using errcode = '23514';
  end if;

  old_status := listing_record.status;

  perform set_config('app.marketplace_listing_transition_write', 'enabled', true);
  update public.marketplace_listing_versions
  set state = 'SUBMITTED', submitted_at = now()
  where id = version_record.id;

  update public.marketplace_listing_review_requests
  set status = 'RESOLVED', resolved_by = current_user_id, resolved_at = now()
  where listing_id = listing_record.id and status = 'OPEN'
    and visibility = 'PARTNER_VISIBLE';

  update public.marketplace_listings
  set status = 'SUBMITTED', lock_version = lock_version + 1,
      last_submitted_at = now()
  where id = listing_record.id
  returning * into listing_record;

  insert into public.marketplace_listing_status_history (
    listing_id, listing_version_id, from_status, to_status,
    actor_id, reason, lock_version
  ) values (
    listing_record.id, version_record.id, old_status, 'SUBMITTED',
    current_user_id, 'Partner submitted listing for human review',
    listing_record.lock_version
  );

  perform private.write_marketplace_audit(
    'marketplace.listing_submitted', 'marketplace_listing', listing_record.id,
    'Partner submitted listing for human review',
    jsonb_build_object('status', old_status),
    jsonb_build_object(
      'status', 'SUBMITTED',
      'version_number', version_record.version_number,
      'quantity', version_record.quantity
    )
  );

  return listing_record;
end;
$$;

create or replace function public.transition_marketplace_listing_status(
  requested_listing_id uuid,
  expected_lock_version integer,
  requested_status public.marketplace_listing_status,
  requested_reason text,
  requested_feedback jsonb default '[]'::jsonb,
  requested_internal_note text default null
)
returns public.marketplace_listings
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  listing_record public.marketplace_listings;
  version_record public.marketplace_listing_versions;
  new_version_id uuid;
  feedback jsonb;
  reason_value text := btrim(requested_reason);
  internal_value text := nullif(btrim(requested_internal_note), '');
  listing_ready boolean;
  action_name text;
begin
  if not public.can_manage_marketplace_listings() then
    raise exception 'Marketplace listing review denied' using errcode = '42501';
  end if;
  if char_length(reason_value) not between 3 and 1000
    or jsonb_typeof(requested_feedback) <> 'array'
    or (internal_value is not null and char_length(internal_value) not between 3 and 1000)
  then
    raise exception 'A valid review reason and feedback array are required'
      using errcode = '22023';
  end if;

  select * into listing_record from public.marketplace_listings
  where id = requested_listing_id for update;
  if not found or listing_record.lock_version <> expected_lock_version then
    raise exception 'Marketplace listing version conflict' using errcode = '40001';
  end if;
  if not (
    (listing_record.status = 'SUBMITTED' and requested_status = 'UNDER_REVIEW')
    or (listing_record.status = 'UNDER_REVIEW'
      and requested_status in ('CHANGES_REQUESTED', 'APPROVED', 'REJECTED'))
  ) then
    raise exception 'Invalid Marketplace listing status transition'
      using errcode = '23514';
  end if;

  select * into strict version_record from public.marketplace_listing_versions
  where id = listing_record.current_version_id and state = 'SUBMITTED'
  for update;

  if requested_status = 'APPROVED' then
    select readiness.ready into listing_ready
    from public.get_marketplace_listing_readiness(requested_listing_id) readiness;
    if not coalesce(listing_ready, false)
      or version_record.canonical_model_id is null
    then
      raise exception 'Approved listing requires readiness and canonical product'
        using errcode = '23514';
    end if;
  end if;

  if requested_status = 'CHANGES_REQUESTED'
    and jsonb_array_length(requested_feedback) = 0
  then
    raise exception 'Partner-visible change requests are required'
      using errcode = '23514';
  end if;

  for feedback in select value from jsonb_array_elements(requested_feedback)
  loop
    if jsonb_typeof(feedback) <> 'object'
      or (feedback ->> 'area') not in (
        'PHOTOS', 'SPECS', 'CONDITION', 'DESCRIPTION',
        'PRODUCT_IDENTITY', 'QUANTITY', 'OTHER'
      )
      or char_length(btrim(feedback ->> 'comment')) not between 3 and 1000
    then
      raise exception 'Invalid Marketplace listing review feedback'
        using errcode = '22023';
    end if;
  end loop;

  if requested_status = 'CHANGES_REQUESTED' then
    for feedback in select value from jsonb_array_elements(requested_feedback)
    loop
      insert into public.marketplace_listing_review_requests (
        listing_id, listing_version_id, area, visibility, comment, created_by
      ) values (
        listing_record.id, version_record.id,
        (feedback ->> 'area')::public.marketplace_listing_review_area,
        'PARTNER_VISIBLE', btrim(feedback ->> 'comment'), current_user_id
      );
    end loop;

    if internal_value is not null then
      insert into public.marketplace_listing_review_requests (
        listing_id, listing_version_id, area, visibility, comment, created_by
      ) values (
        listing_record.id, version_record.id, 'OTHER', 'INTERNAL',
        internal_value, current_user_id
      );
    end if;

    new_version_id := gen_random_uuid();
    insert into public.marketplace_listing_versions (
      id, listing_id, version_number, state, canonical_model_id, brand_id,
      category_id, proposed_brand, proposed_model, title, description,
      condition, condition_grade, condition_notes, declared_defects,
      defects_acknowledged, accessories_included, specifications,
      serial_number_private, quantity, ownership, custody, fulfillment,
      evaluation_source, evaluation_status, created_by
    ) select
      new_version_id, listing_id, version_number + 1, 'DRAFT',
      canonical_model_id, brand_id, category_id, proposed_brand,
      proposed_model, title, description, condition, condition_grade,
      condition_notes, declared_defects, defects_acknowledged,
      accessories_included, specifications, serial_number_private, quantity,
      ownership, custody, fulfillment, 'HUMAN', 'NOT_STARTED', current_user_id
    from public.marketplace_listing_versions where id = version_record.id;

    insert into public.marketplace_listing_version_images (
      version_id, image_id, image_type, requirement, sort_order,
      alt_text, is_sensitive
    ) select new_version_id, image_id, image_type, requirement, sort_order,
      alt_text, is_sensitive
    from public.marketplace_listing_version_images
    where version_id = version_record.id;
  end if;

  perform set_config('app.marketplace_listing_transition_write', 'enabled', true);
  if requested_status in ('APPROVED', 'REJECTED') then
    update public.marketplace_listing_versions
    set state = case requested_status
          when 'APPROVED' then 'APPROVED'::public.marketplace_listing_version_state
          else 'REJECTED'::public.marketplace_listing_version_state
        end,
        reviewed_at = now(),
        evaluation_source = 'HUMAN',
        evaluation_status = 'COMPLETED',
        evaluation_summary = reason_value
    where id = version_record.id;
  end if;

  update public.marketplace_listings
  set status = requested_status,
      lock_version = lock_version + 1,
      current_version_id = case when requested_status = 'CHANGES_REQUESTED'
        then new_version_id else current_version_id end,
      approved_version_id = case when requested_status = 'APPROVED'
        then version_record.id else approved_version_id end,
      approved_at = case when requested_status = 'APPROVED'
        then now() else approved_at end
  where id = listing_record.id
  returning * into listing_record;

  insert into public.marketplace_listing_status_history (
    listing_id, listing_version_id, from_status, to_status,
    actor_id, reason, lock_version
  ) values (
    listing_record.id, version_record.id,
    case requested_status
      when 'UNDER_REVIEW' then 'SUBMITTED'::public.marketplace_listing_status
      else 'UNDER_REVIEW'::public.marketplace_listing_status
    end,
    requested_status, current_user_id, reason_value, listing_record.lock_version
  );

  action_name := case requested_status
    when 'UNDER_REVIEW' then 'marketplace.listing_review_started'
    when 'CHANGES_REQUESTED' then 'marketplace.changes_requested'
    when 'APPROVED' then 'marketplace.listing_approved'
    when 'REJECTED' then 'marketplace.listing_rejected'
  end;
  perform private.write_marketplace_audit(
    action_name, 'marketplace_listing', listing_record.id, reason_value,
    jsonb_build_object('status', case requested_status
      when 'UNDER_REVIEW' then 'SUBMITTED' else 'UNDER_REVIEW' end),
    jsonb_build_object(
      'status', requested_status,
      'reviewed_version_number', version_record.version_number,
      'next_version_number', case when new_version_id is null then null
        else version_record.version_number + 1 end
    )
  );

  return listing_record;
end;
$$;

create or replace function public.archive_marketplace_listing(
  requested_listing_id uuid,
  expected_lock_version integer,
  requested_reason text
)
returns public.marketplace_listings
language plpgsql
security definer
set search_path = ''
as $$
declare
  listing_record public.marketplace_listings;
  old_status public.marketplace_listing_status;
  reason_value text := btrim(requested_reason);
begin
  if not private.marketplace_listing_owned_by_current_user(requested_listing_id)
    or char_length(reason_value) not between 3 and 500
  then
    raise exception 'Marketplace listing archive denied' using errcode = '42501';
  end if;
  select * into listing_record from public.marketplace_listings
  where id = requested_listing_id for update;
  if not found or listing_record.lock_version <> expected_lock_version
    or listing_record.status not in ('DRAFT', 'CHANGES_REQUESTED', 'REJECTED', 'APPROVED')
  then
    raise exception 'Marketplace listing cannot be archived'
      using errcode = '23514';
  end if;
  old_status := listing_record.status;
  update public.marketplace_listings
  set status = 'ARCHIVED', archived_at = now(), lock_version = lock_version + 1
  where id = listing_record.id returning * into listing_record;
  insert into public.marketplace_listing_status_history (
    listing_id, listing_version_id, from_status, to_status,
    actor_id, reason, lock_version
  ) values (
    listing_record.id, listing_record.current_version_id, old_status, 'ARCHIVED',
    (select auth.uid()), reason_value, listing_record.lock_version
  );
  perform private.write_marketplace_audit(
    'marketplace.listing_archived', 'marketplace_listing', listing_record.id,
    reason_value, jsonb_build_object('status', old_status),
    jsonb_build_object('status', 'ARCHIVED')
  );
  return listing_record;
end;
$$;

create or replace function public.register_marketplace_listing_image(
  requested_listing_id uuid,
  expected_lock_version integer,
  requested_image_id uuid,
  requested_storage_path text,
  requested_image_type text,
  requested_alt_text text,
  requested_mime_type text,
  requested_size_bytes bigint,
  requested_sha256 text,
  requested_width_pixels integer default null,
  requested_height_pixels integer default null
)
returns public.marketplace_listing_images
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  listing_record public.marketplace_listings;
  version_record public.marketplace_listing_versions;
  partner_record public.partner_profiles;
  image_record public.marketplace_listing_images;
  configured_requirement public.marketplace_listing_image_requirement := 'OPTIONAL';
  next_sort integer;
begin
  if current_user_id is null or not public.is_marketplace_enabled()
    or not private.marketplace_listing_partner_is_verified(requested_listing_id)
  then
    raise exception 'Verified Partner access denied' using errcode = '42501';
  end if;

  select marketplace_listings.*
  into listing_record
  from public.marketplace_listings
  inner join public.partner_profiles
    on partner_profiles.id = marketplace_listings.partner_id
  where marketplace_listings.id = requested_listing_id
  for update of marketplace_listings;

  if not found or listing_record.status not in ('DRAFT', 'CHANGES_REQUESTED')
    or listing_record.lock_version <> expected_lock_version
  then
    raise exception 'Marketplace listing version conflict or not editable'
      using errcode = '40001';
  end if;

  select * into strict partner_record
  from public.partner_profiles where id = listing_record.partner_id;
  select * into strict version_record
  from public.marketplace_listing_versions
  where id = listing_record.current_version_id and state = 'DRAFT';

  if requested_storage_path !~ (
      '^listings/' || partner_record.id::text || '/' || listing_record.id::text
      || '/' || version_record.id::text || '/' || requested_image_id::text
      || '\.(jpg|jpeg|png|webp)$'
    )
    or requested_image_type !~ '^[a-z][a-z0-9_]{1,63}$'
    or requested_mime_type not in ('image/jpeg', 'image/png', 'image/webp')
    or requested_size_bytes not between 1 and 10485760
    or requested_sha256 !~ '^[0-9a-f]{64}$'
    or char_length(btrim(requested_alt_text)) not between 3 and 240
  then
    raise exception 'Invalid Marketplace listing image metadata'
      using errcode = '22023';
  end if;

  select requirement into configured_requirement
  from public.marketplace_listing_photo_requirements
  where category_id = version_record.category_id
    and image_type = requested_image_type
    and (
      version_record.condition is null
      or condition is null
      or condition = version_record.condition
    )
  order by requirement, condition nulls last
  limit 1;
  configured_requirement := coalesce(configured_requirement, 'OPTIONAL');

  select coalesce(max(sort_order), -1) + 1 into next_sort
  from public.marketplace_listing_version_images
  where version_id = version_record.id;

  insert into public.marketplace_listing_images (
    id, listing_id, storage_path, mime_type, size_bytes,
    width_pixels, height_pixels, sha256, uploaded_by
  ) values (
    requested_image_id, listing_record.id, requested_storage_path,
    requested_mime_type, requested_size_bytes, requested_width_pixels,
    requested_height_pixels, requested_sha256, current_user_id
  ) returning * into image_record;

  insert into public.marketplace_listing_version_images (
    version_id, image_id, image_type, requirement, sort_order,
    alt_text, is_sensitive
  ) values (
    version_record.id, image_record.id, requested_image_type,
    configured_requirement, next_sort, btrim(requested_alt_text),
    requested_image_type = 'serial'
  );

  update public.marketplace_listings
  set lock_version = lock_version + 1
  where id = listing_record.id;

  perform private.write_marketplace_audit(
    'marketplace.listing_image_uploaded', 'marketplace_listing', listing_record.id,
    null, null, jsonb_build_object(
      'image_id', image_record.id,
      'image_type', requested_image_type,
      'version_number', version_record.version_number
    )
  );

  return image_record;
end;
$$;

create or replace function public.remove_marketplace_listing_image(
  requested_listing_id uuid,
  expected_lock_version integer,
  requested_image_id uuid
)
returns table (removed_storage_path text, delete_storage_object boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  listing_record public.marketplace_listings;
  version_record public.marketplace_listing_versions;
  image_record public.marketplace_listing_images;
  reference_count integer;
begin
  if not public.is_marketplace_enabled()
    or not private.marketplace_listing_partner_is_verified(requested_listing_id)
  then
    raise exception 'Verified Partner access denied' using errcode = '42501';
  end if;

  select * into listing_record from public.marketplace_listings
  where id = requested_listing_id for update;
  if not found or listing_record.status not in ('DRAFT', 'CHANGES_REQUESTED')
    or listing_record.lock_version <> expected_lock_version
  then
    raise exception 'Marketplace listing version conflict or not editable'
      using errcode = '40001';
  end if;

  select * into strict version_record from public.marketplace_listing_versions
  where id = listing_record.current_version_id and state = 'DRAFT';
  select image.* into image_record
  from public.marketplace_listing_images image
  inner join public.marketplace_listing_version_images version_image
    on version_image.image_id = image.id
  where image.id = requested_image_id
    and image.listing_id = listing_record.id
    and version_image.version_id = version_record.id;
  if not found then
    raise exception 'Marketplace listing image unavailable' using errcode = 'P0002';
  end if;

  delete from public.marketplace_listing_version_images
  where version_id = version_record.id and image_id = image_record.id;
  select count(*) into reference_count
  from public.marketplace_listing_version_images
  where image_id = image_record.id;
  if reference_count = 0 then
    delete from public.marketplace_listing_images where id = image_record.id;
  end if;

  update public.marketplace_listings
  set lock_version = lock_version + 1
  where id = listing_record.id;

  perform private.write_marketplace_audit(
    'marketplace.listing_image_removed', 'marketplace_listing', listing_record.id,
    null,
    jsonb_build_object('image_id', image_record.id, 'version_number', version_record.version_number),
    null
  );

  return query select image_record.storage_path, reference_count = 0;
end;
$$;

create or replace function public.reorder_marketplace_listing_images(
  requested_listing_id uuid,
  expected_lock_version integer,
  requested_image_ids uuid[]
)
returns public.marketplace_listings
language plpgsql
security definer
set search_path = ''
as $$
declare
  listing_record public.marketplace_listings;
  version_record public.marketplace_listing_versions;
  expected_count integer;
  requested_count integer;
begin
  if not public.is_marketplace_enabled()
    or not private.marketplace_listing_partner_is_verified(requested_listing_id)
  then
    raise exception 'Verified Partner access denied' using errcode = '42501';
  end if;
  select * into listing_record from public.marketplace_listings
  where id = requested_listing_id for update;
  if not found or listing_record.status not in ('DRAFT', 'CHANGES_REQUESTED')
    or listing_record.lock_version <> expected_lock_version
  then
    raise exception 'Marketplace listing version conflict or not editable'
      using errcode = '40001';
  end if;
  select * into strict version_record from public.marketplace_listing_versions
  where id = listing_record.current_version_id and state = 'DRAFT';

  select count(*) into expected_count
  from public.marketplace_listing_version_images
  where version_id = version_record.id;
  select count(distinct image_id) into requested_count
  from unnest(requested_image_ids) image_id;
  if expected_count <> requested_count or exists (
    select 1 from unnest(requested_image_ids) image_id
    where not exists (
      select 1 from public.marketplace_listing_version_images
      where version_id = version_record.id
        and marketplace_listing_version_images.image_id = image_id
    )
  ) then
    raise exception 'Image order must include each draft image exactly once'
      using errcode = '22023';
  end if;

  update public.marketplace_listing_version_images
  set sort_order = -100000 - sort_order
  where version_id = version_record.id;
  update public.marketplace_listing_version_images version_image
  set sort_order = requested.position - 1
  from unnest(requested_image_ids) with ordinality requested(image_id, position)
  where version_image.version_id = version_record.id
    and version_image.image_id = requested.image_id;

  update public.marketplace_listings set lock_version = lock_version + 1
  where id = listing_record.id returning * into listing_record;
  return listing_record;
end;
$$;

create or replace function public.create_marketplace_listing(
  requested_category_id uuid
)
returns public.marketplace_listings
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  partner_record public.partner_profiles;
  listing_record public.marketplace_listings;
  version_id uuid := gen_random_uuid();
  inventory_id uuid := gen_random_uuid();
begin
  if current_user_id is null or not public.is_marketplace_enabled() then
    raise exception 'Marketplace access denied' using errcode = '42501';
  end if;

  select * into partner_record
  from public.partner_profiles
  where user_id = current_user_id;

  if not found or partner_record.status <> 'VERIFIED' then
    raise exception 'Verified Partner required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.categories
    where id = requested_category_id and status = 'active'
  ) then
    raise exception 'Active category required' using errcode = '23503';
  end if;

  insert into public.marketplace_listings (partner_id)
  values (partner_record.id)
  returning * into listing_record;

  insert into public.marketplace_listing_versions (
    id, listing_id, version_number, category_id, created_by
  ) values (
    version_id, listing_record.id, 1, requested_category_id, current_user_id
  );

  update public.marketplace_listings
  set current_version_id = version_id
  where id = listing_record.id
  returning * into listing_record;

  insert into public.marketplace_listing_inventory (
    id, listing_id, quantity_on_hand
  ) values (inventory_id, listing_record.id, 1);

  insert into public.marketplace_listing_inventory_movements (
    inventory_id, listing_version_id, movement_type,
    quantity_on_hand_delta, quantity_reserved_delta,
    quantity_on_hand_after, quantity_reserved_after, actor_id, reason
  ) values (
    inventory_id, version_id, 'INITIAL', 1, 0, 1, 0,
    current_user_id, 'Marketplace listing draft initialized'
  );

  insert into public.marketplace_listing_status_history (
    listing_id, listing_version_id, from_status, to_status,
    actor_id, reason, lock_version
  ) values (
    listing_record.id, version_id, null, 'DRAFT', current_user_id,
    'Marketplace listing draft created', listing_record.lock_version
  );

  perform private.write_marketplace_audit(
    'marketplace.listing_created',
    'marketplace_listing',
    listing_record.id,
    'Verified Partner created a draft',
    null,
    jsonb_build_object(
      'partner_id', partner_record.id,
      'category_id', requested_category_id,
      'version_number', 1,
      'quantity', 1
    )
  );

  return listing_record;
end;
$$;

create or replace function public.save_marketplace_listing_draft(
  requested_listing_id uuid,
  expected_lock_version integer,
  requested_payload jsonb
)
returns public.marketplace_listings
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  listing_record public.marketplace_listings;
  version_record public.marketplace_listing_versions;
  inventory_record public.marketplace_listing_inventory;
  selected_model public.catalog_product_models;
  next_quantity integer;
  previous_quantity integer;
  selected_condition public.product_condition;
  selected_grade public.product_condition_grade;
begin
  if current_user_id is null or not public.is_marketplace_enabled()
    or not private.marketplace_listing_partner_is_verified(requested_listing_id)
  then
    raise exception 'Verified Partner access denied' using errcode = '42501';
  end if;

  if jsonb_typeof(requested_payload) <> 'object' then
    raise exception 'Listing payload must be an object' using errcode = '22023';
  end if;

  select * into listing_record
  from public.marketplace_listings
  where id = requested_listing_id
  for update;

  if not found or listing_record.status not in ('DRAFT', 'CHANGES_REQUESTED') then
    raise exception 'Marketplace listing is not editable' using errcode = '23514';
  end if;
  if listing_record.lock_version <> expected_lock_version then
    raise exception 'Marketplace listing version conflict' using errcode = '40001';
  end if;

  select * into strict version_record
  from public.marketplace_listing_versions
  where id = listing_record.current_version_id and state = 'DRAFT'
  for update;

  if requested_payload ? 'canonicalModelId'
    and nullif(requested_payload ->> 'canonicalModelId', '') is not null
  then
    select * into selected_model
    from public.catalog_product_models
    where id = (requested_payload ->> 'canonicalModelId')::uuid
      and status = 'active';
    if not found or selected_model.category_id <> version_record.category_id then
      raise exception 'Canonical model does not match listing category'
        using errcode = '23514';
    end if;
  end if;

  if requested_payload ? 'condition'
    and nullif(requested_payload ->> 'condition', '') is not null
  then
    selected_condition := (requested_payload ->> 'condition')::public.product_condition;
  else
    selected_condition := version_record.condition;
  end if;

  if requested_payload ? 'conditionGrade'
    and nullif(requested_payload ->> 'conditionGrade', '') is not null
  then
    selected_grade := (requested_payload ->> 'conditionGrade')::public.product_condition_grade;
  elsif requested_payload ? 'conditionGrade' or selected_condition = 'new' then
    selected_grade := null;
  else
    selected_grade := version_record.condition_grade;
  end if;

  next_quantity := case
    when requested_payload ? 'quantity'
      then (requested_payload ->> 'quantity')::integer
    else version_record.quantity
  end;
  if next_quantity <= 0 or next_quantity > 100000 then
    raise exception 'Listing quantity must be between 1 and 100000'
      using errcode = '22023';
  end if;

  if requested_payload ? 'specifications'
    and jsonb_typeof(requested_payload -> 'specifications') <> 'object'
  then
    raise exception 'Specifications must be an object' using errcode = '22023';
  end if;
  if requested_payload ? 'declaredDefects'
    and jsonb_typeof(requested_payload -> 'declaredDefects') <> 'array'
  then
    raise exception 'Declared defects must be an array' using errcode = '22023';
  end if;
  if requested_payload ? 'accessoriesIncluded'
    and jsonb_typeof(requested_payload -> 'accessoriesIncluded') <> 'array'
  then
    raise exception 'Accessories must be an array' using errcode = '22023';
  end if;

  previous_quantity := version_record.quantity;

  update public.marketplace_listing_versions
  set canonical_model_id = case
        when requested_payload ? 'canonicalModelId'
          then nullif(requested_payload ->> 'canonicalModelId', '')::uuid
        else canonical_model_id
      end,
      brand_id = case
        when requested_payload ? 'canonicalModelId'
          and nullif(requested_payload ->> 'canonicalModelId', '') is not null
          then selected_model.brand_id
        when requested_payload ? 'brandId'
          then nullif(requested_payload ->> 'brandId', '')::uuid
        else brand_id
      end,
      proposed_brand = case when requested_payload ? 'proposedBrand'
        then nullif(regexp_replace(btrim(requested_payload ->> 'proposedBrand'), '\s+', ' ', 'g'), '')
        else proposed_brand end,
      proposed_model = case when requested_payload ? 'proposedModel'
        then nullif(regexp_replace(btrim(requested_payload ->> 'proposedModel'), '\s+', ' ', 'g'), '')
        else proposed_model end,
      title = case when requested_payload ? 'title'
        then nullif(regexp_replace(btrim(requested_payload ->> 'title'), '\s+', ' ', 'g'), '')
        else title end,
      description = case when requested_payload ? 'description'
        then nullif(btrim(requested_payload ->> 'description'), '')
        else description end,
      condition = selected_condition,
      condition_grade = selected_grade,
      condition_notes = case when requested_payload ? 'conditionNotes'
        then nullif(btrim(requested_payload ->> 'conditionNotes'), '')
        else condition_notes end,
      declared_defects = case when requested_payload ? 'declaredDefects'
        then requested_payload -> 'declaredDefects' else declared_defects end,
      defects_acknowledged = case when requested_payload ? 'defectsAcknowledged'
        then coalesce((requested_payload ->> 'defectsAcknowledged')::boolean, false)
        else defects_acknowledged end,
      accessories_included = case when requested_payload ? 'accessoriesIncluded'
        then requested_payload -> 'accessoriesIncluded' else accessories_included end,
      specifications = case when requested_payload ? 'specifications'
        then requested_payload -> 'specifications' else specifications end,
      serial_number_private = case when requested_payload ? 'serialNumber'
        then nullif(btrim(requested_payload ->> 'serialNumber'), '')
        else serial_number_private end,
      quantity = next_quantity,
      custody = case when requested_payload ? 'custody'
        then (requested_payload ->> 'custody')::public.marketplace_listing_custody
        else custody end,
      fulfillment = case when requested_payload ? 'fulfillment'
        then (requested_payload ->> 'fulfillment')::public.marketplace_listing_fulfillment
        else fulfillment end
  where id = version_record.id
  returning * into version_record;

  if version_record.ownership <> 'PARTNER_OWNED' then
    raise exception 'Marketplace ownership must remain PARTNER_OWNED'
      using errcode = '23514';
  end if;

  select * into strict inventory_record
  from public.marketplace_listing_inventory
  where listing_id = requested_listing_id
  for update;

  if inventory_record.quantity_reserved > next_quantity then
    raise exception 'Quantity cannot be lower than reserved inventory'
      using errcode = '23514';
  end if;

  if previous_quantity <> next_quantity then
    update public.marketplace_listing_inventory
    set quantity_on_hand = next_quantity,
        custody = version_record.custody,
        fulfillment = version_record.fulfillment,
        version = version + 1
    where id = inventory_record.id
    returning * into inventory_record;

    insert into public.marketplace_listing_inventory_movements (
      inventory_id, listing_version_id, movement_type,
      quantity_on_hand_delta, quantity_reserved_delta,
      quantity_on_hand_after, quantity_reserved_after, actor_id, reason
    ) values (
      inventory_record.id, version_record.id, 'SET_QUANTITY',
      next_quantity - previous_quantity, 0,
      inventory_record.quantity_on_hand, inventory_record.quantity_reserved,
      current_user_id, 'Partner updated draft listing quantity'
    );

    perform private.write_marketplace_audit(
      'marketplace.quantity_changed', 'marketplace_listing', requested_listing_id,
      'Partner updated draft quantity',
      jsonb_build_object('quantity', previous_quantity),
      jsonb_build_object('quantity', next_quantity, 'version_number', version_record.version_number)
    );
  else
    update public.marketplace_listing_inventory
    set custody = version_record.custody,
        fulfillment = version_record.fulfillment
    where id = inventory_record.id;
  end if;

  update public.marketplace_listings
  set lock_version = lock_version + 1
  where id = requested_listing_id
  returning * into listing_record;

  perform private.write_marketplace_audit(
    'marketplace.listing_updated', 'marketplace_listing', requested_listing_id,
    'Partner saved listing draft',
    jsonb_build_object('lock_version', expected_lock_version),
    jsonb_build_object(
      'lock_version', listing_record.lock_version,
      'version_number', version_record.version_number,
      'changed_fields', (select jsonb_agg(key) from jsonb_object_keys(requested_payload) key
        where key <> 'serialNumber')
    )
  );

  return listing_record;
end;
$$;

create trigger marketplace_listing_versions_guard_change
before update or delete on public.marketplace_listing_versions
for each row execute function private.guard_marketplace_listing_version_change();

create or replace function private.marketplace_listing_specs_complete(
  requested_category_id uuid,
  requested_specs jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  profile public.category_spec_profiles;
begin
  if jsonb_typeof(requested_specs) <> 'object' then
    return false;
  end if;

  select * into profile
  from public.category_spec_profiles
  where category_id = requested_category_id;

  if not found then
    return true;
  end if;

  if profile.family = 'club' then
    if nullif(btrim(requested_specs ->> 'handedness'), '') is null then
      return false;
    end if;
    if profile.club_type in ('driver', 'fairway_wood', 'hybrid', 'iron', 'wedge')
      and nullif(btrim(requested_specs ->> 'shaftFlex'), '') is null
    then
      return false;
    end if;
    if profile.club_type in ('driver', 'fairway_wood', 'hybrid', 'wedge')
      and nullif(btrim(requested_specs ->> 'loftDegrees'), '') is null
    then
      return false;
    end if;
    if profile.club_type = 'putter'
      and nullif(btrim(requested_specs ->> 'lengthInches'), '') is null
    then
      return false;
    end if;
  elsif profile.family = 'set' then
    if jsonb_typeof(requested_specs -> 'components') <> 'array'
      or jsonb_array_length(requested_specs -> 'components') = 0
    then
      return false;
    end if;
  end if;

  return true;
end;
$$;

create or replace function private.marketplace_listing_required_photos_complete(
  requested_version_id uuid,
  requested_category_id uuid,
  requested_condition public.product_condition
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when requested_condition is null then false
    when exists (
      select 1
      from public.marketplace_listing_photo_requirements
      where category_id = requested_category_id
        and requirement = 'REQUIRED'
        and (condition is null or condition = requested_condition)
    ) then not exists (
      select 1
      from public.marketplace_listing_photo_requirements requirement
      where requirement.category_id = requested_category_id
        and requirement.requirement = 'REQUIRED'
        and (requirement.condition is null
          or requirement.condition = requested_condition)
        and not exists (
          select 1
          from public.marketplace_listing_version_images version_image
          where version_image.version_id = requested_version_id
            and version_image.image_type = requirement.image_type
        )
    )
    else exists (
      select 1 from public.marketplace_listing_version_images
      where version_id = requested_version_id
    )
  end;
$$;

create or replace function public.get_marketplace_listing_readiness(
  requested_listing_id uuid
)
returns table (
  product_identity_complete boolean,
  required_specs_complete boolean,
  condition_complete boolean,
  required_photos_complete boolean,
  quantity_valid boolean,
  defects_acknowledged boolean,
  ready boolean,
  missing_fields text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  listing_record public.marketplace_listings;
  version_record public.marketplace_listing_versions;
  identity_ready boolean;
  specs_ready boolean;
  condition_ready boolean;
  photos_ready boolean;
  quantity_ready boolean;
  defects_ready boolean;
begin
  select * into listing_record
  from public.marketplace_listings
  where id = requested_listing_id;

  if not found or (
    not private.marketplace_listing_owned_by_current_user(requested_listing_id)
    and not public.can_manage_marketplace_listings()
  ) then
    raise exception 'Marketplace listing unavailable' using errcode = '42501';
  end if;

  select * into strict version_record
  from public.marketplace_listing_versions
  where id = listing_record.current_version_id;

  identity_ready := version_record.canonical_model_id is not null or (
    nullif(btrim(version_record.proposed_model), '') is not null
    and (
      version_record.brand_id is not null
      or nullif(btrim(version_record.proposed_brand), '') is not null
    )
  );
  specs_ready := private.marketplace_listing_specs_complete(
    version_record.category_id, version_record.specifications
  );
  condition_ready := version_record.condition is not null
    and nullif(btrim(version_record.condition_notes), '') is not null
    and (version_record.condition <> 'used'
      or version_record.condition_grade is not null);
  photos_ready := private.marketplace_listing_required_photos_complete(
    version_record.id, version_record.category_id, version_record.condition
  );
  quantity_ready := version_record.quantity > 0;
  defects_ready := version_record.defects_acknowledged;

  return query select
    identity_ready,
    specs_ready,
    condition_ready,
    photos_ready,
    quantity_ready,
    defects_ready,
    identity_ready and specs_ready and condition_ready and photos_ready
      and quantity_ready and defects_ready
      and nullif(btrim(version_record.title), '') is not null
      and nullif(btrim(version_record.description), '') is not null,
    array_remove(array[
      case when not identity_ready then 'product_identity' end,
      case when not specs_ready then 'specifications' end,
      case when not condition_ready then 'condition' end,
      case when not photos_ready then 'photos' end,
      case when not quantity_ready then 'quantity' end,
      case when not defects_ready then 'defects_acknowledgement' end,
      case when nullif(btrim(version_record.title), '') is null then 'title' end,
      case when nullif(btrim(version_record.description), '') is null then 'description' end
    ], null)::text[];
end;
$$;

insert into public.marketplace_listing_photo_requirements (
  category_id, condition, image_type, requirement, label, sort_order
)
select category_spec_profiles.category_id, 'new', 'overview', 'REQUIRED',
  'Vista general', 10
from public.category_spec_profiles
where category_spec_profiles.club_type = 'driver'
on conflict do nothing;

insert into public.marketplace_listing_photo_requirements (
  category_id, condition, image_type, requirement, label, sort_order
)
select category_spec_profiles.category_id, 'used', requirement.image_type,
  requirement.requirement, requirement.label, requirement.sort_order
from public.category_spec_profiles
cross join (values
  ('face', 'REQUIRED'::public.marketplace_listing_image_requirement, 'Cara', 10),
  ('crown', 'REQUIRED'::public.marketplace_listing_image_requirement, 'Corona', 20),
  ('sole', 'REQUIRED'::public.marketplace_listing_image_requirement, 'Suela', 30),
  ('shaft', 'RECOMMENDED'::public.marketplace_listing_image_requirement, 'Shaft', 40),
  ('grip', 'RECOMMENDED'::public.marketplace_listing_image_requirement, 'Grip', 50),
  ('serial', 'OPTIONAL'::public.marketplace_listing_image_requirement, 'Serie o etiqueta', 60),
  ('headcover', 'OPTIONAL'::public.marketplace_listing_image_requirement, 'Headcover', 70)
) as requirement(image_type, requirement, label, sort_order)
where category_spec_profiles.club_type = 'driver'
on conflict do nothing;
