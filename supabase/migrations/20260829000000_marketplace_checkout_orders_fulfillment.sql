-- Marketplace checkout, immutable order economics, inventory reservations and
-- multi-source fulfillment foundation. Marketplace remains disabled by default.

create type public.order_item_source as enum (
  'FIRST_PARTY', 'MARKETPLACE_PARTNER'
);
create type public.order_fulfillment_source as enum (
  'BEST_ROUND', 'PARTNER'
);
create type public.marketplace_fulfillment_status as enum (
  'PENDING_CONFIRMATION', 'CONFIRMED', 'PREPARING', 'READY_FOR_CARRIER',
  'SHIPPED', 'DELIVERED', 'ACCEPTANCE_PENDING', 'COMPLETED', 'CANCELLED',
  'ON_HOLD'
);
create type public.inventory_reservation_status as enum (
  'ACTIVE', 'COMMITTED', 'RELEASED', 'EXPIRED',
  'MANUAL_RECONCILIATION_REQUIRED'
);
create type public.marketplace_order_exception_status as enum (
  'NONE', 'ON_HOLD', 'PARTIAL_EXCEPTION', 'MANUAL_RECONCILIATION_REQUIRED'
);

create or replace function private.marketplace_deterministic_uuid(input text)
returns uuid language sql immutable strict set search_path = '' as $$
  select (
    substr(md5(input),1,8)||'-'||substr(md5(input),9,4)||'-'||
    substr(md5(input),13,4)||'-'||substr(md5(input),17,4)||'-'||
    substr(md5(input),21,12)
  )::uuid
$$;
revoke all on function private.marketplace_deterministic_uuid(text)
from public, anon, authenticated, service_role;

alter table public.inventory_movements
  drop constraint inventory_movements_delta_nonzero,
  add constraint inventory_movements_delta_nonzero check (
    quantity_delta <> 0 or movement_type in ('reservation','release')
  );

alter table public.marketplace_operational_rules
  add column checkout_reservation_minutes integer,
  add column inventory_confirmation_hours integer,
  add column carrier_handoff_hours integer;

update public.marketplace_operational_rules set
  checkout_reservation_minutes = 30,
  inventory_confirmation_hours = 24,
  carrier_handoff_hours = 48;

alter table public.marketplace_operational_rules
  alter column checkout_reservation_minutes set not null,
  alter column inventory_confirmation_hours set not null,
  alter column carrier_handoff_hours set not null,
  add constraint marketplace_checkout_reservation_minutes_valid
    check (checkout_reservation_minutes between 5 and 1440),
  add constraint marketplace_inventory_confirmation_hours_valid
    check (inventory_confirmation_hours between 1 and 168),
  add constraint marketplace_carrier_handoff_hours_valid
    check (carrier_handoff_hours between 1 and 336);

create or replace function public.create_marketplace_config_draft(requested_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare source_config_id uuid; new_config_id uuid:=gen_random_uuid(); reason_value text:=btrim(requested_reason);
begin
  if not public.can_manage_marketplace_configuration() then raise exception 'Marketplace configuration access denied' using errcode='42501'; end if;
  if char_length(reason_value) not between 3 and 500 then raise exception 'A reason between 3 and 500 characters is required' using errcode='22023'; end if;
  select id into strict source_config_id from public.marketplace_config_versions where status='PUBLISHED' and effective_to is null for share;
  insert into public.marketplace_config_versions(id,created_by) values(new_config_id,(select auth.uid()));
  insert into public.marketplace_tier_rules select new_config_id,tier,minimum_average_active_listings,maximum_average_active_listings,minimum_score,commission_rate_bps from public.marketplace_tier_rules where config_version_id=source_config_id;
  insert into public.marketplace_financial_rules select new_config_id,partner_processing_share_bps,admin_fee_bps,admin_fixed_fee,commission_tax_bps,minimum_marketplace_revenue,currency from public.marketplace_financial_rules where config_version_id=source_config_id;
  insert into public.marketplace_operational_rules(config_version_id,tier_averaging_window_days,score_provisional_completed_orders,listing_expiry_days,acceptance_window_hours,payout_interval_days,checkout_reservation_minutes,inventory_confirmation_hours,carrier_handoff_hours)
    select new_config_id,tier_averaging_window_days,score_provisional_completed_orders,listing_expiry_days,acceptance_window_hours,payout_interval_days,checkout_reservation_minutes,inventory_confirmation_hours,carrier_handoff_hours from public.marketplace_operational_rules where config_version_id=source_config_id;
  insert into public.marketplace_score_weight_rules select new_config_id,metric_code,weight_bps from public.marketplace_score_weight_rules where config_version_id=source_config_id;
  insert into public.marketplace_score_rules select new_config_id,neutral_score_bps,prior_observations,prior_success_equivalent,established_completed_orders,public_rating_min_reviews,shipping_inventory_confirmation_weight_bps,shipping_carrier_handoff_weight_bps,documentation_weight_bps,tenure_weight_bps,promotion_stability_days,downgrade_grace_days,provisional_tier_cap,tier_eligible_listing_statuses from public.marketplace_score_rules where config_version_id=source_config_id;
  insert into public.marketplace_score_outcome_rules select new_config_id,component,outcome_code,score_bps,counts_completed_order from public.marketplace_score_outcome_rules where config_version_id=source_config_id;
  insert into public.marketplace_penalty_rules select new_config_id,event_code,severity,penalty_bps,decay_days,requires_suspension_review,bypasses_downgrade_grace from public.marketplace_penalty_rules where config_version_id=source_config_id;
  insert into public.marketplace_tenure_score_rules select new_config_id,minimum_days,maximum_days,score_bps from public.marketplace_tenure_score_rules where config_version_id=source_config_id;
  insert into public.marketplace_pricing_rules select new_config_id,payment_fee_config_code,market_tolerance_bps,quote_expiry_days,research_freshness_hours,required_confidence_for_approval from public.marketplace_pricing_rules where config_version_id=source_config_id;
  perform private.write_marketplace_audit('marketplace.configuration_draft_created','marketplace_config_version',new_config_id,reason_value,jsonb_build_object('source_config_id',source_config_id),jsonb_build_object('status','DRAFT'));
  return new_config_id;
end;
$$;

alter table public.cart_items
  alter column variant_id drop not null,
  add column item_source public.order_item_source not null default 'FIRST_PARTY',
  add column marketplace_listing_id uuid
    references public.marketplace_listings (id) on delete restrict,
  add column marketplace_listing_version_id uuid
    references public.marketplace_listing_versions (id) on delete restrict,
  add column marketplace_pricing_quote_id uuid
    references public.marketplace_pricing_quotes (id) on delete restrict,
  add constraint cart_items_source_consistent check (
    (item_source = 'FIRST_PARTY' and variant_id is not null
      and marketplace_listing_id is null
      and marketplace_listing_version_id is null
      and marketplace_pricing_quote_id is null)
    or
    (item_source = 'MARKETPLACE_PARTNER' and variant_id is null
      and marketplace_listing_id is not null
      and marketplace_listing_version_id is not null
      and marketplace_pricing_quote_id is not null)
  );

create unique index cart_items_marketplace_offer_unique_idx
  on public.cart_items (cart_id, marketplace_listing_id, marketplace_pricing_quote_id)
  where item_source = 'MARKETPLACE_PARTNER';

alter table public.orders
  add column marketplace_exception_status
    public.marketplace_order_exception_status not null default 'NONE';

alter table public.order_items
  alter column product_id drop not null,
  add column item_source public.order_item_source not null default 'FIRST_PARTY',
  add constraint order_items_source_product_consistent check (
    (item_source = 'FIRST_PARTY' and product_id is not null and variant_id is not null)
    or (item_source = 'MARKETPLACE_PARTNER' and product_id is null and variant_id is null)
  );

create table public.order_fulfillments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  source public.order_fulfillment_source not null,
  partner_id uuid references public.partner_profiles (id) on delete restrict,
  fulfillment_mode public.marketplace_listing_fulfillment,
  custody public.marketplace_listing_custody,
  status public.marketplace_fulfillment_status not null
    default 'PENDING_CONFIRMATION',
  version integer not null default 1 check (version > 0),
  activated_at timestamptz,
  inventory_confirmation_due_at timestamptz,
  carrier_handoff_due_at timestamptz,
  confirmed_at timestamptz,
  ready_for_carrier_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  acceptance_due_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  hold_reason text,
  cancellation_reason text,
  carrier text,
  tracking_number text,
  label_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_fulfillments_source_consistent check (
    (source = 'BEST_ROUND' and partner_id is null)
    or
    (source = 'PARTNER' and partner_id is not null
      and fulfillment_mode is not null and custody is not null)
  ),
  constraint order_fulfillments_reason_lengths check (
    (hold_reason is null or char_length(btrim(hold_reason)) between 3 and 500)
    and (cancellation_reason is null
      or char_length(btrim(cancellation_reason)) between 3 and 500)
  ),
  constraint order_fulfillments_tracking_lengths check (
    (carrier is null or char_length(btrim(carrier)) between 2 and 80)
    and (tracking_number is null
      or char_length(btrim(tracking_number)) between 3 and 120)
    and (label_status is null or label_status in ('NOT_REQUESTED','PENDING','READY','FAILED'))
  )
);

create unique index order_fulfillments_best_round_unique_idx
  on public.order_fulfillments (order_id)
  where source = 'BEST_ROUND';
create unique index order_fulfillments_partner_group_unique_idx
  on public.order_fulfillments (order_id, partner_id, fulfillment_mode)
  where source = 'PARTNER';
create index order_fulfillments_order_idx
  on public.order_fulfillments (order_id, created_at);
create index order_fulfillments_partner_status_idx
  on public.order_fulfillments (partner_id, status, created_at desc)
  where partner_id is not null;

alter table public.order_items
  add column fulfillment_id uuid
    references public.order_fulfillments (id) on delete restrict;

