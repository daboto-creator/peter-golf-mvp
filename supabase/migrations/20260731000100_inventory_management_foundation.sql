-- Auditable operator/admin inventory adjustments for the existing variant model.
-- This migration is intentionally local until it receives explicit review.

alter table public.inventory_movements
  add column idempotency_key uuid;

create unique index inventory_movements_idempotency_key_idx
  on public.inventory_movements (idempotency_key)
  where idempotency_key is not null;

-- The key is intentionally global: it identifies one exact authenticated
-- request across all inventory items and actors. adjust_inventory validates
-- the complete normalized payload before accepting an existing key as replay.

create policy "catalog staff can read inventory"
on public.inventory
for select
to authenticated
using ((select public.can_manage_catalog()));

create policy "catalog staff can initialize inventory through rpc"
on public.inventory
for insert
to authenticated
with check ((select public.can_manage_catalog()));

create policy "catalog staff can adjust inventory through rpc"
on public.inventory
for update
to authenticated
using ((select public.can_manage_catalog()))
with check ((select public.can_manage_catalog()));

create policy "catalog staff can read inventory movements"
on public.inventory_movements
for select
to authenticated
using ((select public.can_manage_catalog()));

create policy "catalog staff can create inventory movements through rpc"
on public.inventory_movements
for insert
to authenticated
with check (
  (select public.can_manage_catalog())
  and actor_id = (select auth.uid())
);

create policy "catalog staff can read all product variants"
on public.product_variants
for select
to authenticated
using ((select public.can_manage_catalog()));

revoke all on public.inventory, public.inventory_movements
from anon, authenticated;

grant select (
  id, variant_id, quantity_on_hand, quantity_reserved, reorder_point,
  created_at, updated_at
) on public.inventory to authenticated;

grant select (
  id, inventory_id, movement_type, quantity_delta, quantity_on_hand_after,
  quantity_reserved_after, reason, reference_type, reference_id, actor_id,
  idempotency_key, created_at
) on public.inventory_movements to authenticated;

-- These narrow grants are required by SECURITY INVOKER functions. Triggers
-- below reject direct PostgREST writes unless the RPC establishes its local
-- transaction context first.
grant insert (variant_id) on public.inventory to authenticated;
grant update (quantity_on_hand) on public.inventory to authenticated;
grant insert (
  inventory_id, movement_type, quantity_delta, quantity_on_hand_after,
  quantity_reserved_after, reason, reference_type, reference_id, actor_id,
  idempotency_key
) on public.inventory_movements to authenticated;

create or replace function public.require_inventory_rpc_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_setting('peter_golf.inventory_rpc_write', true) <> 'enabled' then
    raise exception 'Inventory writes require the inventory RPC'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger inventory_requires_rpc_write
before insert or update on public.inventory
for each row execute function public.require_inventory_rpc_write();

create trigger inventory_movements_require_rpc_write
before insert on public.inventory_movements
for each row execute function public.require_inventory_rpc_write();

revoke all on function public.require_inventory_rpc_write()
from public, anon, authenticated;

