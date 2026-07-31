-- Secure operator/admin management for the existing catalog taxonomies.
-- This migration is intentionally local until it receives explicit review.

drop policy if exists "catalog staff can read active brands" on public.brands;
drop policy if exists "catalog staff can read active categories" on public.categories;

create policy "catalog staff can read all brands"
on public.brands
for select
to authenticated
using ((select public.can_manage_catalog()));

create policy "catalog staff can read all categories"
on public.categories
for select
to authenticated
using ((select public.can_manage_catalog()));

create policy "catalog staff can create brands"
on public.brands
for insert
to authenticated
with check ((select public.can_manage_catalog()));

create policy "catalog staff can update brands"
on public.brands
for update
to authenticated
using ((select public.can_manage_catalog()))
with check ((select public.can_manage_catalog()));

create policy "catalog staff can create categories"
on public.categories
for insert
to authenticated
with check ((select public.can_manage_catalog()));

create policy "catalog staff can update categories"
on public.categories
for update
to authenticated
using ((select public.can_manage_catalog()))
with check ((select public.can_manage_catalog()));

drop policy if exists "catalog staff can update products" on public.products;

create policy "catalog staff can update products"
on public.products
for update
to authenticated
using ((select public.can_manage_catalog()))
with check ((select public.can_manage_catalog()));

revoke insert, update, delete, truncate, references, trigger
on public.brands, public.categories
from anon, authenticated;

grant insert (slug, name, description, status)
on public.brands to authenticated;
grant update (slug, name, description, status)
on public.brands to authenticated;

grant insert (parent_id, slug, name, description, status, sort_order)
on public.categories to authenticated;
grant update (parent_id, slug, name, description, status, sort_order)
on public.categories to authenticated;

create or replace function public.validate_brand_catalog_state()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'archived' and old.status = 'active' and exists (
    select 1
    from public.products
    where products.brand_id = new.id
      and (products.status = 'active' or products.published)
  ) then
    raise exception 'Brand has active catalog products' using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.validate_category_hierarchy_and_state()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent_changed boolean;
  reactivating boolean;
begin
  if tg_op = 'INSERT' then
    parent_changed := new.parent_id is not null;
    reactivating := false;
  else
    parent_changed := new.parent_id is distinct from old.parent_id;
    reactivating := new.status = 'active' and old.status = 'archived';
  end if;

  if new.parent_id = new.id then
    raise exception 'Category cannot be its own parent' using errcode = '23514';
  end if;

  if new.parent_id is not null
    and (parent_changed or reactivating)
    and not exists (
      select 1
      from public.categories
      where categories.id = new.parent_id
        and categories.status = 'active'
    )
  then
    raise exception 'Category parent must be active' using errcode = '23514';
  end if;

  if new.parent_id is not null and parent_changed and exists (
    with recursive ancestors as (
      select categories.id, categories.parent_id
      from public.categories
      where categories.id = new.parent_id
      union all
      select parent.id, parent.parent_id
      from public.categories as parent
      inner join ancestors on ancestors.parent_id = parent.id
    )
    select 1 from ancestors where ancestors.id = new.id
  ) then
    raise exception 'Category hierarchy cannot contain cycles' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    if new.status = 'archived' and old.status = 'active' and (
      exists (
        select 1
        from public.products
        where products.category_id = new.id
          and (products.status = 'active' or products.published)
      )
      or exists (
        select 1
        from public.categories as child
        where child.parent_id = new.id
          and child.status = 'active'
      )
    ) then
      raise exception 'Category has active catalog dependants' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.validate_product_taxonomy_assignment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  must_validate_references boolean;
begin
  if tg_op = 'INSERT' then
    must_validate_references := true;
  else
    must_validate_references :=
      new.brand_id is distinct from old.brand_id
      or new.category_id is distinct from old.category_id
      or (new.status = 'active' and old.status <> 'active')
      or (new.published and not old.published)
      or (new.archived_at is null and old.archived_at is not null);
  end if;

  if must_validate_references and not (
    exists (
      select 1 from public.brands
      where brands.id = new.brand_id and brands.status = 'active'
    )
    and exists (
      select 1 from public.categories
      where categories.id = new.category_id and categories.status = 'active'
    )
  ) then
    raise exception 'Product taxonomy references must be active'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger brands_validate_catalog_state
before update of status on public.brands
for each row execute function public.validate_brand_catalog_state();

create trigger categories_validate_hierarchy_and_state
before insert or update of parent_id, status on public.categories
for each row execute function public.validate_category_hierarchy_and_state();

create trigger products_validate_taxonomy_assignment_on_insert
before insert
on public.products
for each row execute function public.validate_product_taxonomy_assignment();

create trigger products_validate_taxonomy_assignment_on_update
before update of brand_id, category_id, status, published, archived_at
on public.products
for each row execute function public.validate_product_taxonomy_assignment();

revoke all on function public.validate_brand_catalog_state()
from public, anon, authenticated;
revoke all on function public.validate_category_hierarchy_and_state()
from public, anon, authenticated;
revoke all on function public.validate_product_taxonomy_assignment()
from public, anon, authenticated;

-- There are intentionally no DELETE policies or privileges. Existing product
-- relationships remain intact when a taxonomy record is archived.