create table public.marketplace_order_item_snapshots (
  order_item_id uuid primary key
    references public.order_items (id) on delete restrict,
  fulfillment_id uuid not null
    references public.order_fulfillments (id) on delete restrict,
  listing_id uuid not null references public.marketplace_listings (id) on delete restrict,
  listing_version_id uuid not null
    references public.marketplace_listing_versions (id) on delete restrict,
  pricing_quote_id uuid not null
    references public.marketplace_pricing_quotes (id) on delete restrict,
  partner_id uuid not null references public.partner_profiles (id) on delete restrict,
  canonical_product_model_id uuid not null
    references public.catalog_product_models (id) on delete restrict,
  listing_title text not null,
  condition_snapshot public.product_condition not null,
  condition_grade_snapshot public.product_condition_grade,
  specifications_snapshot jsonb not null,
  declared_defects_snapshot jsonb not null,
  accessories_snapshot jsonb not null,
  quantity integer not null check (quantity > 0),
  public_unit_price public.money_minor_units not null,
  public_line_total public.money_minor_units not null,
  effective_partner_tier public.marketplace_partner_tier not null,
  tier_source public.marketplace_tier_source not null,
  effective_tier_override_id uuid
    references public.partner_score_tier_overrides (id) on delete restrict,
  score_snapshot_id uuid references public.partner_score_snapshots (id) on delete restrict,
  commission_rate_bps integer not null check (commission_rate_bps between 0 and 10000),
  commission_amount public.money_minor_units not null,
  commission_vat public.money_minor_units not null,
  processing_total public.money_minor_units not null,
  partner_processing_share public.money_minor_units not null,
  best_round_processing_share public.money_minor_units not null,
  payment_processing_bps integer not null check (payment_processing_bps between 0 and 10000),
  payment_processing_fixed_fee public.money_minor_units not null,
  partner_processing_share_bps integer not null check (partner_processing_share_bps between 0 and 10000),
  admin_fee_bps integer not null check (admin_fee_bps between 0 and 10000),
  admin_percentage_fee public.money_minor_units not null,
  admin_fixed_fee public.money_minor_units not null,
  other_configured_fees public.money_minor_units not null,
  estimated_partner_net public.money_minor_units not null,
  estimated_best_round_revenue public.money_minor_units not null,
  estimated_processing boolean not null default true,
  actual_processing public.money_minor_units,
  config_version_id uuid not null
    references public.marketplace_config_versions (id) on delete restrict,
  calculation_version text not null,
  currency public.iso_currency_code not null default 'MXN',
  created_at timestamptz not null default now(),
  constraint marketplace_order_snapshot_line_total check (
    public_line_total = public_unit_price * quantity
  ),
  constraint marketplace_order_snapshot_processing_conservation check (
    processing_total = partner_processing_share + best_round_processing_share
  ),
  constraint marketplace_order_snapshot_partner_net_nonnegative check (
    estimated_partner_net >= 0
  ),
  constraint marketplace_order_snapshot_json_objects check (
    jsonb_typeof(specifications_snapshot) = 'object'
    and jsonb_typeof(declared_defects_snapshot) in ('object','array')
    and jsonb_typeof(accessories_snapshot) in ('object','array')
  )
);

create index marketplace_order_snapshots_partner_idx
  on public.marketplace_order_item_snapshots (partner_id, created_at desc);
create index marketplace_order_snapshots_listing_idx
  on public.marketplace_order_item_snapshots (listing_id, listing_version_id);

create table public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  order_item_id uuid not null unique references public.order_items (id) on delete restrict,
  source public.order_item_source not null,
  inventory_id uuid references public.inventory (id) on delete restrict,
  marketplace_inventory_id uuid
    references public.marketplace_listing_inventory (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  status public.inventory_reservation_status not null default 'ACTIVE',
  idempotency_key text not null unique,
  reserved_at timestamptz not null default now(),
  expires_at timestamptz not null,
  committed_at timestamptz,
  released_at timestamptz,
  release_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_reservations_source_consistent check (
    (source = 'FIRST_PARTY' and inventory_id is not null
      and marketplace_inventory_id is null)
    or
    (source = 'MARKETPLACE_PARTNER' and inventory_id is null
      and marketplace_inventory_id is not null)
  ),
  constraint inventory_reservations_expiry_after_reservation
    check (expires_at > reserved_at),
  constraint inventory_reservations_state_timestamps check (
    (status = 'ACTIVE' and committed_at is null and released_at is null)
    or (status = 'COMMITTED' and committed_at is not null and released_at is null)
    or (status in ('RELEASED','EXPIRED') and committed_at is null and released_at is not null)
    or (status = 'MANUAL_RECONCILIATION_REQUIRED')
  ),
  constraint inventory_reservations_release_reason_length check (
    release_reason is null or char_length(btrim(release_reason)) between 3 and 500
  )
);

create index inventory_reservations_active_expiry_idx
  on public.inventory_reservations (expires_at, order_id)
  where status = 'ACTIVE';
create index inventory_reservations_order_idx
  on public.inventory_reservations (order_id, status);

create table public.marketplace_fulfillment_status_history (
  id uuid primary key default gen_random_uuid(),
  fulfillment_id uuid not null
    references public.order_fulfillments (id) on delete restrict,
  from_status public.marketplace_fulfillment_status,
  to_status public.marketplace_fulfillment_status not null,
  actor_id uuid references public.profiles (id) on delete set null,
  reason text,
  version integer not null check (version > 0),
  created_at timestamptz not null default now(),
  constraint marketplace_fulfillment_history_change check (
    from_status is null or from_status <> to_status
  ),
  constraint marketplace_fulfillment_history_reason check (
    reason is null or char_length(btrim(reason)) between 3 and 500
  )
);

create table public.marketplace_fulfillment_idempotency_keys (
  idempotency_key uuid primary key,
  fulfillment_id uuid not null
    references public.order_fulfillments (id) on delete restrict,
  actor_id uuid not null references public.profiles (id) on delete restrict,
  action text not null check (char_length(action) between 3 and 80),
  created_at timestamptz not null default now()
);

create index marketplace_fulfillment_history_idx
  on public.marketplace_fulfillment_status_history (fulfillment_id, created_at desc);

create trigger order_fulfillments_set_updated_at
before update on public.order_fulfillments
for each row execute function public.set_updated_at();
create trigger inventory_reservations_set_updated_at
before update on public.inventory_reservations
for each row execute function public.set_updated_at();
create trigger marketplace_order_snapshots_immutable
before update or delete on public.marketplace_order_item_snapshots
for each row execute function public.reject_immutable_row_change();
create trigger marketplace_fulfillment_history_immutable
before update or delete on public.marketplace_fulfillment_status_history
for each row execute function public.reject_immutable_row_change();
create trigger marketplace_fulfillment_idempotency_immutable
before update or delete on public.marketplace_fulfillment_idempotency_keys
for each row execute function public.reject_immutable_row_change();

create or replace function public.can_manage_marketplace_orders()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.can_manage_orders() and public.can_manage_marketplace_listings();
$$;
revoke all on function public.can_manage_marketplace_orders() from public, anon;
grant execute on function public.can_manage_marketplace_orders() to authenticated;

create or replace function private.partner_owns_fulfillment(requested_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.order_fulfillments f
    join public.partner_profiles p on p.id = f.partner_id
    where f.id = requested_id and f.activated_at is not null
      and p.user_id = (select auth.uid())
  );
$$;
revoke all on function private.partner_owns_fulfillment(uuid)
from public, anon, authenticated, service_role;
grant execute on function private.partner_owns_fulfillment(uuid) to authenticated;

create or replace function private.record_fulfillment_history()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.marketplace_fulfillment_status_history (
      fulfillment_id, from_status, to_status, actor_id, version
    ) values (new.id, null, new.status, (select auth.uid()), new.version);
  elsif new.status is distinct from old.status then
    insert into public.marketplace_fulfillment_status_history (
      fulfillment_id, from_status, to_status, actor_id, reason, version
    ) values (
      new.id, old.status, new.status, (select auth.uid()),
      coalesce(new.cancellation_reason, new.hold_reason), new.version
    );
  end if;
  return new;
end;
$$;
revoke all on function private.record_fulfillment_history()
from public, anon, authenticated, service_role;
create trigger order_fulfillments_record_history
after insert or update of status on public.order_fulfillments
for each row execute function private.record_fulfillment_history();

create or replace function private.guard_marketplace_order_write()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_setting('peter_golf.marketplace_order_write', true) <> 'enabled' then
    raise exception 'Marketplace order writes require an authorized RPC'
      using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;
revoke all on function private.guard_marketplace_order_write()
from public, anon, authenticated, service_role;
create trigger order_fulfillments_require_rpc
before insert or update or delete on public.order_fulfillments
for each row execute function private.guard_marketplace_order_write();
create trigger inventory_reservations_require_rpc
before insert or update or delete on public.inventory_reservations
for each row execute function private.guard_marketplace_order_write();

create or replace function private.release_order_reservations_internal(
  requested_order_id uuid,
  requested_status public.inventory_reservation_status,
  requested_reason text
) returns integer
language plpgsql security definer set search_path = '' as $$
declare r public.inventory_reservations%rowtype; released_count integer := 0;
  inv public.inventory%rowtype; minv public.marketplace_listing_inventory%rowtype;
begin
  if requested_status not in ('RELEASED','EXPIRED') then
    raise exception 'Reservation release status is invalid' using errcode = '22023';
  end if;
  if char_length(btrim(requested_reason)) not between 3 and 500 then
    raise exception 'Reservation release reason is invalid' using errcode = '22023';
  end if;
  perform set_config('peter_golf.marketplace_order_write', 'enabled', true);
  for r in select * from public.inventory_reservations
    where order_id = requested_order_id and status = 'ACTIVE'
    order by id for update
  loop
    if r.source = 'FIRST_PARTY' then
      select * into strict inv from public.inventory where id = r.inventory_id for update;
      perform set_config('peter_golf.inventory_rpc_write', 'enabled', true);
      update public.inventory set quantity_reserved = quantity_reserved - r.quantity
      where id = inv.id and quantity_reserved >= r.quantity;
      if not found then raise exception 'First-party reservation invariant failed' using errcode = '23514'; end if;
      insert into public.inventory_movements (
        inventory_id, movement_type, quantity_delta, quantity_on_hand_after,
        quantity_reserved_after, reason, reference_type, reference_id,
        actor_id, idempotency_key
      ) values (
        inv.id, 'release', 0, inv.quantity_on_hand,
        inv.quantity_reserved - r.quantity, requested_reason,
        'inventory_reservation', r.id, (select auth.uid()),
        private.marketplace_deterministic_uuid('release:' || r.id::text)
      ) on conflict (idempotency_key) where idempotency_key is not null do nothing;
      perform set_config('peter_golf.inventory_rpc_write', 'disabled', true);
    else
      select * into strict minv from public.marketplace_listing_inventory
      where id = r.marketplace_inventory_id for update;
      update public.marketplace_listing_inventory set
        quantity_reserved = quantity_reserved - r.quantity,
        version = version + 1
      where id = minv.id and quantity_reserved >= r.quantity;
      if not found then raise exception 'Marketplace reservation invariant failed' using errcode = '23514'; end if;
      insert into public.marketplace_listing_inventory_movements (
        inventory_id, movement_type, quantity_on_hand_delta,
        quantity_reserved_delta, quantity_on_hand_after,
        quantity_reserved_after, reason, actor_id
      ) values (
        minv.id, 'RELEASE', 0, -r.quantity, minv.quantity_on_hand,
        minv.quantity_reserved - r.quantity, requested_reason, (select auth.uid())
      );
    end if;
    update public.inventory_reservations set
      status = requested_status, released_at = now(), release_reason = requested_reason
    where id = r.id;
    released_count := released_count + 1;
  end loop;
  perform set_config('peter_golf.marketplace_order_write', 'disabled', true);
  return released_count;
