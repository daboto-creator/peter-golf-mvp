-- Reproducible local verification for product taxonomy integrity.
-- Run after `npm run supabase:reset` with:
-- docker exec -i supabase_db_peter-golf-mvp psql -U postgres -d postgres \
--   -v ON_ERROR_STOP=1 < supabase/tests/catalog_taxonomy_integrity.sql

begin;

insert into auth.users (
  id,
  aud,
  role,
  email,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '10000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'taxonomy.operator@example.test',
  '{}'::jsonb,
  '{"first_name":"Taxonomy","last_name":"Operator"}'::jsonb,
  now(),
  now()
);

insert into public.user_roles (user_id, role_id)
select '10000000-0000-4000-8000-000000000001', roles.id
from public.roles
where roles.name = 'operator';

insert into public.brands (id, slug, name, status)
values
  ('20000000-0000-4000-8000-000000000001', 'integrity-active-brand', 'Integrity Active Brand', 'active'),
  ('20000000-0000-4000-8000-000000000002', 'integrity-archived-brand', 'Integrity Archived Brand', 'archived');

insert into public.categories (id, slug, name, status)
values
  ('30000000-0000-4000-8000-000000000001', 'integrity-active-category', 'Integrity Active Category', 'active'),
  ('30000000-0000-4000-8000-000000000002', 'integrity-archived-category', 'Integrity Archived Category', 'archived');

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

-- Active references are accepted for a direct operator insert.
insert into public.products (
  slug,
  sku,
  name,
  condition,
  brand_id,
  category_id,
  status,
  fulfillment_type,
  price,
  published
)
values (
  'integrity-valid-product',
  'INTEGRITY-VALID',
  'Integrity Valid Product',
  'new',
  '20000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  'draft',
  'in_stock',
  10000,
  false
);

do $$
begin
  begin
    insert into public.products (
      slug, sku, name, condition, brand_id, category_id,
      status, fulfillment_type, price, published
    ) values (
      'integrity-archived-brand-product',
      'INTEGRITY-ARCHIVED-BRAND',
      'Integrity Archived Brand Product',
      'new',
      '20000000-0000-4000-8000-000000000002',
      '30000000-0000-4000-8000-000000000001',
      'draft',
      'in_stock',
      10000,
      false
    );
    raise exception 'Expected archived brand insert to fail';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.products (
      slug, sku, name, condition, brand_id, category_id,
      status, fulfillment_type, price, published
    ) values (
      'integrity-archived-category-product',
      'INTEGRITY-ARCHIVED-CATEGORY',
      'Integrity Archived Category Product',
      'new',
      '20000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000002',
      'draft',
      'in_stock',
      10000,
      false
    );
    raise exception 'Expected archived category insert to fail';
  exception
    when check_violation then null;
  end;
end;
$$;

-- Draft products may retain historical references after both taxonomies are
-- archived. Including unchanged guarded columns forces the UPDATE trigger to
-- run and verifies that the historical edit remains allowed.
update public.brands
set status = 'archived'
where id = '20000000-0000-4000-8000-000000000001';

update public.categories
set status = 'archived'
where id = '30000000-0000-4000-8000-000000000001';

update public.products
set
  name = 'Integrity Historical Product Edited',
  brand_id = brand_id,
  category_id = category_id,
  status = status,
  published = published,
  archived_at = archived_at
where slug = 'integrity-valid-product';

do $$
begin
  if not exists (
    select 1
    from public.products
    where slug = 'integrity-valid-product'
      and name = 'Integrity Historical Product Edited'
  ) then
    raise exception 'Expected historical taxonomy edit to succeed';
  end if;
end;
$$;

select 'catalog taxonomy integrity checks passed' as result;

rollback;
