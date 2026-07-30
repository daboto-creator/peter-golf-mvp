-- Shopping carts and simulated-payment orders. No payment credentials are stored.

create table public.shipping_methods (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  base_price public.money_minor_units not null default 0,
  currency public.iso_currency_code not null default 'MXN',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shipping_methods_code_format
    check (code ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  constraint shipping_methods_sort_order_nonnegative check (sort_order >= 0)
);

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.cart_status not null default 'active',
  currency public.iso_currency_code not null default 'MXN',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint carts_expiration_after_creation
    check (expires_at is null or expires_at > created_at)
);

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts (id) on delete cascade,
  variant_id uuid not null
    references public.product_variants (id) on delete restrict,
  quantity integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, variant_id),
  constraint cart_items_quantity_positive check (quantity > 0)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid not null references public.profiles (id) on delete restrict,
  shipping_address_id uuid references public.addresses (id) on delete set null,
  shipping_method_id uuid
    references public.shipping_methods (id) on delete set null,
  status public.order_status not null default 'created',
  currency public.iso_currency_code not null default 'MXN',
  subtotal public.money_minor_units not null,
  discount_total public.money_minor_units not null default 0,
  shipping_total public.money_minor_units not null default 0,
  tax_total public.money_minor_units not null default 0,
  total public.money_minor_units not null,
  shipping_address_snapshot jsonb not null,
  customer_note text,
  internal_note text,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_number_format
    check (order_number ~ '^PG-[A-Z0-9-]{6,40}$'),
  constraint orders_shipping_address_snapshot_object
    check (
      jsonb_typeof(shipping_address_snapshot) = 'object'
      and shipping_address_snapshot <> '{}'::jsonb
    ),
  constraint orders_discount_within_subtotal check (discount_total <= subtotal),
  constraint orders_total_consistent check (
    total = subtotal - discount_total + shipping_total + tax_total
  ),
  constraint orders_cancelled_at_consistent check (
    (status = 'cancelled' and cancelled_at is not null)
    or (status <> 'cancelled')
  )
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  variant_id uuid references public.product_variants (id) on delete restrict,
  sku_snapshot text not null,
  product_name_snapshot text not null,
  variant_name_snapshot text,
  condition_snapshot public.product_condition not null,
  condition_grade_snapshot public.product_condition_grade,
  unit_price_snapshot public.money_minor_units not null,
  currency public.iso_currency_code not null default 'MXN',
  quantity integer not null,
  line_total public.money_minor_units not null,
  created_at timestamptz not null default now(),
  constraint order_items_quantity_positive check (quantity > 0),
  constraint order_items_line_total_consistent
    check (line_total = unit_price_snapshot * quantity),
  constraint order_items_condition_snapshot_consistent check (
    (condition_snapshot = 'used' and condition_grade_snapshot is not null)
    or (condition_snapshot = 'new' and condition_grade_snapshot is null)
  )
);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  from_status public.order_status,
  to_status public.order_status not null,
  changed_by uuid references public.profiles (id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  constraint order_status_history_actual_change
    check (from_status is null or from_status <> to_status)
);

create unique index carts_one_active_per_user_idx
  on public.carts (user_id)
  where status = 'active';
create index carts_user_id_idx on public.carts (user_id);
create index cart_items_cart_id_idx on public.cart_items (cart_id);
create index cart_items_variant_id_idx on public.cart_items (variant_id);
create index orders_user_id_created_at_idx
  on public.orders (user_id, created_at desc);
create index orders_shipping_address_id_idx
  on public.orders (shipping_address_id);
create index orders_shipping_method_id_idx
  on public.orders (shipping_method_id);
create index orders_status_created_at_idx
  on public.orders (status, created_at desc);
create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_product_id_idx on public.order_items (product_id);
create index order_items_variant_id_idx on public.order_items (variant_id);
create index order_status_history_order_id_created_at_idx
  on public.order_status_history (order_id, created_at desc);
create index order_status_history_changed_by_idx
  on public.order_status_history (changed_by);

create trigger shipping_methods_set_updated_at
before update on public.shipping_methods
for each row execute function public.set_updated_at();

create trigger carts_set_updated_at
before update on public.carts
for each row execute function public.set_updated_at();

create trigger cart_items_set_updated_at
before update on public.cart_items
for each row execute function public.set_updated_at();

create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

create or replace function public.record_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_history (
      order_id,
      from_status,
      to_status,
      changed_by
    )
    values (new.id, null, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.order_status_history (
      order_id,
      from_status,
      to_status,
      changed_by
    )
    values (new.id, old.status, new.status, auth.uid());
  end if;

  return new;
end;
$$;

create trigger orders_record_status_change
after insert or update of status on public.orders
for each row execute function public.record_order_status_change();

create trigger order_status_history_is_immutable
before update or delete on public.order_status_history
for each row execute function public.reject_immutable_row_change();