exception when others then
  perform set_config('peter_golf.inventory_rpc_write', 'disabled', true);
  perform set_config('peter_golf.marketplace_order_write', 'disabled', true);
  raise;
end;
$$;
revoke all on function private.release_order_reservations_internal(
  uuid, public.inventory_reservation_status, text
) from public, anon, authenticated, service_role;

create or replace function private.commit_order_reservations_internal(
  requested_order_id uuid
) returns integer
language plpgsql security definer set search_path = '' as $$
declare r public.inventory_reservations%rowtype; committed_count integer := 0;
  inv public.inventory%rowtype; minv public.marketplace_listing_inventory%rowtype;
begin
  perform set_config('peter_golf.marketplace_order_write', 'enabled', true);
  if exists (
    select 1 from public.inventory_reservations
    where order_id = requested_order_id and status = 'ACTIVE' and expires_at <= now()
  ) then
    update public.inventory_reservations set status = 'MANUAL_RECONCILIATION_REQUIRED'
    where order_id = requested_order_id and status = 'ACTIVE';
    update public.orders set
      marketplace_exception_status = 'MANUAL_RECONCILIATION_REQUIRED',
      version = version + 1
    where id = requested_order_id;
    update public.order_fulfillments set status = 'ON_HOLD',
      hold_reason = 'Pago recibido después de vencer la reserva.',
      version = version + 1
    where order_id = requested_order_id and status <> 'CANCELLED';
    perform set_config('peter_golf.marketplace_order_write', 'disabled', true);
    return 0;
  end if;
  for r in select * from public.inventory_reservations
    where order_id = requested_order_id and status = 'ACTIVE'
    order by id for update
  loop
    if r.source = 'FIRST_PARTY' then
      select * into strict inv from public.inventory where id = r.inventory_id for update;
      if inv.quantity_on_hand < r.quantity or inv.quantity_reserved < r.quantity then
        raise exception 'First-party reservation invariant failed' using errcode = '23514';
      end if;
      perform set_config('peter_golf.inventory_rpc_write', 'enabled', true);
      update public.inventory set
        quantity_on_hand = quantity_on_hand - r.quantity,
        quantity_reserved = quantity_reserved - r.quantity
      where id = inv.id;
      insert into public.inventory_movements (
        inventory_id, movement_type, quantity_delta, quantity_on_hand_after,
        quantity_reserved_after, reason, reference_type, reference_id,
        actor_id, idempotency_key
      ) values (
        inv.id, 'sale', -r.quantity, inv.quantity_on_hand - r.quantity,
        inv.quantity_reserved - r.quantity, 'Pago confirmado para pedido',
        'inventory_reservation', r.id, null,
        private.marketplace_deterministic_uuid('commit:' || r.id::text)
      ) on conflict (idempotency_key) where idempotency_key is not null do nothing;
      perform set_config('peter_golf.inventory_rpc_write', 'disabled', true);
    else
      select * into strict minv from public.marketplace_listing_inventory
      where id = r.marketplace_inventory_id for update;
      if minv.quantity_on_hand < r.quantity or minv.quantity_reserved < r.quantity then
        raise exception 'Marketplace reservation invariant failed' using errcode = '23514';
      end if;
      update public.marketplace_listing_inventory set
        quantity_on_hand = quantity_on_hand - r.quantity,
        quantity_reserved = quantity_reserved - r.quantity,
        version = version + 1
      where id = minv.id;
      insert into public.marketplace_listing_inventory_movements (
        inventory_id, movement_type, quantity_on_hand_delta,
        quantity_reserved_delta, quantity_on_hand_after,
        quantity_reserved_after, reason, actor_id
      ) values (
        minv.id, 'SALE', -r.quantity, -r.quantity,
        minv.quantity_on_hand - r.quantity,
        minv.quantity_reserved - r.quantity,
        'Pago confirmado para pedido', null
      );
    end if;
    update public.inventory_reservations set
      status = 'COMMITTED', committed_at = now()
    where id = r.id;
    committed_count := committed_count + 1;
  end loop;
  update public.order_fulfillments f set
    activated_at=coalesce(f.activated_at,now()),
    inventory_confirmation_due_at=now()+make_interval(hours=>(select opr.inventory_confirmation_hours
        from public.marketplace_operational_rules opr
        join public.marketplace_config_versions c on c.id=opr.config_version_id
        where c.status='PUBLISHED' and c.effective_to is null)),
    carrier_handoff_due_at=now()+make_interval(hours=>(select opr.carrier_handoff_hours
        from public.marketplace_operational_rules opr
        join public.marketplace_config_versions c on c.id=opr.config_version_id
        where c.status='PUBLISHED' and c.effective_to is null))
  where f.order_id=requested_order_id and f.activated_at is null;
  perform set_config('peter_golf.marketplace_order_write', 'disabled', true);
  return committed_count;
exception when others then
  perform set_config('peter_golf.inventory_rpc_write', 'disabled', true);
  perform set_config('peter_golf.marketplace_order_write', 'disabled', true);
  raise;
end;
$$;
revoke all on function private.commit_order_reservations_internal(uuid)
from public, anon, authenticated, service_role;

create or replace function private.sync_marketplace_reservations_from_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status and new.status = 'paid'
    and exists (select 1 from public.inventory_reservations r where r.order_id = new.order_id)
  then
    perform private.commit_order_reservations_internal(new.order_id);
  elsif new.status is distinct from old.status and new.status in ('failed','rejected','refunded')
    and exists (select 1 from public.inventory_reservations r
      where r.order_id = new.order_id and r.status = 'ACTIVE')
  then
    perform private.release_order_reservations_internal(
      new.order_id, 'RELEASED', 'Pago rechazado o reembolsado antes de fulfillment.'
    );
  end if;
  return new;
end;
$$;
revoke all on function private.sync_marketplace_reservations_from_payment()
from public, anon, authenticated, service_role;
create trigger order_payments_sync_marketplace_reservations
after update of status on public.order_payments
for each row execute function private.sync_marketplace_reservations_from_payment();

create or replace function private.release_reservations_from_stripe_expiry()
returns trigger language plpgsql security definer set search_path = '' as $$
declare selected_order_id uuid;
begin
  if new.status is distinct from old.status and new.status in ('expired','abandoned') then
    select p.order_id into selected_order_id
    from public.order_payments p where p.id = new.payment_id;
    if selected_order_id is not null and exists (
      select 1 from public.inventory_reservations r
      where r.order_id = selected_order_id and r.status = 'ACTIVE'
    ) then
      perform private.release_order_reservations_internal(
        selected_order_id, 'EXPIRED', 'Stripe Checkout expiró antes del pago.'
      );
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.release_reservations_from_stripe_expiry()
from public, anon, authenticated, service_role;
create trigger stripe_checkout_release_marketplace_reservations
after update of status on public.stripe_checkout_sessions
for each row execute function private.release_reservations_from_stripe_expiry();

create or replace function private.guard_marketplace_stripe_preparation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare selected_order public.orders%rowtype;
begin
  select o.* into selected_order from public.orders o
  join public.order_payments p on p.order_id = o.id
  where p.id = new.payment_id;
  if exists (select 1 from public.inventory_reservations r where r.order_id = selected_order.id) then
    if selected_order.marketplace_exception_status <> 'NONE'
      or exists (select 1 from public.inventory_reservations r
        where r.order_id = selected_order.id
          and (r.status <> 'ACTIVE' or r.expires_at <= now()))
    then
      raise exception 'Marketplace order reservation is not payable'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_marketplace_stripe_preparation()
from public, anon, authenticated, service_role;
create trigger stripe_checkout_guard_marketplace_reservation
before insert on public.stripe_checkout_sessions
for each row execute function private.guard_marketplace_stripe_preparation();