create or replace function public.initialize_inventory(
  requested_variant_id uuid
)
returns table (
  inventory_id uuid,
  quantity_on_hand integer,
  quantity_reserved integer,
  available integer,
  reorder_point integer,
  initialized boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_inventory public.inventory%rowtype;
  selected_product_id uuid;
  selected_product_status public.product_status;
  selected_archived_at timestamptz;
  selected_variant_active boolean;
  selected_variant_archived_at timestamptz;
  operational_variant_count integer;
  created_inventory boolean := false;
begin
  if not public.can_manage_catalog() then
    raise exception 'Catalog access denied' using errcode = '42501';
  end if;

  select
    products.id,
    products.status,
    products.archived_at,
    product_variants.active,
    product_variants.archived_at
  into
    selected_product_id,
    selected_product_status,
    selected_archived_at,
    selected_variant_active,
    selected_variant_archived_at
  from public.product_variants
  inner join public.products on products.id = product_variants.product_id
  where product_variants.id = requested_variant_id
  -- The product row is the lock root for this phase. Variant mutation is not
  -- exposed operationally, so authenticated callers need no UPDATE privilege
  -- on product_variants merely to initialize inventory.
  for update of products;

  if not found then
    raise exception 'Inventory item unavailable' using errcode = 'P0002';
  end if;

  if selected_product_status = 'archived'
    or selected_archived_at is not null
    or not selected_variant_active
    or selected_variant_archived_at is not null
  then
    raise exception 'Archived inventory cannot be adjusted' using errcode = '22023';
  end if;

  select count(*)
  into operational_variant_count
  from public.product_variants
  where product_variants.product_id = selected_product_id
    and product_variants.active
    and product_variants.archived_at is null;

  if operational_variant_count <> 1 then
    raise exception 'Product requires variant management' using errcode = '22023';
  end if;

  perform set_config('peter_golf.inventory_rpc_write', 'enabled', true);

  insert into public.inventory (variant_id)
  values (requested_variant_id)
  on conflict (variant_id) do nothing
  returning * into selected_inventory;

  if found then
    created_inventory := true;
  else
    select *
    into selected_inventory
    from public.inventory
    where inventory.variant_id = requested_variant_id
    for update;
  end if;

  perform set_config('peter_golf.inventory_rpc_write', 'disabled', true);

  return query select
    selected_inventory.id,
    selected_inventory.quantity_on_hand,
    selected_inventory.quantity_reserved,
    selected_inventory.quantity_on_hand - selected_inventory.quantity_reserved,
    selected_inventory.reorder_point,
    created_inventory;
end;
$$;

create or replace function public.adjust_inventory(
  requested_variant_id uuid,
  requested_movement_type public.inventory_movement_type,
  requested_quantity_delta integer,
  requested_reason text,
  requested_idempotency_key uuid,
  requested_reference_type text default null,
  requested_reference_id uuid default null
)
returns table (
  movement_id uuid,
  inventory_id uuid,
  quantity_on_hand_before integer,
  quantity_on_hand_after integer,
  quantity_reserved_after integer,
  available_after integer,
  replayed boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  initialized record;
  selected_inventory public.inventory%rowtype;
  existing_movement public.inventory_movements%rowtype;
  new_quantity_on_hand integer;
  new_movement_id uuid;
begin
  if not public.can_manage_catalog() then
    raise exception 'Catalog access denied' using errcode = '42501';
  end if;

  if requested_movement_type not in ('receipt', 'adjustment') then
    raise exception 'Unsupported inventory movement' using errcode = '22023';
  end if;

  if requested_quantity_delta = 0 then
    raise exception 'Inventory quantity cannot be zero' using errcode = '22023';
  end if;

  if requested_movement_type = 'receipt' and requested_quantity_delta < 0 then
    raise exception 'Receipt quantity must be positive' using errcode = '22023';
  end if;

  if requested_quantity_delta < -1000000 or requested_quantity_delta > 1000000 then
    raise exception 'Inventory quantity is out of range' using errcode = '22023';
  end if;

  if char_length(btrim(requested_reason)) not between 3 and 500 then
    raise exception 'Inventory reason is invalid' using errcode = '22023';
  end if;

  if (requested_reference_type is null) <> (requested_reference_id is null)
    or (
      requested_reference_type is not null
      and char_length(btrim(requested_reference_type)) not between 1 and 80
    )
  then
    raise exception 'Inventory reference is invalid' using errcode = '22023';
  end if;

  if requested_idempotency_key is null then
    raise exception 'Idempotency key is required' using errcode = '22023';
  end if;

  select * into initialized
  from public.initialize_inventory(requested_variant_id);

  select *
  into selected_inventory
  from public.inventory
  where inventory.id = initialized.inventory_id
  for update;

  select *
  into existing_movement
  from public.inventory_movements
  where inventory_movements.idempotency_key = requested_idempotency_key;

  if found then
    if existing_movement.inventory_id is distinct from selected_inventory.id
      or existing_movement.actor_id is distinct from auth.uid()
      or existing_movement.movement_type is distinct from requested_movement_type
      or existing_movement.quantity_delta is distinct from requested_quantity_delta
      or existing_movement.reason is distinct from btrim(requested_reason)
      or existing_movement.reference_type is distinct from
        nullif(btrim(requested_reference_type), '')
      or existing_movement.reference_id is distinct from requested_reference_id
    then
      -- SQLSTATE 23505 represents reuse of a globally unique idempotency key
      -- for an operation other than the one it originally identified.
      raise exception 'Idempotency key conflict' using errcode = '23505';
    end if;

    return query select
      existing_movement.id,
      existing_movement.inventory_id,
      existing_movement.quantity_on_hand_after - existing_movement.quantity_delta,
      existing_movement.quantity_on_hand_after,
      existing_movement.quantity_reserved_after,
      existing_movement.quantity_on_hand_after - existing_movement.quantity_reserved_after,
      true;
    return;
  end if;

  new_quantity_on_hand :=
    selected_inventory.quantity_on_hand + requested_quantity_delta;

  if new_quantity_on_hand < 0
    or new_quantity_on_hand < selected_inventory.quantity_reserved
  then
    raise exception 'Insufficient available inventory' using errcode = '23514';
  end if;

  perform set_config('peter_golf.inventory_rpc_write', 'enabled', true);

  update public.inventory
  set quantity_on_hand = new_quantity_on_hand
  where inventory.id = selected_inventory.id;

  insert into public.inventory_movements (
    inventory_id,
    movement_type,
    quantity_delta,
    quantity_on_hand_after,
    quantity_reserved_after,
    reason,
    reference_type,
    reference_id,
    actor_id,
    idempotency_key
  ) values (
    selected_inventory.id,
    requested_movement_type,
    requested_quantity_delta,
    new_quantity_on_hand,
    selected_inventory.quantity_reserved,
    btrim(requested_reason),
    nullif(btrim(requested_reference_type), ''),
    requested_reference_id,
    auth.uid(),
    requested_idempotency_key
  )
  returning id into new_movement_id;

  perform set_config('peter_golf.inventory_rpc_write', 'disabled', true);

  return query select
    new_movement_id,
    selected_inventory.id,
    selected_inventory.quantity_on_hand,
    new_quantity_on_hand,
    selected_inventory.quantity_reserved,
    new_quantity_on_hand - selected_inventory.quantity_reserved,
    false;
end;
$$;

revoke all on function public.initialize_inventory(uuid) from public, anon;
revoke all on function public.adjust_inventory(
  uuid, public.inventory_movement_type, integer, text, uuid, text, uuid
) from public, anon;

grant execute on function public.initialize_inventory(uuid) to authenticated;
grant execute on function public.adjust_inventory(
  uuid, public.inventory_movement_type, integer, text, uuid, text, uuid
) to authenticated;
