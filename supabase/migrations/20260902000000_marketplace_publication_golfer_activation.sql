-- Public Marketplace composition layer. Publication remains derived from the
-- approved PR1-PR9 state; no independent publication or economic snapshot is
-- introduced here.

create index if not exists marketplace_pricing_quotes_publication_idx
  on public.marketplace_pricing_quotes
  (listing_id, quote_version desc, expires_at)
  where status = 'APPROVED';

create index if not exists partner_risk_flags_publication_hold_idx
  on public.partner_risk_flags (partner_id, penalty_id)
  where status = 'OPEN';

create or replace function private.marketplace_public_text_is_safe(
  requested_value text
)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select coalesce(requested_value, '') !~* (
    '([[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,})'
    || '|(https?://|www\.)'
    || '|([+]?52[ .()-]*)?([0-9][ .()-]*){10,}'
  );
$$;

revoke all on function private.marketplace_public_text_is_safe(text)
from public, anon, authenticated, service_role;

create or replace function private.marketplace_publication_blockers(
  requested_listing_id uuid,
  include_marketplace_gate boolean default true
)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  listing_record public.marketplace_listings;
  version_record public.marketplace_listing_versions;
  partner_record public.partner_profiles;
  inventory_record public.marketplace_listing_inventory;
  quote_record public.marketplace_pricing_quotes;
  blockers text[] := array[]::text[];
  public_text text;
begin
  select * into listing_record
  from public.marketplace_listings
  where id = requested_listing_id;

  if not found then
    return array['LISTING_NOT_FOUND'];
  end if;

  if include_marketplace_gate and not public.is_marketplace_enabled() then
    blockers := array_append(blockers, 'MARKETPLACE_DISABLED');
  end if;

  select * into partner_record
  from public.partner_profiles
  where id = listing_record.partner_id;
  if not found or partner_record.status <> 'VERIFIED' then
    blockers := array_append(blockers, 'PARTNER_NOT_VERIFIED');
  end if;

  if listing_record.status <> 'APPROVED' or listing_record.archived_at is not null then
    blockers := array_append(blockers, 'LISTING_NOT_APPROVED');
  end if;
  if listing_record.approved_version_id is null then
    blockers := array_append(blockers, 'APPROVED_VERSION_MISSING');
  elsif listing_record.current_version_id is distinct from listing_record.approved_version_id then
    blockers := array_append(blockers, 'LISTING_VERSION_STALE');
  end if;

  select * into version_record
  from public.marketplace_listing_versions
  where id = listing_record.approved_version_id
    and listing_id = listing_record.id
    and state = 'APPROVED';
  if not found then
    blockers := array_append(blockers, 'APPROVED_VERSION_MISSING');
  else
    if not (
      private.marketplace_listing_specs_complete(
        version_record.category_id,
        version_record.specifications
      )
      and private.marketplace_listing_required_photos_complete(
        version_record.id,
        version_record.category_id,
        version_record.condition
      )
      and version_record.condition is not null
      and nullif(btrim(version_record.condition_notes), '') is not null
      and (version_record.condition <> 'used' or version_record.condition_grade is not null)
      and version_record.defects_acknowledged
      and nullif(btrim(version_record.title), '') is not null
      and nullif(btrim(version_record.description), '') is not null
    ) then
      blockers := array_append(blockers, 'LISTING_CONTENT_INCOMPLETE');
    end if;
    if not exists (
      select 1
      from public.marketplace_listing_version_images image_assignment
      where image_assignment.version_id = version_record.id
        and not image_assignment.is_sensitive
    ) then
      blockers := array_append(blockers, 'REQUIRED_IMAGES_MISSING');
    end if;

    public_text := concat_ws(
      ' ',
      version_record.title,
      version_record.description,
      version_record.condition_notes,
      version_record.proposed_brand,
      version_record.proposed_model,
      version_record.declared_defects::text,
      version_record.accessories_included::text,
      version_record.specifications::text
    );
    if not private.marketplace_public_text_is_safe(public_text) then
      blockers := array_append(blockers, 'UNSAFE_PUBLIC_CONTENT');
    end if;
  end if;

  select * into quote_record
  from public.marketplace_pricing_quotes
  where listing_id = listing_record.id
    and status = 'APPROVED'
  order by quote_version desc
  limit 1;
  if not found then
    blockers := array_append(blockers, 'PRICING_MISSING');
  else
    if quote_record.expires_at <= now() then
      blockers := array_append(blockers, 'PRICING_EXPIRED');
    end if;
    if quote_record.listing_version_id is distinct from listing_record.approved_version_id
      or quote_record.listing_version_id is distinct from listing_record.current_version_id
    then
      blockers := array_append(blockers, 'PRICING_VERSION_STALE');
    end if;
    if quote_record.viability in ('OVERPRICED', 'UNDERPRICED')
      or quote_record.meets_minimum_marketplace_revenue is false
    then
      blockers := array_append(blockers, 'PRICING_NOT_VIABLE');
    end if;
  end if;

  select * into inventory_record
  from public.marketplace_listing_inventory
  where listing_id = listing_record.id;
  if not found or inventory_record.quantity_available <= 0 then
    blockers := array_append(blockers, 'INVENTORY_ZERO');
  end if;

  if exists (
    select 1
    from public.partner_risk_flags risk_flag
    join public.partner_penalties penalty on penalty.id = risk_flag.penalty_id
    where risk_flag.partner_id = listing_record.partner_id
      and risk_flag.status = 'OPEN'
      and penalty.severity = 'CRITICAL'
  ) then
    blockers := array_append(blockers, 'PARTNER_CRITICAL_HOLD');
  end if;

  return array(select distinct blocker from unnest(blockers) blocker order by blocker);