-- Add a Marketplace offer to the existing cart. The browser supplies only
-- references and quantity; quote economics are always re-read server-side.
create or replace function public.add_marketplace_cart_item(
  requested_listing_id uuid,
  requested_pricing_quote_id uuid,
  requested_quantity integer,
  requested_idempotency_key uuid
) returns table (
  cart_id uuid, cart_item_id uuid, quantity integer, version integer,
  replayed boolean
)
language plpgsql security definer set search_path = '' as $$
declare selected_cart public.carts%rowtype; selected_item public.cart_items%rowtype;
  selected_listing public.marketplace_listings%rowtype;
  selected_quote public.marketplace_pricing_quotes%rowtype;
  selected_partner public.partner_profiles%rowtype;
  selected_inventory public.marketplace_listing_inventory%rowtype;
  existing public.cart_idempotency_keys%rowtype; payload_hash text; payload jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not public.is_marketplace_enabled() then
    raise exception 'Marketplace is disabled' using errcode='42501';
  end if;
  if requested_idempotency_key is null or requested_quantity not between 1 and 99 then
    raise exception 'Cart quantity is invalid' using errcode='22023';
  end if;
  select * into selected_listing from public.marketplace_listings
    where id=requested_listing_id and status='APPROVED';
  select * into selected_quote from public.marketplace_pricing_quotes
    where id=requested_pricing_quote_id and listing_id=requested_listing_id
      and status='APPROVED' and expires_at > now();
  if selected_listing.id is null or selected_quote.id is null
    or selected_listing.approved_version_id is distinct from selected_quote.listing_version_id
    or selected_quote.id is distinct from (select q.id
      from public.marketplace_pricing_quotes q
      where q.listing_id=selected_listing.id and q.status='APPROVED'
      order by q.quote_version desc limit 1)
  then raise exception 'Marketplace offer is stale' using errcode='40001'; end if;
  select * into selected_partner from public.partner_profiles
    where id=selected_listing.partner_id and status='VERIFIED';
  if not found or selected_partner.user_id=auth.uid() then
    raise exception 'Partner is not eligible' using errcode='23514'; end if;
  if exists (select 1 from public.partner_risk_flags rf
    join public.partner_penalties pp on pp.id=rf.penalty_id
    where rf.partner_id=selected_partner.id and rf.status='OPEN'
      and pp.severity='CRITICAL')
  then raise exception 'Partner requires review' using errcode='23514'; end if;
  select * into selected_inventory from public.marketplace_listing_inventory
    where listing_id=selected_listing.id for update;
  if not found or selected_inventory.quantity_on_hand-selected_inventory.quantity_reserved < requested_quantity
  then raise exception 'Product is unavailable' using errcode='23514'; end if;
  payload := jsonb_build_object('listing_id',requested_listing_id,
    'pricing_quote_id',requested_pricing_quote_id,'quantity',requested_quantity);
  payload_hash := public.cart_payload_hash(payload);
  select * into existing from public.cart_idempotency_keys
    where idempotency_key=requested_idempotency_key;
  if found then
    if existing.actor_id<>auth.uid() or existing.operation<>'add'
      or existing.payload_hash<>payload_hash or existing.cart_item_id is null
    then raise exception 'Idempotency key conflict' using errcode='23505'; end if;
    return query select ci.cart_id,ci.id,ci.quantity,c.version,true
      from public.cart_items ci join public.carts c on c.id=ci.cart_id
      where ci.id=existing.cart_item_id;
    return;
  end if;
  select * into selected_cart from public.carts
    where user_id=auth.uid() and status='active' for update;
  if not found then
    perform set_config('peter_golf.cart_rpc_write','enabled',true);
    begin
      insert into public.carts(user_id,status,currency)
      values(auth.uid(),'active','MXN') returning * into selected_cart;
    exception when unique_violation then
      select * into selected_cart from public.carts
      where user_id=auth.uid() and status='active' for update;
    end;
  end if;
  perform set_config('peter_golf.cart_rpc_write','enabled',true);
  insert into public.cart_items (
    cart_id,variant_id,quantity,price_seen,currency_seen,item_source,
    marketplace_listing_id,marketplace_listing_version_id,
    marketplace_pricing_quote_id
  ) values (
    selected_cart.id,null,requested_quantity,selected_quote.calculated_public_price,
    selected_quote.currency,'MARKETPLACE_PARTNER',selected_listing.id,
    selected_quote.listing_version_id,selected_quote.id
  ) returning * into selected_item;
  update public.carts set version=public.carts.version+1 where id=selected_cart.id
    returning * into selected_cart;
  insert into public.cart_idempotency_keys(
    idempotency_key,actor_id,operation,cart_id,cart_item_id,payload_hash
  ) values(requested_idempotency_key,auth.uid(),'add',selected_cart.id,
    selected_item.id,payload_hash);
  perform set_config('peter_golf.cart_rpc_write','disabled',true);
  return query select selected_cart.id,selected_item.id,selected_item.quantity,
    selected_cart.version,false;
exception when others then
  perform set_config('peter_golf.cart_rpc_write','disabled',true);
  raise;
end;
$$;

-- Preserve the established cart contract while resolving Marketplace values
-- exclusively from the approved quote and private inventory server-side.
create or replace function public.get_customer_cart()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare selected public.carts%rowtype; result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into selected from public.carts where user_id=auth.uid() and status='active';
  if not found then return jsonb_build_object('cart_id',null,'version',null,
    'currency','MXN','unit_count',0,'subtotal',0,'has_issues',false,
    'has_marketplace_items',false,'items','[]'::jsonb); end if;
  perform set_config('peter_golf.checkout_rpc_read','enabled',true);
  select jsonb_build_object(
    'cart_id',selected.id,'version',selected.version,'currency',selected.currency,
    'unit_count',coalesce(sum(ci.quantity),0),
    'subtotal',coalesce(sum(case when ci.item_source='FIRST_PARTY'
      then coalesce(v.price,p.price,ci.price_seen)*ci.quantity
      else coalesce(q.calculated_public_price,ci.price_seen)*ci.quantity end),0),
    'has_marketplace_items',coalesce(bool_or(ci.item_source='MARKETPLACE_PARTNER'),false),
    'has_issues',coalesce(bool_or(case when ci.item_source='FIRST_PARTY' then
      p.id is null or v.id is null or inv.id is null
      or inv.quantity_on_hand-inv.quantity_reserved<ci.quantity
      or ci.price_seen<>coalesce(v.price,p.price,ci.price_seen)
      or ci.currency_seen<>coalesce(p.currency,ci.currency_seen)
    else ml.id is null or ml.status<>'APPROVED' or q.id is null or q.status<>'APPROVED'
      or q.expires_at<=now() or ml.approved_version_id is distinct from q.listing_version_id
      or q.id is distinct from (select q2.id from public.marketplace_pricing_quotes q2
        where q2.listing_id=ml.id and q2.status='APPROVED'
        order by q2.quote_version desc limit 1)
      or mi.id is null or mi.quantity_on_hand-mi.quantity_reserved<ci.quantity
      or pp.status<>'VERIFIED' or ci.price_seen<>q.calculated_public_price end),false),
    'items',coalesce(jsonb_agg(jsonb_build_object(
      'id',ci.id,'item_source',ci.item_source,
      'product_id',p.id,'variant_id',v.id,
      'listing_id',ml.id,'listing_version_id',ci.marketplace_listing_version_id,
      'pricing_quote_id',ci.marketplace_pricing_quote_id,
      'slug',p.slug,
      'product_name',case when ci.item_source='FIRST_PARTY'
        then coalesce(p.name,'Producto no disponible')
        else coalesce(lv.title,'Artículo Partner no disponible') end,
      'variant_name',case when ci.item_source='FIRST_PARTY'
        then coalesce(v.name,'Variante no disponible') else 'Best Round Partner verificado' end,
      'sku',case when ci.item_source='FIRST_PARTY' then coalesce(v.sku,'')
        else 'PARTNER-'||upper(substr(replace(coalesce(ml.id::text,''),'-',''),1,12)) end,
      'quantity',ci.quantity,
      'unit_price',case when ci.item_source='FIRST_PARTY'
        then coalesce(v.price,p.price,ci.price_seen) else coalesce(q.calculated_public_price,ci.price_seen) end,
      'line_total',(case when ci.item_source='FIRST_PARTY'
        then coalesce(v.price,p.price,ci.price_seen) else coalesce(q.calculated_public_price,ci.price_seen) end)*ci.quantity,
      'price_changed',case when ci.item_source='FIRST_PARTY'
        then ci.price_seen<>coalesce(v.price,p.price,ci.price_seen)
          or ci.currency_seen<>coalesce(p.currency,ci.currency_seen)
        else q.id is not null and ci.price_seen<>q.calculated_public_price end,
      'availability',case when ci.item_source='FIRST_PARTY' then case
        when p.id is null or v.id is null or inv.id is null then 'unavailable'
        when inv.quantity_on_hand-inv.quantity_reserved<ci.quantity then 'insufficient'
        when inv.quantity_on_hand-inv.quantity_reserved<=3 then 'low' else 'available' end
      else case when ml.id is null or q.id is null or pp.status<>'VERIFIED' then 'unavailable'
        when mi.quantity_on_hand-mi.quantity_reserved<ci.quantity then 'insufficient'
        when mi.quantity_on_hand-mi.quantity_reserved<=3 then 'low' else 'available' end end,
      'image_path',case when ci.item_source='FIRST_PARTY' then image.storage_path else null end
    ) order by ci.created_at),'[]'::jsonb)
  ) into result
  from public.cart_items ci
  left join public.product_variants v on ci.item_source='FIRST_PARTY' and v.id=ci.variant_id
    and v.active and v.archived_at is null
  left join public.products p on p.id=v.product_id and p.status='active'
    and p.published and p.archived_at is null
  left join public.inventory inv on inv.variant_id=v.id
  left join lateral (select pi.storage_path from public.product_images pi
    where pi.product_id=p.id order by pi.is_primary desc,pi.sort_order limit 1) image on true
  left join public.marketplace_listings ml on ci.item_source='MARKETPLACE_PARTNER'
    and ml.id=ci.marketplace_listing_id
  left join public.marketplace_listing_versions lv on lv.id=ci.marketplace_listing_version_id
  left join public.marketplace_pricing_quotes q on q.id=ci.marketplace_pricing_quote_id
  left join public.marketplace_listing_inventory mi on mi.listing_id=ml.id
  left join public.partner_profiles pp on pp.id=ml.partner_id
  where ci.cart_id=selected.id;
  perform set_config('peter_golf.checkout_rpc_read','disabled',true);
  return result;
exception when others then
  perform set_config('peter_golf.checkout_rpc_read','disabled',true);
  raise;
end;
$$;

create or replace function public.change_customer_cart(
  requested_operation text, requested_cart_item_id uuid,
  requested_quantity integer, expected_version integer,
  requested_idempotency_key uuid
) returns table (cart_id uuid, version integer, replayed boolean)
language plpgsql security definer set search_path = '' as $$
declare selected_cart public.carts%rowtype; selected_item public.cart_items%rowtype;
  selected_price numeric(14,0); selected_currency character(3); available integer;
  payload_hash text; existing public.cart_idempotency_keys%rowtype;
