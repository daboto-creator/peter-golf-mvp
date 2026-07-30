-- Deny by default. Only the explicitly documented client operations are open.

alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.user_roles enable row level security;
alter table public.addresses enable row level security;
alter table public.brands enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;
alter table public.inventory enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.shipping_methods enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.advisory_sessions enable row level security;
alter table public.advisory_answers enable row level security;
alter table public.advisory_recommendations enable row level security;
alter table public.advisory_requests enable row level security;
alter table public.pages enable row level security;
alter table public.site_settings enable row level security;
alter table public.audit_logs enable row level security;

-- The public catalog policies are the only intentional anonymous access.
create policy "public can read published products"
on public.products
for select
to anon, authenticated
using (status = 'active' and published and archived_at is null);

create policy "public can read brands for published products"
on public.brands
for select
to anon, authenticated
using (
  status = 'active'
  and exists (
    select 1
    from public.products
    where products.brand_id = brands.id
      and products.status = 'active'
      and products.published
      and products.archived_at is null
  )
);

create policy "public can read categories for published products"
on public.categories
for select
to anon, authenticated
using (
  status = 'active'
  and exists (
    select 1
    from public.products
    where products.category_id = categories.id
      and products.status = 'active'
      and products.published
      and products.archived_at is null
  )
);

create policy "public can read active variants of published products"
on public.product_variants
for select
to anon, authenticated
using (
  active
  and archived_at is null
  and exists (
    select 1
    from public.products
    where products.id = product_variants.product_id
      and products.status = 'active'
      and products.published
      and products.archived_at is null
  )
);

create policy "public can read images of published products"
on public.product_images
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.products
    where products.id = product_images.product_id
      and products.status = 'active'
      and products.published
      and products.archived_at is null
  )
);

-- Authenticated users own their profile but cannot access roles or assignments.
create policy "users can read own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "users can create own profile"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

create policy "users can update own profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "users can read own addresses"
on public.addresses
for select
to authenticated
using ((select auth.uid()) = user_id);

-- A signed-in user can access only their own active or historical carts.
create policy "users can read own carts"
on public.carts
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "users can create own carts"
on public.carts
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "users can update own carts"
on public.carts
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users can delete own carts"
on public.carts
for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "users can read own cart items"
on public.cart_items
for select
to authenticated
using (
  exists (
    select 1
    from public.carts
    where carts.id = cart_items.cart_id
      and carts.user_id = (select auth.uid())
  )
);

create policy "users can create own cart items"
on public.cart_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.carts
    where carts.id = cart_items.cart_id
      and carts.user_id = (select auth.uid())
  )
);

create policy "users can update own cart items"
on public.cart_items
for update
to authenticated
using (
  exists (
    select 1
    from public.carts
    where carts.id = cart_items.cart_id
      and carts.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.carts
    where carts.id = cart_items.cart_id
      and carts.user_id = (select auth.uid())
  )
);

create policy "users can delete own cart items"
on public.cart_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.carts
    where carts.id = cart_items.cart_id
      and carts.user_id = (select auth.uid())
  )
);

-- Orders are server-created and server-mutated; clients receive read-only access.
create policy "users can read own orders"
on public.orders
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "users can read own order items"
on public.order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.orders
    where orders.id = order_items.order_id
      and orders.user_id = (select auth.uid())
  )
);

create policy "users can read own order status history"
on public.order_status_history
for select
to authenticated
using (
  exists (
    select 1
    from public.orders
    where orders.id = order_status_history.order_id
      and orders.user_id = (select auth.uid())
  )
);

-- Cost is server-only even for public products and variants. A table-level
-- SELECT grant would allow requesting it despite the row policy, so expose only
-- the reviewed public columns.
revoke select on public.products from anon, authenticated;
grant select (
  id,
  slug,
  sku,
  name,
  short_description,
  description,
  condition,
  condition_grade,
  condition_notes,
  brand_id,
  category_id,
  status,
  fulfillment_type,
  price,
  compare_at_price,
  currency,
  featured,
  published,
  price_is_estimate,
  lead_time_min_days,
  lead_time_max_days,
  seo_title,
  seo_description,
  archived_at,
  created_at,
  updated_at
) on public.products to anon, authenticated;

revoke select on public.product_variants from anon, authenticated;
grant select (
  id,
  product_id,
  sku,
  name,
  attributes,
  price,
  compare_at_price,
  active,
  sort_order,
  archived_at,
  created_at,
  updated_at
) on public.product_variants to anon, authenticated;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.reject_immutable_row_change()
  from public, anon, authenticated;
revoke all on function public.record_order_status_change()
  from public, anon, authenticated;
