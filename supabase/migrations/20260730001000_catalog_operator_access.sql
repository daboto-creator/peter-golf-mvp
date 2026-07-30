-- Minimal catalog-management access for authenticated operator/admin sessions.
-- The public catalog policies and column grants remain unchanged.

insert into public.roles (name, description)
values
  ('operator', 'Operación de catálogo, inventario y seguimiento'),
  ('admin', 'Administración autorizada del sistema')
on conflict (name) do nothing;

create or replace function public.can_manage_catalog()
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

revoke all on function public.can_manage_catalog() from public, anon;
grant execute on function public.can_manage_catalog() to authenticated;

create or replace function public.can_manage_catalog_references(
  requested_brand_id uuid,
  requested_category_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_manage_catalog()
    and
    exists (
      select 1
      from public.brands
      where brands.id = requested_brand_id
        and brands.status = 'active'
    )
    and
    exists (
      select 1
      from public.categories
      where categories.id = requested_category_id
        and categories.status = 'active'
    );
$$;

revoke all on function public.can_manage_catalog_references(uuid, uuid)
  from public, anon;
grant execute on function public.can_manage_catalog_references(uuid, uuid)
  to authenticated;

create policy "catalog staff can read active brands"
on public.brands
for select
to authenticated
using (
  status = 'active'
  and (select public.can_manage_catalog())
);

create policy "catalog staff can read active categories"
on public.categories
for select
to authenticated
using (
  status = 'active'
  and (select public.can_manage_catalog())
);

create policy "catalog staff can read all products"
on public.products
for select
to authenticated
using ((select public.can_manage_catalog()));

create policy "catalog staff can create products"
on public.products
for insert
to authenticated
with check (
  (select public.can_manage_catalog())
  and public.can_manage_catalog_references(brand_id, category_id)
);

create policy "catalog staff can update products"
on public.products
for update
to authenticated
using ((select public.can_manage_catalog()))
with check (
  (select public.can_manage_catalog())
  and (
    status = 'archived'
    or public.can_manage_catalog_references(brand_id, category_id)
  )
);

revoke insert, update, delete, truncate, references, trigger
on public.products
from anon, authenticated;

grant insert (
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
  archived_at
) on public.products to authenticated;

grant update (
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
  archived_at
) on public.products to authenticated;

-- There is intentionally no DELETE policy or privilege. Variants and images
-- retain their existing read-only public policies; their management is outside
-- this catalog-foundation block.