begin
  if auth.uid() is null or requested_idempotency_key is null
    or requested_operation not in ('update','remove') or expected_version<1
    or (requested_operation='update' and requested_quantity not between 1 and 99)
  then raise exception 'Cart request is invalid' using errcode='22023'; end if;
  payload_hash:=public.cart_payload_hash(jsonb_build_object(
    'operation',requested_operation,'item_id',requested_cart_item_id,
    'quantity',case when requested_operation='update' then requested_quantity else null end,
    'expected_version',expected_version));
  select * into existing from public.cart_idempotency_keys
    where idempotency_key=requested_idempotency_key;
  if found then
    if existing.actor_id<>auth.uid() or existing.operation<>requested_operation
      or existing.payload_hash<>payload_hash
    then raise exception 'Idempotency key conflict' using errcode='23505'; end if;
    return query select c.id,c.version,true from public.carts c where c.id=existing.cart_id;
    return;
  end if;
  select * into selected_cart from public.carts
    where user_id=auth.uid() and status='active' for update;
  if not found then raise exception 'Cart not found' using errcode='P0002'; end if;
  if selected_cart.version<>expected_version then raise exception 'Cart changed' using errcode='40001'; end if;
  select * into selected_item from public.cart_items
    where id=requested_cart_item_id and public.cart_items.cart_id=selected_cart.id for update;
  if not found then raise exception 'Cart item not found' using errcode='P0002'; end if;
  perform set_config('peter_golf.cart_rpc_write','enabled',true);
  if requested_operation='remove' then
    delete from public.cart_items where id=selected_item.id;
  elsif selected_item.item_source='FIRST_PARTY' then
    select coalesce(v.price,p.price),p.currency into selected_price,selected_currency
    from public.product_variants v join public.products p on p.id=v.product_id
    where v.id=selected_item.variant_id and v.active and v.archived_at is null
      and p.status='active' and p.published and p.archived_at is null;
    select quantity_on_hand-quantity_reserved into available from public.inventory
      where variant_id=selected_item.variant_id for update;
    if selected_price is null or selected_currency<>selected_cart.currency
      or available<requested_quantity
    then raise exception 'Product is unavailable' using errcode='23514'; end if;
    update public.cart_items set quantity=requested_quantity,
      price_seen=selected_price,currency_seen=selected_currency where id=selected_item.id;
  else
    select q.calculated_public_price,q.currency,
      mi.quantity_on_hand-mi.quantity_reserved
    into selected_price,selected_currency,available
    from public.marketplace_listings l
    join public.marketplace_pricing_quotes q
      on q.id=selected_item.marketplace_pricing_quote_id and q.listing_id=l.id
    join public.partner_profiles p on p.id=l.partner_id
    join public.marketplace_listing_inventory mi on mi.listing_id=l.id
    where l.id=selected_item.marketplace_listing_id and l.status='APPROVED'
      and l.approved_version_id=selected_item.marketplace_listing_version_id
      and q.status='APPROVED' and q.listing_version_id=l.approved_version_id
      and q.expires_at>now() and p.status='VERIFIED' for update of mi;
    if not found or selected_currency<>selected_cart.currency or available<requested_quantity
    then raise exception 'Marketplace item is unavailable' using errcode='23514'; end if;
    update public.cart_items set quantity=requested_quantity,
      price_seen=selected_price,currency_seen=selected_currency where id=selected_item.id;
  end if;
  update public.carts set version=carts.version+1 where id=selected_cart.id
    returning * into selected_cart;
  insert into public.cart_idempotency_keys(
    idempotency_key,actor_id,operation,cart_id,cart_item_id,payload_hash
  ) values(requested_idempotency_key,auth.uid(),requested_operation,selected_cart.id,
    case when requested_operation='remove' then null else selected_item.id end,payload_hash);
  perform set_config('peter_golf.cart_rpc_write','disabled',true);
  return query select selected_cart.id,selected_cart.version,false;
exception when others then
  perform set_config('peter_golf.cart_rpc_write','disabled',true);
  raise;
end;
$$;

