-- Allow the existing secure inventory RPCs to manage each operational variant
-- independently. Authorization, RLS, locking, idempotency and audit remain in
-- the foundation migration; only the obsolete single-variant guard changes.

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
  selected_product_status public.product_status;
  selected_product_archived_at timestamptz;
  selected_variant_active boolean;
  selected_variant_archived_at timestamptz;
  created_inventory boolean := false;
begin
  if not public.can_manage_catalog() then
    raise exception 'Catalog access denied' using errcode = '42501';
  end if;

  select
    products.status,
    products.archived_at,
    product_variants.active,
    product_variants.archived_at
  into
    selected_product_status,
    selected_product_archived_at,
    selected_variant_active,
    selected_variant_archived_at
  from public.product_variants
  inner join public.products on products.id = product_variants.product_id
  where product_variants.id = requested_variant_id
  -- The product remains the lock root. Each inventory row has a unique
  -- variant_id and is locked independently below.
  for update of products;

  if not found then
    raise exception 'Inventory item unavailable' using errcode = 'P0002';
  end if;

  if selected_product_status = 'archived'
    or selected_product_archived_at is not null
    or not selected_variant_active
    or selected_variant_archived_at is not null
  then
    raise exception 'Archived inventory cannot be adjusted' using errcode = '22023';
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

revoke all on function public.initialize_inventory(uuid) from public, anon;
grant execute on function public.initialize_inventory(uuid) to authenticated;