end;
$$;

revoke all on function private.marketplace_publication_blockers(uuid, boolean)
from public, anon, authenticated, service_role;

create or replace function public.get_marketplace_publication_readiness(
  requested_listing_id uuid default null
)
returns table (
  listing_id uuid,
  publication_ready boolean,
  published boolean,
  blockers text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  manager boolean := public.can_manage_marketplace_listings();
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  return query
  select
    listing.id,
    cardinality(private.marketplace_publication_blockers(listing.id, false)) = 0,
    cardinality(private.marketplace_publication_blockers(listing.id, true)) = 0,
    private.marketplace_publication_blockers(listing.id, true)
  from public.marketplace_listings listing
  where (requested_listing_id is null or listing.id = requested_listing_id)
    and (
      manager
      or exists (
        select 1
        from public.partner_profiles partner
        where partner.id = listing.partner_id
          and partner.user_id = current_user_id
      )
    )
  order by listing.updated_at desc;
end;
$$;

revoke all on function public.get_marketplace_publication_readiness(uuid)
from public, anon;
grant execute on function public.get_marketplace_publication_readiness(uuid)
to authenticated;

create or replace function public.get_public_marketplace_catalog(
  requested_slug text default null
)
returns table (
  listing_id uuid,
  slug text,
  title text,
  description text,
  condition public.product_condition,
  condition_grade public.product_condition_grade,
  condition_notes text,
  declared_defects jsonb,
  accessories_included jsonb,
  specifications jsonb,
  brand_id uuid,
  brand_name text,
  model_name text,
  category_id uuid,
  category_name text,
  product_family public.golf_product_family,
  club_type public.golf_club_type,
  bag_type public.golf_bag_type,
  set_type public.golf_set_type,
  public_price public.money_minor_units,
  currency public.iso_currency_code,
  pricing_quote_id uuid,
  available_quantity integer,
  fulfillment public.marketplace_listing_fulfillment,
  images jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  requested_id uuid;
begin
  if requested_slug is not null then
    if requested_slug !~ '^marketplace-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      return;
    end if;
    requested_id := substr(requested_slug, 13)::uuid;
  end if;
  if not public.is_marketplace_enabled() then
    return;
  end if;

  return query
  select
    listing.id,
    'marketplace-' || listing.id::text,
    version.title,
    version.description,
    version.condition,
    version.condition_grade,
    version.condition_notes,
    version.declared_defects,
    version.accessories_included,
    version.specifications,
    brand.id,
    coalesce(brand.name, version.proposed_brand),
    coalesce(model.model_name, version.proposed_model),
    category.id,
    category.name,
    profile.family,
    profile.club_type,
    profile.bag_type,
    profile.set_type,
    quote.calculated_public_price,
    quote.currency,
    quote.id,
    inventory.quantity_available,
    version.fulfillment,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', assignment.image_id,
        'alt_text', assignment.alt_text,
        'sort_order', assignment.sort_order
      ) order by assignment.sort_order)
      from public.marketplace_listing_version_images assignment
      where assignment.version_id = version.id
        and not assignment.is_sensitive
    ), '[]'::jsonb)
  from public.marketplace_listings listing
  join public.marketplace_listing_versions version
    on version.id = listing.approved_version_id
  join public.marketplace_listing_inventory inventory
    on inventory.listing_id = listing.id
  join public.categories category on category.id = version.category_id
  left join public.category_spec_profiles profile
    on profile.category_id = category.id
  left join public.catalog_product_models model
    on model.id = version.canonical_model_id
  left join public.brands brand
    on brand.id = coalesce(model.brand_id, version.brand_id)
  join lateral (
    select approved_quote.*
    from public.marketplace_pricing_quotes approved_quote
    where approved_quote.listing_id = listing.id
      and approved_quote.status = 'APPROVED'
    order by approved_quote.quote_version desc
    limit 1
  ) quote on true
  where (requested_id is null or listing.id = requested_id)
    and cardinality(private.marketplace_publication_blockers(listing.id, true)) = 0
  order by listing.approved_at desc, listing.id
  limit case when requested_id is null then 200 else 1 end;