-- Transactional mixed checkout. Stripe is intentionally called after this RPC.
create or replace function public.create_marketplace_checkout_order(
  requested_cart_id uuid,
  expected_version integer,
  requested_shipping_method_id uuid,
  requested_saved_address_id uuid,
  requested_address jsonb,
  requested_save_address boolean,
  requested_idempotency_key uuid,
  requested_payment_method public.payment_method
) returns table (order_id uuid, order_number text, replayed boolean)
language plpgsql security definer set search_path = '' as $$
declare selected_cart public.carts%rowtype; selected_method public.shipping_methods%rowtype;
  selected_address public.addresses%rowtype; normalized_address jsonb;
  existing public.order_idempotency_keys%rowtype; payload_hash text;
  line public.cart_items%rowtype; inv public.inventory%rowtype;
  minv public.marketplace_listing_inventory%rowtype; product_line record;
  listing public.marketplace_listings%rowtype; lv public.marketplace_listing_versions%rowtype;
  quote public.marketplace_pricing_quotes%rowtype; partner public.partner_profiles%rowtype;
  calculated_subtotal numeric(14,0):=0; new_order_id uuid:=gen_random_uuid();
  new_order_number text; saved_address_id uuid; reservation_minutes integer;
  confirmation_hours integer; handoff_hours integer; new_fulfillment_id uuid;
  new_item_id uuid; selected_provider public.payment_provider;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not public.is_marketplace_enabled() then raise exception 'Marketplace is disabled' using errcode='42501'; end if;
  if requested_idempotency_key is null or expected_version<1
    or requested_payment_method not in ('bank_transfer','card')
  then raise exception 'Checkout request is invalid' using errcode='22023'; end if;
  if requested_payment_method='card' and not public.stripe_checkout_test_mode_enabled()
  then raise exception 'Stripe Checkout is disabled' using errcode='42501'; end if;
  selected_provider := case requested_payment_method when 'card' then 'stripe'::public.payment_provider else 'manual'::public.payment_provider end;
  if requested_saved_address_id is not null then
    select * into selected_address from public.addresses
    where id=requested_saved_address_id and user_id=auth.uid() and archived_at is null;
    if not found then raise exception 'Address is unavailable' using errcode='P0002'; end if;
    normalized_address:=jsonb_build_object('recipient_name',selected_address.recipient_name,
      'phone',selected_address.phone,'street',selected_address.line_1,
      'exterior_number',coalesce(selected_address.exterior_number,'S/N'),
      'interior_number',selected_address.line_2,'neighborhood',selected_address.neighborhood,
      'city',selected_address.city,'state',selected_address.state,
      'postal_code',selected_address.postal_code,'references',selected_address.delivery_references,
      'country_code','MX');
    requested_save_address:=false;
  else
    normalized_address:=public.normalize_checkout_address(requested_address);
  end if;
  payload_hash:=public.cart_payload_hash(jsonb_build_object(
    'cart_id',requested_cart_id,'expected_version',expected_version,
    'shipping_method_id',requested_shipping_method_id,'address',normalized_address,
    'save_address',requested_save_address,'payment_method',requested_payment_method));
  select * into existing from public.order_idempotency_keys
    where idempotency_key=requested_idempotency_key;
  if found then
    if existing.actor_id<>auth.uid() or existing.operation<>'checkout'
      or existing.payload_hash<>payload_hash or existing.order_id is null
    then raise exception 'Idempotency key conflict' using errcode='23505'; end if;
    return query select o.id,o.order_number,true from public.orders o
      where o.id=existing.order_id and o.user_id=auth.uid();
    return;
  end if;
  select * into selected_cart from public.carts
    where id=requested_cart_id and user_id=auth.uid() and status='active' for update;
  if not found then raise exception 'Cart is unavailable' using errcode='P0002'; end if;
  if selected_cart.version<>expected_version then raise exception 'Cart changed' using errcode='40001'; end if;
  if not exists(select 1 from public.cart_items where cart_id=selected_cart.id)
    or not exists(select 1 from public.cart_items where cart_id=selected_cart.id and item_source='MARKETPLACE_PARTNER')
  then raise exception 'Marketplace checkout requires Marketplace items' using errcode='23514'; end if;
  perform 1 from public.cart_items where cart_id=selected_cart.id order by id for update;
  select * into selected_method from public.shipping_methods
    where id=requested_shipping_method_id and code='envio_nacional_temporal'
      and active and currency=selected_cart.currency;
  if not found then raise exception 'Shipping method is unavailable' using errcode='22023'; end if;
  select r.checkout_reservation_minutes,r.inventory_confirmation_hours,
    r.carrier_handoff_hours into strict reservation_minutes,confirmation_hours,handoff_hours
  from public.marketplace_operational_rules r
  join public.marketplace_config_versions c on c.id=r.config_version_id
  where c.status='PUBLISHED' and c.effective_to is null;

  -- Deterministic lock order protects both inventory bounded contexts.
  for line in select * from public.cart_items where cart_id=selected_cart.id
    order by item_source,coalesce(variant_id,marketplace_listing_id),id
  loop
    if line.item_source='FIRST_PARTY' then
      select i.*,p.id product_id,p.name product_name,p.condition,p.condition_grade,
        p.currency product_currency,v.id selected_variant_id,v.sku,v.name variant_name,
        coalesce(v.price,p.price) current_price
      into product_line from public.inventory i
      join public.product_variants v on v.id=i.variant_id
      join public.products p on p.id=v.product_id
      where v.id=line.variant_id and p.status='active' and p.published
        and p.archived_at is null and v.active and v.archived_at is null for update of i;
      if not found or product_line.current_price<>line.price_seen
        or product_line.product_currency<>selected_cart.currency
        or product_line.quantity_on_hand-product_line.quantity_reserved<line.quantity
      then raise exception 'First-party cart item changed' using errcode='40001'; end if;
      calculated_subtotal:=calculated_subtotal+product_line.current_price*line.quantity;
    else
      select * into listing from public.marketplace_listings
        where id=line.marketplace_listing_id and status='APPROVED';
      select * into quote from public.marketplace_pricing_quotes
        where id=line.marketplace_pricing_quote_id and listing_id=listing.id
          and listing_version_id=line.marketplace_listing_version_id
          and status='APPROVED' and expires_at>now();
      if listing.id is null or quote.id is null
        or listing.approved_version_id is distinct from quote.listing_version_id
        or quote.id is distinct from (select q2.id
          from public.marketplace_pricing_quotes q2
          where q2.listing_id=listing.id and q2.status='APPROVED'
          order by q2.quote_version desc limit 1)
        or quote.calculated_public_price is distinct from line.price_seen
      then raise exception 'Marketplace cart item changed' using errcode='40001'; end if;
      select * into partner from public.partner_profiles
        where id=listing.partner_id and status='VERIFIED';
      if not found or partner.user_id=auth.uid() or exists(select 1 from public.partner_risk_flags rf
        join public.partner_penalties pp on pp.id=rf.penalty_id
        where rf.partner_id=listing.partner_id and rf.status='OPEN' and pp.severity='CRITICAL')
      then raise exception 'Partner is not eligible' using errcode='23514'; end if;
      select * into minv from public.marketplace_listing_inventory
        where listing_id=listing.id for update;
      if not found or minv.quantity_on_hand-minv.quantity_reserved<line.quantity
      then raise exception 'Marketplace inventory unavailable' using errcode='23514'; end if;
      calculated_subtotal:=calculated_subtotal+quote.calculated_public_price*line.quantity;
    end if;
  end loop;

  if requested_save_address then
    perform set_config('peter_golf.checkout_rpc_write','enabled',true);
    insert into public.addresses(user_id,label,recipient_name,phone,line_1,
      exterior_number,line_2,neighborhood,city,state,postal_code,country_code)
    values(auth.uid(),'Envío',normalized_address->>'recipient_name',normalized_address->>'phone',
      normalized_address->>'street',normalized_address->>'exterior_number',
      normalized_address->>'interior_number',normalized_address->>'neighborhood',
      normalized_address->>'city',normalized_address->>'state',
      normalized_address->>'postal_code','MX') returning id into saved_address_id;
    perform set_config('peter_golf.checkout_rpc_write','disabled',true);
  elsif requested_saved_address_id is not null then saved_address_id:=selected_address.id; end if;

  new_order_number:='PG-W-'||upper(substr(replace(new_order_id::text,'-',''),1,12));
  perform set_config('peter_golf.order_rpc_write','enabled',true);
  perform set_config('peter_golf.marketplace_order_write','enabled',true);
  insert into public.orders(id,order_number,user_id,shipping_address_id,
    shipping_method_id,status,currency,subtotal,discount_total,shipping_total,
    tax_total,total,shipping_address_snapshot,customer_name,customer_email,
    customer_phone,payment_status,payment_method,origin,created_by,updated_by)
  values(new_order_id,new_order_number,auth.uid(),saved_address_id,selected_method.id,
    'pending_confirmation','MXN',calculated_subtotal,0,selected_method.base_price,0,
    calculated_subtotal+selected_method.base_price,normalized_address,
    normalized_address->>'recipient_name',nullif(auth.jwt()->>'email',''),
    normalized_address->>'phone','transfer_pending','bank_transfer','web',null,null);

  for line in select * from public.cart_items where cart_id=selected_cart.id
    order by item_source,coalesce(variant_id,marketplace_listing_id),id
  loop
    if line.item_source='FIRST_PARTY' then
      select i.* into inv from public.inventory i
      where i.variant_id=line.variant_id for update;
      select f.id into new_fulfillment_id from public.order_fulfillments f
        where f.order_id=new_order_id and f.source='BEST_ROUND';
      if new_fulfillment_id is null then
        insert into public.order_fulfillments(order_id,source,status)
        values(new_order_id,'BEST_ROUND','CONFIRMED') returning id into new_fulfillment_id;
      end if;
      insert into public.order_items(order_id,product_id,variant_id,sku_snapshot,
        product_name_snapshot,variant_name_snapshot,condition_snapshot,
        condition_grade_snapshot,unit_price_snapshot,currency,quantity,line_total,
        item_source,fulfillment_id)
      select new_order_id,p.id,v.id,v.sku,p.name,v.name,p.condition,p.condition_grade,
        coalesce(v.price,p.price),p.currency,line.quantity,
        coalesce(v.price,p.price)*line.quantity,'FIRST_PARTY',new_fulfillment_id
      from public.product_variants v join public.products p on p.id=v.product_id
      where v.id=line.variant_id returning id into new_item_id;
      perform set_config('peter_golf.inventory_rpc_write','enabled',true);
      update public.inventory set quantity_reserved=quantity_reserved+line.quantity
      where id=inv.id;
      insert into public.inventory_movements(inventory_id,movement_type,quantity_delta,
        quantity_on_hand_after,quantity_reserved_after,reason,reference_type,
        reference_id,actor_id,idempotency_key)
      values(inv.id,'reservation',0,inv.quantity_on_hand,
        inv.quantity_reserved+line.quantity,'Reserva checkout Marketplace',
        'order_item',new_item_id,auth.uid(),
        private.marketplace_deterministic_uuid('reserve:'||new_item_id::text));
      perform set_config('peter_golf.inventory_rpc_write','disabled',true);
      insert into public.inventory_reservations(order_id,order_item_id,source,
        inventory_id,quantity,idempotency_key,expires_at)
      values(new_order_id,new_item_id,'FIRST_PARTY',inv.id,line.quantity,
        'checkout:'||new_order_id::text||':'||new_item_id::text,
        now()+make_interval(mins=>reservation_minutes));
    else
      select * into listing from public.marketplace_listings where id=line.marketplace_listing_id;
      select * into quote from public.marketplace_pricing_quotes where id=line.marketplace_pricing_quote_id;
      select * into lv from public.marketplace_listing_versions where id=quote.listing_version_id;
      select * into minv from public.marketplace_listing_inventory where listing_id=listing.id for update;
      select f.id into new_fulfillment_id from public.order_fulfillments f
        where f.order_id=new_order_id and f.source='PARTNER'
          and f.partner_id=listing.partner_id and f.fulfillment_mode=lv.fulfillment;
      if new_fulfillment_id is null then
        insert into public.order_fulfillments(order_id,source,partner_id,
          fulfillment_mode,custody,status,inventory_confirmation_due_at,
          carrier_handoff_due_at)
        values(new_order_id,'PARTNER',listing.partner_id,lv.fulfillment,lv.custody,
          'PENDING_CONFIRMATION',now()+make_interval(hours=>confirmation_hours),
          now()+make_interval(hours=>handoff_hours)) returning id into new_fulfillment_id;
      end if;
      insert into public.order_items(order_id,product_id,variant_id,sku_snapshot,
        product_name_snapshot,variant_name_snapshot,condition_snapshot,
        condition_grade_snapshot,unit_price_snapshot,currency,quantity,line_total,
        item_source,fulfillment_id)
      values(new_order_id,null,null,'PARTNER-'||upper(substr(replace(listing.id::text,'-',''),1,12)),
        coalesce(lv.title,'Equipo Best Round Partner'),null,lv.condition,
        lv.condition_grade,quote.calculated_public_price,quote.currency,line.quantity,
        quote.calculated_public_price*line.quantity,'MARKETPLACE_PARTNER',new_fulfillment_id)
      returning id into new_item_id;
      insert into public.marketplace_order_item_snapshots(
        order_item_id,fulfillment_id,listing_id,listing_version_id,pricing_quote_id,
        partner_id,canonical_product_model_id,listing_title,condition_snapshot,
        condition_grade_snapshot,specifications_snapshot,declared_defects_snapshot,
        accessories_snapshot,quantity,public_unit_price,public_line_total,
        effective_partner_tier,tier_source,effective_tier_override_id,
        score_snapshot_id,commission_rate_bps,commission_amount,commission_vat,
        processing_total,partner_processing_share,best_round_processing_share,
        payment_processing_bps,payment_processing_fixed_fee,
        partner_processing_share_bps,admin_fee_bps,admin_percentage_fee,
        admin_fixed_fee,other_configured_fees,estimated_partner_net,
        estimated_best_round_revenue,config_version_id,calculation_version,currency
      ) values(
        new_item_id,new_fulfillment_id,listing.id,quote.listing_version_id,quote.id,
        listing.partner_id,quote.canonical_product_model_id,coalesce(lv.title,'Equipo Best Round Partner'),
        lv.condition,lv.condition_grade,lv.specifications,lv.declared_defects,
        lv.accessories_included,line.quantity,quote.calculated_public_price,
        quote.calculated_public_price*line.quantity,quote.effective_partner_tier,
        quote.tier_source,quote.effective_tier_override_id,quote.score_snapshot_id,
        quote.commission_rate_bps,quote.commission_amount*line.quantity,
        quote.commission_vat*line.quantity,quote.processing_total*line.quantity,
        quote.partner_processing_share*line.quantity,
        quote.best_round_processing_share*line.quantity,
        quote.payment_processing_bps,quote.payment_processing_fixed_fee,
        quote.partner_processing_share_bps,quote.admin_fee_bps,
        quote.admin_percentage_fee*line.quantity,quote.admin_fixed_fee*line.quantity,
        quote.other_configured_fees*line.quantity,
        quote.estimated_partner_net*line.quantity,
        quote.estimated_best_round_revenue*line.quantity,quote.config_version_id,
        quote.calculation_version,quote.currency);
      update public.marketplace_listing_inventory set
        quantity_reserved=quantity_reserved+line.quantity,version=version+1
      where id=minv.id;
      insert into public.marketplace_listing_inventory_movements(
        inventory_id,listing_version_id,movement_type,quantity_on_hand_delta,
        quantity_reserved_delta,quantity_on_hand_after,quantity_reserved_after,
        reason,actor_id)
      values(minv.id,quote.listing_version_id,'RESERVE',0,line.quantity,
        minv.quantity_on_hand,minv.quantity_reserved+line.quantity,
        'Reserva checkout Marketplace',auth.uid());
      insert into public.inventory_reservations(order_id,order_item_id,source,
        marketplace_inventory_id,quantity,idempotency_key,expires_at)
      values(new_order_id,new_item_id,'MARKETPLACE_PARTNER',minv.id,line.quantity,
        'checkout:'||new_order_id::text||':'||new_item_id::text,
        now()+make_interval(mins=>reservation_minutes));
    end if;
  end loop;
  insert into public.order_idempotency_keys(idempotency_key,actor_id,operation,
    order_id,payload_hash) values(requested_idempotency_key,auth.uid(),'checkout',
    new_order_id,payload_hash);
  insert into public.order_payments(order_id,method,status,expected_amount,
    currency,provider) values(new_order_id,requested_payment_method,'pending',
    calculated_subtotal+selected_method.base_price,'MXN',selected_provider);
  perform set_config('peter_golf.cart_rpc_write','enabled',true);
  update public.carts set status='converted',version=version+1 where id=selected_cart.id;
  perform set_config('peter_golf.cart_rpc_write','disabled',true);
  perform set_config('peter_golf.marketplace_order_write','disabled',true);
  perform set_config('peter_golf.order_rpc_write','disabled',true);
  perform private.write_marketplace_audit('marketplace.checkout_created','order',
    new_order_id,null,null,jsonb_build_object('order_number',new_order_number));
  return query select new_order_id,new_order_number,false;
exception when others then
  perform set_config('peter_golf.inventory_rpc_write','disabled',true);
  perform set_config('peter_golf.cart_rpc_write','disabled',true);
  perform set_config('peter_golf.marketplace_order_write','disabled',true);
  perform set_config('peter_golf.order_rpc_write','disabled',true);
  raise;
end;
$$;

create or replace function public.transition_partner_fulfillment(
  requested_fulfillment_id uuid,
  expected_version integer,
  requested_action text,
  requested_reason text,
  requested_idempotency_key uuid
) returns public.order_fulfillments
language plpgsql security definer set search_path = '' as $$
declare selected public.order_fulfillments%rowtype; result public.order_fulfillments;
  selected_partner public.partner_profiles%rowtype; outcome text;
  selected_component public.partner_score_component;
  score_value integer; config_id uuid;
