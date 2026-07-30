-- Variant-level inventory and its immutable movement ledger.

create table public.inventory (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null unique
    references public.product_variants (id) on delete restrict,
  quantity_on_hand integer not null default 0,
  quantity_reserved integer not null default 0,
  reorder_point integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_quantity_on_hand_nonnegative check (quantity_on_hand >= 0),
  constraint inventory_quantity_reserved_nonnegative
    check (quantity_reserved >= 0),
  constraint inventory_reserved_within_on_hand
    check (quantity_reserved <= quantity_on_hand),
  constraint inventory_reorder_point_nonnegative check (reorder_point >= 0)
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references public.inventory (id) on delete restrict,
  movement_type public.inventory_movement_type not null,
  quantity_delta integer not null,
  quantity_on_hand_after integer not null,
  quantity_reserved_after integer not null,
  reason text not null,
  reference_type text,
  reference_id uuid,
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint inventory_movements_delta_nonzero check (quantity_delta <> 0),
  constraint inventory_movements_on_hand_after_nonnegative
    check (quantity_on_hand_after >= 0),
  constraint inventory_movements_reserved_after_nonnegative
    check (quantity_reserved_after >= 0),
  constraint inventory_movements_reserved_within_on_hand
    check (quantity_reserved_after <= quantity_on_hand_after),
  constraint inventory_movements_reason_length
    check (char_length(reason) between 1 and 500),
  constraint inventory_movements_reference_complete check (
    (reference_type is null and reference_id is null)
    or (reference_type is not null and reference_id is not null)
  )
);

create index inventory_variant_id_idx on public.inventory (variant_id);
create index inventory_movements_inventory_id_created_at_idx
  on public.inventory_movements (inventory_id, created_at desc);
create index inventory_movements_actor_id_idx
  on public.inventory_movements (actor_id);
create index inventory_movements_reference_idx
  on public.inventory_movements (reference_type, reference_id)
  where reference_id is not null;

create trigger inventory_set_updated_at
before update on public.inventory
for each row execute function public.set_updated_at();

create or replace function public.reject_immutable_row_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% rows are immutable', tg_table_name
    using errcode = '55000';
end;
$$;

create trigger inventory_movements_are_immutable
before update or delete on public.inventory_movements
for each row execute function public.reject_immutable_row_change();