exception when others then
  raise log 'marketplace_public_catalog_failed sqlstate=%', sqlstate;
  raise;
end;
$$;

revoke all on function public.get_public_marketplace_catalog(text)
from public;
grant execute on function public.get_public_marketplace_catalog(text)
to anon, authenticated;

-- This resolver is deliberately service-role only. The browser receives a
-- same-origin image URL and never receives the private Storage path, Partner
-- identifier, signed token, or unapproved image metadata.
create or replace function public.get_public_marketplace_image_path(
  requested_listing_id uuid,
  requested_image_id uuid
)
returns table (storage_path text, mime_type text)
language sql
stable
security definer
set search_path = ''
as $$
  select image.storage_path, image.mime_type
  from public.marketplace_listings listing
  join public.marketplace_listing_version_images assignment
    on assignment.version_id = listing.approved_version_id
    and assignment.image_id = requested_image_id
    and not assignment.is_sensitive
  join public.marketplace_listing_images image
    on image.id = assignment.image_id
    and image.listing_id = listing.id
  where listing.id = requested_listing_id
    and cardinality(private.marketplace_publication_blockers(listing.id, true)) = 0
  limit 1;
$$;

revoke all on function public.get_public_marketplace_image_path(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.get_public_marketplace_image_path(uuid, uuid)
to service_role;

create or replace function public.get_customer_marketplace_cart_readiness()
returns table (
  cart_item_id uuid,
  listing_version_changed boolean,
  price_changed boolean,
  available boolean,
  blocker_codes text[],
  image_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  return query
  select
    item.id,
    listing.current_version_id is distinct from item.marketplace_listing_version_id
      or listing.approved_version_id is distinct from item.marketplace_listing_version_id,
    quote.id is null
      or quote.id is distinct from item.marketplace_pricing_quote_id
      or quote.calculated_public_price is distinct from item.price_seen,
    cardinality(private.marketplace_publication_blockers(listing.id, true)) = 0
      and inventory.quantity_available >= item.quantity,
    private.marketplace_publication_blockers(listing.id, true)
      || case when inventory.quantity_available < item.quantity
        then array['INVENTORY_ZERO']::text[] else array[]::text[] end,
    (
      select assignment.image_id
      from public.marketplace_listing_version_images assignment
      where assignment.version_id = listing.approved_version_id
        and not assignment.is_sensitive
      order by assignment.sort_order
      limit 1
    )
  from public.carts cart
  join public.cart_items item on item.cart_id = cart.id
    and item.item_source = 'MARKETPLACE_PARTNER'
  join public.marketplace_listings listing
    on listing.id = item.marketplace_listing_id
  left join public.marketplace_listing_inventory inventory
    on inventory.listing_id = listing.id
  left join lateral (
    select approved_quote.*
    from public.marketplace_pricing_quotes approved_quote
    where approved_quote.listing_id = listing.id
      and approved_quote.status = 'APPROVED'
    order by approved_quote.quote_version desc
    limit 1
  ) quote on true
  where cart.user_id = auth.uid() and cart.status = 'active';
end;
$$;

revoke all on function public.get_customer_marketplace_cart_readiness()
from public, anon;
grant execute on function public.get_customer_marketplace_cart_readiness()
to authenticated;

create or replace function public.refresh_marketplace_cart_item(
  requested_cart_item_id uuid,
  requested_quantity integer,
  expected_version integer,
  requested_accept_listing_update boolean,
  requested_idempotency_key uuid
)
returns table (cart_id uuid, version integer, replayed boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_cart public.carts;
  selected_item public.cart_items;
  selected_listing public.marketplace_listings;
  selected_quote public.marketplace_pricing_quotes;
  selected_inventory public.marketplace_listing_inventory;
  existing public.cart_idempotency_keys;
  payload_hash text;
  blockers text[];
begin
  if auth.uid() is null or requested_idempotency_key is null
    or requested_quantity not between 1 and 99 or expected_version < 1
  then
    raise exception 'Cart request is invalid' using errcode = '22023';
  end if;
  payload_hash := public.cart_payload_hash(jsonb_build_object(
    'operation', 'refresh_marketplace',
    'item_id', requested_cart_item_id,
    'quantity', requested_quantity,
    'expected_version', expected_version,
    'accept_listing_update', requested_accept_listing_update
  ));
  select * into existing from public.cart_idempotency_keys
  where idempotency_key = requested_idempotency_key;
  if found then
    if existing.actor_id <> auth.uid()
      or existing.operation <> 'update'
      or existing.payload_hash <> payload_hash
    then
      raise exception 'Idempotency key conflict' using errcode = '23505';
    end if;
    return query select cart.id, cart.version, true
      from public.carts cart where cart.id = existing.cart_id;
    return;
  end if;

  select * into selected_cart from public.carts
  where user_id = auth.uid() and status = 'active' for update;
  if not found or selected_cart.version <> expected_version then
    raise exception 'Cart changed' using errcode = '40001';
  end if;
  select * into selected_item from public.cart_items
  where id = requested_cart_item_id and public.cart_items.cart_id = selected_cart.id
    and item_source = 'MARKETPLACE_PARTNER' for update;
  if not found then raise exception 'Marketplace cart item not found' using errcode = 'P0002'; end if;
  select * into strict selected_listing from public.marketplace_listings
  where id = selected_item.marketplace_listing_id;
  blockers := private.marketplace_publication_blockers(selected_listing.id, true);
  if cardinality(blockers) > 0 then
    raise exception 'Marketplace item is unavailable' using errcode = '23514',
      hint = array_to_string(blockers, ',');
  end if;
  if selected_listing.approved_version_id is distinct from selected_item.marketplace_listing_version_id
    and not requested_accept_listing_update
  then
    raise exception 'Marketplace listing review required' using errcode = '40001',
      hint = 'LISTING_VERSION_STALE';
  end if;
  select * into strict selected_quote
  from public.marketplace_pricing_quotes
  where listing_id = selected_listing.id and status = 'APPROVED'
  order by quote_version desc limit 1;
  select * into strict selected_inventory
  from public.marketplace_listing_inventory
  where listing_id = selected_listing.id for update;
  if selected_inventory.quantity_available < requested_quantity then
    raise exception 'Marketplace item is unavailable' using errcode = '23514',
      hint = 'INVENTORY_ZERO';
  end if;

  perform set_config('peter_golf.cart_rpc_write', 'enabled', true);
  update public.cart_items set
    quantity = requested_quantity,
    price_seen = selected_quote.calculated_public_price,
    currency_seen = selected_quote.currency,
    marketplace_listing_version_id = selected_listing.approved_version_id,
    marketplace_pricing_quote_id = selected_quote.id
  where id = selected_item.id;
  update public.carts set version = public.carts.version + 1
  where id = selected_cart.id returning * into selected_cart;
  insert into public.cart_idempotency_keys(
    idempotency_key, actor_id, operation, cart_id, cart_item_id, payload_hash
  ) values (
    requested_idempotency_key, auth.uid(), 'update',
    selected_cart.id, selected_item.id, payload_hash
  );
  perform set_config('peter_golf.cart_rpc_write', 'disabled', true);
  return query select selected_cart.id, selected_cart.version, false;
exception when others then
  perform set_config('peter_golf.cart_rpc_write', 'disabled', true);
  raise;
end;
$$;

revoke all on function public.refresh_marketplace_cart_item(
  uuid, integer, integer, boolean, uuid
) from public, anon;
grant execute on function public.refresh_marketplace_cart_item(
  uuid, integer, integer, boolean, uuid
) to authenticated;

-- Defense in depth for stale add-to-cart calls. Existing PR6 checkout remains
-- the financial authority and is additionally guarded at snapshot creation.
create or replace function private.guard_marketplace_cart_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare blockers text[];
begin
  if new.item_source <> 'MARKETPLACE_PARTNER' then return new; end if;
  blockers := private.marketplace_publication_blockers(new.marketplace_listing_id, true);
  if cardinality(blockers) > 0 then
    raise exception 'Marketplace item is not publication-ready'
      using errcode = '23514', hint = array_to_string(blockers, ',');
  end if;
  if not exists (
    select 1 from public.marketplace_listings listing
    join public.marketplace_pricing_quotes quote
      on quote.id = new.marketplace_pricing_quote_id
      and quote.listing_id = listing.id
    where listing.id = new.marketplace_listing_id
      and listing.current_version_id = listing.approved_version_id
      and listing.approved_version_id = new.marketplace_listing_version_id
      and quote.listing_version_id = listing.approved_version_id
      and quote.status = 'APPROVED'
      and quote.expires_at > now()
  ) then
    raise exception 'Marketplace item snapshot is stale'
      using errcode = '40001', hint = 'LISTING_VERSION_STALE';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_marketplace_cart_publication()
from public, anon, authenticated, service_role;
create trigger cart_items_guard_marketplace_publication
before insert or update of marketplace_listing_id, marketplace_listing_version_id,
  marketplace_pricing_quote_id on public.cart_items
for each row execute function private.guard_marketplace_cart_publication();

create or replace function private.guard_marketplace_order_snapshot_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.marketplace_listings listing
    where listing.id = new.listing_id
      and listing.current_version_id = new.listing_version_id
      and listing.approved_version_id = new.listing_version_id
      and cardinality(private.marketplace_publication_blockers(listing.id, true)) = 0
  ) then
    raise exception 'Marketplace checkout snapshot is stale'
      using errcode = '40001', hint = 'LISTING_VERSION_STALE';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_marketplace_order_snapshot_publication()
from public, anon, authenticated, service_role;
create trigger marketplace_order_item_snapshots_guard_publication
before insert on public.marketplace_order_item_snapshots
for each row execute function private.guard_marketplace_order_snapshot_publication();

create or replace function public.get_marketplace_activation_readiness()
returns table (
  schema_version text,
  enabled boolean,
  ready boolean,
  eligible_listing_count bigint,
  blockers text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  readiness_blockers text[] := array[]::text[];
  eligible_count bigint;
begin
  if not public.can_manage_marketplace_configuration() then
    raise exception 'Marketplace configuration access denied' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.site_settings setting
    where setting.key = 'app.environment'
      and setting.value = '"staging"'::jsonb
  ) then readiness_blockers := array_append(readiness_blockers, 'ENVIRONMENT_NOT_STAGING'); end if;
  if not exists (
    select 1 from public.site_settings setting
    where setting.key = 'marketplace.enabled'
      and jsonb_typeof(setting.value -> 'enabled') = 'boolean'
  ) then readiness_blockers := array_append(readiness_blockers, 'MARKETPLACE_SETTING_INVALID'); end if;
  if not public.payments_test_mode_enabled() then
    readiness_blockers := array_append(readiness_blockers, 'PAYMENTS_NOT_TEST');
  end if;
  if not public.stripe_checkout_test_mode_enabled() then
    readiness_blockers := array_append(readiness_blockers, 'STRIPE_NOT_TEST');
  end if;
  if (select count(*) from public.marketplace_config_versions
      where status = 'PUBLISHED' and effective_to is null) <> 1 then
    readiness_blockers := array_append(readiness_blockers, 'CONFIG_CORRUPT');
  end if;
  if not exists (
    select 1 from public.marketplace_config_versions config
    join public.marketplace_financial_rules financial on financial.config_version_id = config.id
    join public.marketplace_operational_rules operational on operational.config_version_id = config.id
    join public.marketplace_pricing_rules pricing on pricing.config_version_id = config.id
    where config.status = 'PUBLISHED' and config.effective_to is null
  ) then readiness_blockers := array_append(readiness_blockers, 'RULES_MISSING'); end if;

  select count(*) into eligible_count
  from public.marketplace_listings listing
  where cardinality(private.marketplace_publication_blockers(listing.id, false)) = 0;
  return query select
    '20260902000000'::text,
    public.is_marketplace_enabled(),
    cardinality(readiness_blockers) = 0,
    eligible_count,
    readiness_blockers;
end;
$$;

revoke all on function public.get_marketplace_activation_readiness()
from public, anon;
grant execute on function public.get_marketplace_activation_readiness()
to authenticated;

create or replace function public.set_marketplace_enabled(
  requested_enabled boolean,
  expected_enabled boolean,
  requested_confirmation text,
  requested_reason text
)
returns table (enabled boolean, changed_at timestamptz, audit_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  setting_record public.site_settings;
  reason_value text := nullif(btrim(requested_reason), '');
  expected_confirmation text := case when requested_enabled
    then 'ENABLE_MARKETPLACE' else 'DISABLE_MARKETPLACE' end;
  readiness record;
  published_config_id uuid;
  created_audit_id uuid := gen_random_uuid();
  change_time timestamptz := clock_timestamp();
begin
  if not public.can_manage_marketplace_configuration() then
    raise exception 'Marketplace configuration access denied' using errcode = '42501';
  end if;
  if requested_confirmation is distinct from expected_confirmation
    or char_length(coalesce(reason_value, '')) not between 3 and 500
  then raise exception 'Explicit confirmation and reason are required' using errcode = '22023'; end if;

  select * into setting_record from public.site_settings
  where key = 'marketplace.enabled' for update;
  if not found or jsonb_typeof(setting_record.value -> 'enabled') <> 'boolean' then
    raise exception 'Marketplace setting is invalid' using errcode = '55000';
  end if;
  if (setting_record.value ->> 'enabled')::boolean is distinct from expected_enabled then
    raise exception 'Marketplace setting changed' using errcode = '40001';
  end if;
  if requested_enabled then
    select * into readiness from public.get_marketplace_activation_readiness();
    if readiness.ready is distinct from true then
      raise exception 'Marketplace readiness is blocked' using errcode = '23514',
        hint = array_to_string(readiness.blockers, ',');
    end if;
  end if;

  update public.site_settings set value = jsonb_build_object('enabled', requested_enabled),
    updated_at = change_time
  where key = 'marketplace.enabled';
  select id into strict published_config_id
  from public.marketplace_config_versions
  where status = 'PUBLISHED' and effective_to is null;
  insert into public.audit_logs(id, actor_id, action, entity_type, entity_id, metadata, created_at)
  values (
    created_audit_id,
    auth.uid(),
    case when requested_enabled then 'marketplace.enabled' else 'marketplace.disabled' end,
    'site_setting',
    published_config_id,
    jsonb_build_object(
      'reason', reason_value,
      'before', jsonb_build_object('enabled', expected_enabled),
      'after', jsonb_build_object('enabled', requested_enabled),
      'schema_version', '20260902000000'
    ),
    change_time
  );
  return query select requested_enabled, change_time, created_audit_id;
end;
$$;

revoke all on function public.set_marketplace_enabled(boolean, boolean, text, text)
from public, anon;
grant execute on function public.set_marketplace_enabled(boolean, boolean, text, text)
to authenticated;

comment on function public.get_public_marketplace_catalog(text) is
  'Sanitized derived catalog DTO. Never returns Partner identity, economics, risk, KYC, claims or payout data.';
comment on function public.set_marketplace_enabled(boolean, boolean, text, text) is
  'Admin-only audited public Marketplace activation. Disabling never mutates existing orders.';