begin
  if auth.uid() is null or requested_idempotency_key is null then
    raise exception 'Authentication required' using errcode='42501'; end if;
  if exists(select 1 from public.marketplace_fulfillment_idempotency_keys k
    where k.idempotency_key=requested_idempotency_key
      and k.fulfillment_id=requested_fulfillment_id and k.actor_id=auth.uid()
      and k.action=requested_action)
  then
    select * into result from public.order_fulfillments where id=requested_fulfillment_id;
    return result;
  elsif exists(select 1 from public.marketplace_fulfillment_idempotency_keys k
    where k.idempotency_key=requested_idempotency_key) then
    raise exception 'Idempotency key conflict' using errcode='23505';
  end if;
  select f.* into selected from public.order_fulfillments f
  join public.partner_profiles p on p.id=f.partner_id
  where f.id=requested_fulfillment_id and p.user_id=auth.uid()
    and f.activated_at is not null for update of f;
  if not found then raise exception 'Fulfillment not found' using errcode='P0002'; end if;
  select * into selected_partner from public.partner_profiles where id=selected.partner_id;
  if selected_partner.status<>'VERIFIED' then raise exception 'Partner is not eligible' using errcode='42501'; end if;
  if selected.version<>expected_version then raise exception 'Fulfillment changed' using errcode='40001'; end if;
  perform set_config('peter_golf.marketplace_order_write','enabled',true);
  if requested_action='CONFIRM_AVAILABILITY' and selected.status='PENDING_CONFIRMATION' then
    update public.order_fulfillments set status='CONFIRMED',confirmed_at=now(),
      version=version+1 where id=selected.id returning * into result;
    selected_component:='SHIPPING_SLA';
    outcome:=case when now()<=selected.inventory_confirmation_due_at
      then 'INVENTORY_CONFIRMED_ON_TIME' else 'INVENTORY_CONFIRMATION_LATE' end;
  elsif requested_action='UNAVAILABLE' and selected.status in ('PENDING_CONFIRMATION','CONFIRMED') then
    if char_length(btrim(requested_reason)) not between 3 and 500 then
      raise exception 'Cancellation reason required' using errcode='22023'; end if;
    update public.order_fulfillments set status='CANCELLED',cancelled_at=now(),
      cancellation_reason=btrim(requested_reason),version=version+1
    where id=selected.id returning * into result;
    perform private.release_order_reservations_internal(selected.order_id,'RELEASED',
      'Partner reportó inventario no disponible.');
    update public.orders set marketplace_exception_status='PARTIAL_EXCEPTION',
      version=version+1 where id=selected.order_id;
    selected_component:='AVAILABILITY'; outcome:='INVENTORY_FAILURE';
  elsif requested_action='START_PREPARING' and selected.status='CONFIRMED' then
    update public.order_fulfillments set status='PREPARING',version=version+1
    where id=selected.id returning * into result;
  elsif requested_action='READY_FOR_CARRIER' and selected.status='PREPARING' then
    update public.order_fulfillments set status='READY_FOR_CARRIER',
      ready_for_carrier_at=now(),version=version+1
    where id=selected.id returning * into result;
  else raise exception 'Fulfillment transition is invalid' using errcode='22023'; end if;
  if outcome is not null then
    select id into strict config_id from public.marketplace_config_versions
      where status='PUBLISHED' and effective_to is null;
    select score_bps into strict score_value from public.marketplace_score_outcome_rules
      where config_version_id=config_id and component=selected_component
      and outcome_code=outcome;
    insert into public.partner_score_events(partner_id,component,outcome_code,
      score_bps,counts_completed_order,source,source_entity_type,source_entity_id,
      evidence,idempotency_key,occurred_at,recorded_by)
    values(selected.partner_id,selected_component,outcome,score_value,false,'FULFILLMENT',
      'order_fulfillment',selected.id,jsonb_build_object('deadline',selected.inventory_confirmation_due_at),
      'fulfillment:'||selected.id::text||':'||outcome,now(),auth.uid())
    on conflict(idempotency_key) do nothing;
  end if;
  insert into public.marketplace_fulfillment_idempotency_keys(
    idempotency_key,fulfillment_id,actor_id,action
  ) values(requested_idempotency_key,selected.id,auth.uid(),requested_action);
  perform set_config('peter_golf.marketplace_order_write','disabled',true);
  perform private.write_marketplace_audit('marketplace.fulfillment_transitioned',
    'order_fulfillment',selected.id,requested_reason,
    jsonb_build_object('status',selected.status,'version',selected.version),
    jsonb_build_object('status',result.status,'version',result.version));
  return result;
exception when others then
  perform set_config('peter_golf.marketplace_order_write','disabled',true);
  raise;
end;
$$;

create or replace function public.transition_marketplace_fulfillment(
  requested_fulfillment_id uuid, expected_version integer,
  requested_action text, requested_reason text,
  requested_idempotency_key uuid
) returns public.order_fulfillments
language plpgsql security definer set search_path = '' as $$
declare selected public.order_fulfillments%rowtype; result public.order_fulfillments;
begin
  if not public.can_manage_marketplace_orders() or requested_idempotency_key is null
  then raise exception 'Marketplace order access denied' using errcode='42501'; end if;
  if exists(select 1 from public.marketplace_fulfillment_idempotency_keys k
    where k.idempotency_key=requested_idempotency_key
      and k.fulfillment_id=requested_fulfillment_id and k.actor_id=auth.uid()
      and k.action=requested_action)
  then select * into result from public.order_fulfillments where id=requested_fulfillment_id;
    return result;
  elsif exists(select 1 from public.marketplace_fulfillment_idempotency_keys k
    where k.idempotency_key=requested_idempotency_key)
  then raise exception 'Idempotency key conflict' using errcode='23505'; end if;
  if char_length(btrim(requested_reason)) not between 3 and 500
  then raise exception 'Reason is required' using errcode='22023'; end if;
  select * into selected from public.order_fulfillments
    where id=requested_fulfillment_id for update;
  if not found then raise exception 'Fulfillment not found' using errcode='P0002'; end if;
  if selected.version<>expected_version then raise exception 'Fulfillment changed' using errcode='40001'; end if;
  perform set_config('peter_golf.marketplace_order_write','enabled',true);
  if requested_action='HOLD' and selected.status not in ('COMPLETED','CANCELLED','ON_HOLD') then
    update public.order_fulfillments set status='ON_HOLD',hold_reason=btrim(requested_reason),
      version=version+1 where id=selected.id returning * into result;
  elsif requested_action='RELEASE_HOLD' and selected.status='ON_HOLD' then
    update public.order_fulfillments set status=case when confirmed_at is null
      then 'PENDING_CONFIRMATION'::public.marketplace_fulfillment_status
      else 'CONFIRMED'::public.marketplace_fulfillment_status end,
      hold_reason=null,version=version+1 where id=selected.id returning * into result;
  elsif requested_action='CANCEL' and selected.status not in ('COMPLETED','CANCELLED') then
    update public.order_fulfillments set status='CANCELLED',cancelled_at=now(),
      cancellation_reason=btrim(requested_reason),version=version+1
      where id=selected.id returning * into result;
    perform private.release_order_reservations_internal(selected.order_id,'RELEASED',btrim(requested_reason));
    update public.orders set marketplace_exception_status='PARTIAL_EXCEPTION',version=version+1
      where id=selected.order_id;
  else raise exception 'Fulfillment transition is invalid' using errcode='22023'; end if;
  insert into public.marketplace_fulfillment_idempotency_keys(
    idempotency_key,fulfillment_id,actor_id,action
  ) values(requested_idempotency_key,selected.id,auth.uid(),requested_action);
  perform set_config('peter_golf.marketplace_order_write','disabled',true);
  perform private.write_marketplace_audit('marketplace.fulfillment_operations_transitioned',
    'order_fulfillment',selected.id,requested_reason,
    jsonb_build_object('status',selected.status,'version',selected.version),
    jsonb_build_object('status',result.status,'version',result.version));
  return result;
exception when others then
  perform set_config('peter_golf.marketplace_order_write','disabled',true);
  raise;
end;
$$;

create or replace function public.get_partner_marketplace_sales(
  requested_fulfillment_id uuid default null
) returns table(
  fulfillment_id uuid, order_number text, order_item_id uuid, listing_title text,
  quantity integer, status public.marketplace_fulfillment_status, version integer,
  inventory_confirmation_due_at timestamptz, carrier_handoff_due_at timestamptz,
  confirmed_at timestamptz, ready_for_carrier_at timestamptz,
  estimated_partner_net numeric(14,0), public_line_total numeric(14,0),
  currency character(3), created_at timestamptz
) language sql stable security definer set search_path = '' as $$
  select f.id,o.order_number,s.order_item_id,s.listing_title,s.quantity,
    f.status,f.version,f.inventory_confirmation_due_at,f.carrier_handoff_due_at,
    f.confirmed_at,f.ready_for_carrier_at,s.estimated_partner_net,
    s.public_line_total,s.currency,f.created_at
  from public.order_fulfillments f
  join public.partner_profiles p on p.id=f.partner_id
  join public.orders o on o.id=f.order_id
  join public.marketplace_order_item_snapshots s on s.fulfillment_id=f.id
  where p.user_id=(select auth.uid()) and f.activated_at is not null
    and (requested_fulfillment_id is null or f.id=requested_fulfillment_id)
  order by f.created_at desc,s.order_item_id
$$;

create or replace function public.get_customer_order_fulfillment_summary(
  requested_order_id uuid
) returns table(
  fulfillment_id uuid, source public.order_fulfillment_source,
  status public.marketplace_fulfillment_status, item_count bigint
) language sql stable security definer set search_path = '' as $$
  select f.id,f.source,f.status,count(oi.id)
  from public.orders o join public.order_fulfillments f on f.order_id=o.id
  join public.order_items oi on oi.fulfillment_id=f.id
  where o.id=requested_order_id and o.user_id=(select auth.uid())
  group by f.id,f.source,f.status
  order by f.created_at
$$;

create or replace function public.release_marketplace_order_reservations(
  requested_order_id uuid, requested_reason text
) returns integer language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_manage_marketplace_orders() then
    raise exception 'Marketplace order access denied' using errcode='42501'; end if;
  return private.release_order_reservations_internal(
    requested_order_id,'RELEASED',requested_reason);
end;
$$;

create or replace function public.release_expired_marketplace_reservations(
  requested_limit integer default 100
) returns integer language plpgsql security definer set search_path = '' as $$
declare selected_order_id uuid; released integer:=0;
begin
  if not public.can_manage_marketplace_orders() then
    raise exception 'Marketplace order access denied' using errcode='42501'; end if;
  if requested_limit not between 1 and 1000 then
    raise exception 'Release limit is invalid' using errcode='22023'; end if;
  for selected_order_id in select distinct order_id from public.inventory_reservations
    where status='ACTIVE' and expires_at<=now() order by order_id limit requested_limit
  loop
    released:=released+private.release_order_reservations_internal(
      selected_order_id,'EXPIRED','Reserva de checkout expirada.');
  end loop;
  return released;
end;
$$;

-- Marketplace-containing orders are confirmed by payment + fulfillment, never
-- by the legacy first-party inventory-sale action (which would sell twice).
create or replace function public.confirm_operational_order(
  requested_order_id uuid, expected_version integer, requested_idempotency_key uuid
) returns table(order_id uuid,status public.order_status,replayed boolean)
language plpgsql security invoker set search_path = '' as $$
declare selected public.orders%rowtype; selected_payment public.order_payments%rowtype;
  existing public.order_idempotency_keys%rowtype; line record;
  inv public.inventory%rowtype; new_balance integer; payload_hash text:=encode(extensions.digest(
    (requested_order_id::text||':'||expected_version::text||':confirm')::bytea,'sha256'),'hex');
begin
  if not public.can_manage_orders() then raise exception 'Order access denied' using errcode='42501'; end if;
  if requested_idempotency_key is null then raise exception 'Idempotency key is required' using errcode='22023'; end if;
  select * into existing from public.order_idempotency_keys where idempotency_key=requested_idempotency_key;
  if found then
    if existing.actor_id<>auth.uid() or existing.operation<>'confirm'
      or existing.order_id<>requested_order_id or existing.payload_hash<>payload_hash
    then raise exception 'Idempotency key conflict' using errcode='23505'; end if;
    return query select o.id,o.status,true from public.orders o where o.id=requested_order_id;
    return;
  end if;
  select * into selected from public.orders where id=requested_order_id for update;
  if not found then raise exception 'Order not found' using errcode='P0002'; end if;
  if exists(select 1 from public.inventory_reservations r where r.order_id=selected.id)
  then raise exception 'Marketplace orders use fulfillment confirmation' using errcode='22023'; end if;
  if selected.status<>'pending_confirmation' then raise exception 'Order cannot be confirmed' using errcode='22023'; end if;
  if selected.version<>expected_version then raise exception 'Order changed' using errcode='40001'; end if;
  select * into selected_payment from public.order_payments where order_payments.order_id=selected.id;
  if selected_payment.id is not null and selected_payment.provider='stripe'
    and selected_payment.status<>'paid'
  then raise exception 'Stripe payment is not paid' using errcode='22023'; end if;
  if not exists(select 1 from public.order_items where public.order_items.order_id=selected.id)
  then raise exception 'Empty order cannot be confirmed' using errcode='23514'; end if;
  for line in select oi.variant_id,sum(oi.quantity)::integer quantity
    from public.order_items oi where oi.order_id=selected.id
    group by oi.variant_id order by oi.variant_id
  loop
    select * into inv from public.inventory where variant_id=line.variant_id for update;
    if not found or inv.quantity_on_hand-inv.quantity_reserved<line.quantity
    then raise exception 'Insufficient inventory' using errcode='23514'; end if;
    new_balance:=inv.quantity_on_hand-line.quantity;
    perform set_config('peter_golf.inventory_rpc_write','enabled',true);
    update public.inventory set quantity_on_hand=new_balance where id=inv.id;
    insert into public.inventory_movements(inventory_id,movement_type,quantity_delta,
      quantity_on_hand_after,quantity_reserved_after,reason,reference_type,
      reference_id,actor_id,idempotency_key)
    values(inv.id,'sale',-line.quantity,new_balance,inv.quantity_reserved,
      'Confirmación de pedido '||selected.order_number,'order',selected.id,auth.uid(),
      (substr(md5(requested_idempotency_key::text||line.variant_id::text),1,8)||'-'||
       substr(md5(requested_idempotency_key::text||line.variant_id::text),9,4)||'-'||
       substr(md5(requested_idempotency_key::text||line.variant_id::text),13,4)||'-'||
       substr(md5(requested_idempotency_key::text||line.variant_id::text),17,4)||'-'||
       substr(md5(requested_idempotency_key::text||line.variant_id::text),21,12))::uuid);
  end loop;
  perform set_config('peter_golf.inventory_rpc_write','disabled',true);
  perform set_config('peter_golf.order_rpc_write','enabled',true);
  update public.orders set status='preparing',confirmed_at=now(),confirmed_by=auth.uid(),
    updated_by=auth.uid(),version=version+1 where id=selected.id;
  insert into public.order_idempotency_keys(idempotency_key,actor_id,operation,order_id,payload_hash)
    values(requested_idempotency_key,auth.uid(),'confirm',selected.id,payload_hash);
  perform set_config('peter_golf.order_rpc_write','disabled',true);
  return query select selected.id,'preparing'::public.order_status,false;
exception when others then
  perform set_config('peter_golf.inventory_rpc_write','disabled',true);
  perform set_config('peter_golf.order_rpc_write','disabled',true);
  raise;
end;
$$;

create or replace function private.sync_order_from_marketplace_fulfillments()
returns trigger language plpgsql security definer set search_path = '' as $$
declare next_status public.order_status;
begin
  if exists(select 1 from public.order_fulfillments f
    where f.order_id=new.order_id and f.status='CANCELLED') then
    update public.orders set marketplace_exception_status='PARTIAL_EXCEPTION'
      where id=new.order_id;
    return new;
  end if;
  if exists(select 1 from public.order_fulfillments f
    where f.order_id=new.order_id and f.status='ON_HOLD') then
    update public.orders set marketplace_exception_status='ON_HOLD' where id=new.order_id;
    return new;
  end if;
  update public.orders set marketplace_exception_status='NONE'
    where id=new.order_id and marketplace_exception_status='ON_HOLD';
  if not exists(select 1 from public.order_payments p where p.order_id=new.order_id and p.status='paid')
  then return new; end if;
  if not exists(select 1 from public.order_fulfillments f where f.order_id=new.order_id
    and f.status not in('COMPLETED')) then next_status:='delivered';
  elsif not exists(select 1 from public.order_fulfillments f where f.order_id=new.order_id
    and f.status not in('SHIPPED','DELIVERED','ACCEPTANCE_PENDING','COMPLETED')) then next_status:='shipped';
  elsif not exists(select 1 from public.order_fulfillments f where f.order_id=new.order_id
    and f.status not in('CONFIRMED','PREPARING','READY_FOR_CARRIER','SHIPPED','DELIVERED','ACCEPTANCE_PENDING','COMPLETED'))
  then next_status:='preparing'; else return new; end if;
  update public.orders set status=next_status,
    confirmed_at=case when next_status='preparing' then coalesce(confirmed_at,now()) else confirmed_at end,
    version=version+1 where id=new.order_id and status is distinct from next_status;
  return new;
end;
$$;
revoke all on function private.sync_order_from_marketplace_fulfillments()
from public,anon,authenticated,service_role;
create trigger order_fulfillments_sync_order
after update of status on public.order_fulfillments
for each row execute function private.sync_order_from_marketplace_fulfillments();

alter table public.order_fulfillments enable row level security;
alter table public.marketplace_order_item_snapshots enable row level security;
alter table public.inventory_reservations enable row level security;
alter table public.marketplace_fulfillment_status_history enable row level security;
alter table public.marketplace_fulfillment_idempotency_keys enable row level security;

create policy "Marketplace order staff read fulfillments"
on public.order_fulfillments for select to authenticated
using ((select public.can_manage_marketplace_orders()));
create policy "Partners read own fulfillments"
on public.order_fulfillments for select to authenticated
using (activated_at is not null and (select private.partner_owns_fulfillment(id)));
create policy "Marketplace order staff read snapshots"
on public.marketplace_order_item_snapshots for select to authenticated
using ((select public.can_manage_marketplace_orders()));
create policy "Marketplace order staff read reservations"
on public.inventory_reservations for select to authenticated
using ((select public.can_manage_marketplace_orders()));
create policy "Marketplace order staff read fulfillment history"
on public.marketplace_fulfillment_status_history for select to authenticated
using ((select public.can_manage_marketplace_orders()));
create policy "Partners read own fulfillment history"
on public.marketplace_fulfillment_status_history for select to authenticated
using ((select private.partner_owns_fulfillment(fulfillment_id)));
create policy "Partners read own marketplace order items"
on public.order_items for select to authenticated
using (item_source='MARKETPLACE_PARTNER' and fulfillment_id is not null
  and (select private.partner_owns_fulfillment(fulfillment_id)));

revoke all on public.order_fulfillments,public.marketplace_order_item_snapshots,
  public.inventory_reservations,public.marketplace_fulfillment_status_history,
  public.marketplace_fulfillment_idempotency_keys
from public,anon,authenticated;
grant select on public.order_fulfillments,public.marketplace_order_item_snapshots,
  public.inventory_reservations,public.marketplace_fulfillment_status_history
to authenticated;

revoke all on function public.add_marketplace_cart_item(uuid,uuid,integer,uuid),
  public.create_marketplace_checkout_order(uuid,integer,uuid,uuid,jsonb,boolean,uuid,public.payment_method),
  public.transition_partner_fulfillment(uuid,integer,text,text,uuid),
  public.transition_marketplace_fulfillment(uuid,integer,text,text,uuid),
  public.get_partner_marketplace_sales(uuid),
  public.get_customer_order_fulfillment_summary(uuid),
  public.release_marketplace_order_reservations(uuid,text),
  public.release_expired_marketplace_reservations(integer)
from public,anon,authenticated;
grant execute on function public.add_marketplace_cart_item(uuid,uuid,integer,uuid),
  public.create_marketplace_checkout_order(uuid,integer,uuid,uuid,jsonb,boolean,uuid,public.payment_method),
  public.transition_partner_fulfillment(uuid,integer,text,text,uuid),
  public.transition_marketplace_fulfillment(uuid,integer,text,text,uuid),
  public.get_partner_marketplace_sales(uuid),
  public.get_customer_order_fulfillment_summary(uuid)
to authenticated;
grant execute on function public.release_marketplace_order_reservations(uuid,text),
  public.release_expired_marketplace_reservations(integer)
to authenticated;

comment on table public.marketplace_order_item_snapshots is
  'Immutable Marketplace listing, quote and economics snapshot used by an order; never recalculated from current tier or config.';
comment on table public.inventory_reservations is
  'Atomic pre-payment reservations for mixed First-party and Marketplace checkout.';
comment on column public.marketplace_order_item_snapshots.actual_processing is
  'Reserved for actual provider cost reconciliation; PR6 leaves it null and does not mutate the approved quote.';
