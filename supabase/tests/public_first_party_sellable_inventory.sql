begin;
select plan(7);

do $$
declare
  selected_brand uuid;
  selected_category uuid;
begin
  select id into strict selected_brand from public.brands order by id limit 1;
  select category.id into strict selected_category
  from public.categories category
  join public.category_spec_profiles profile on profile.category_id = category.id
  where profile.club_type = 'driver'
  order by category.id limit 1;

  insert into public.products (
    id, slug, sku, name, condition, brand_id, category_id, status,
    fulfillment_type, price, published, archived_at
  ) values
    ('93000000-0000-4000-8000-000000000010','pr93-stock-two','PR93-10','PR93 stock two','new',selected_brand,selected_category,'active','in_stock',10000,true,null),
    ('93000000-0000-4000-8000-000000000011','pr93-fully-reserved','PR93-11','PR93 fully reserved','new',selected_brand,selected_category,'active','in_stock',10000,true,null),
    ('93000000-0000-4000-8000-000000000012','pr93-empty','PR93-12','PR93 empty','new',selected_brand,selected_category,'active','in_stock',10000,true,null),
    ('93000000-0000-4000-8000-000000000013','pr93-archived','PR93-13','PR93 archived','new',selected_brand,selected_category,'archived','in_stock',10000,false,now()),
    ('93000000-0000-4000-8000-000000000014','pr93-inactive-variant','PR93-14','PR93 inactive variant','new',selected_brand,selected_category,'active','in_stock',10000,true,null),
    ('93000000-0000-4000-8000-000000000015','pr93-invalid-variant-price','PR93-15','PR93 invalid variant price','new',selected_brand,selected_category,'active','in_stock',10000,true,null),
    ('93000000-0000-4000-8000-000000000016','pr93-unpublished','PR93-16','PR93 unpublished','new',selected_brand,selected_category,'active','in_stock',10000,false,null);

  insert into public.product_variants (id,product_id,sku,name,price,active,archived_at) values
    ('93000000-0000-4000-8000-000000000020','93000000-0000-4000-8000-000000000010','PR93-20','Default',null,true,null),
    ('93000000-0000-4000-8000-000000000021','93000000-0000-4000-8000-000000000011','PR93-21','Default',null,true,null),
    ('93000000-0000-4000-8000-000000000022','93000000-0000-4000-8000-000000000012','PR93-22','Default',null,true,null),
    ('93000000-0000-4000-8000-000000000023','93000000-0000-4000-8000-000000000013','PR93-23','Default',null,true,null),
    ('93000000-0000-4000-8000-000000000024','93000000-0000-4000-8000-000000000014','PR93-24','Default',null,false,null),
    ('93000000-0000-4000-8000-000000000025','93000000-0000-4000-8000-000000000015','PR93-25','Default',0,true,null),
    ('93000000-0000-4000-8000-000000000026','93000000-0000-4000-8000-000000000016','PR93-26','Default',null,true,null);

  insert into public.inventory (variant_id,quantity_on_hand,quantity_reserved) values
    ('93000000-0000-4000-8000-000000000020',3,1),
    ('93000000-0000-4000-8000-000000000021',1,1),
    ('93000000-0000-4000-8000-000000000022',0,0),
    ('93000000-0000-4000-8000-000000000023',2,0),
    ('93000000-0000-4000-8000-000000000024',2,0),
    ('93000000-0000-4000-8000-000000000025',2,0),
    ('93000000-0000-4000-8000-000000000026',2,0);
end $$;

set local role anon;
select is(
  (select available_quantity from public.get_public_first_party_sellable_inventory()
   where product_id = '93000000-0000-4000-8000-000000000010'),
  2,
  '3 on hand minus 1 reserved is reported as 2 available'
);
select ok(
  not exists (
    select 1 from public.get_public_first_party_sellable_inventory()
    where product_id in (
      '93000000-0000-4000-8000-000000000011',
      '93000000-0000-4000-8000-000000000012',
      '93000000-0000-4000-8000-000000000013',
      '93000000-0000-4000-8000-000000000014',
      '93000000-0000-4000-8000-000000000015',
      '93000000-0000-4000-8000-000000000016'
    )
  ),
  'reserved, zero-stock, archived, inactive variant, invalid price, and unpublished products are excluded'
);
select ok(
  not (
    (select to_jsonb(projection) from public.get_public_first_party_sellable_inventory() projection
     where product_id = '93000000-0000-4000-8000-000000000010')
    ?| array['cost','acquisition_cost','margin','commission','supplier','reserved','inventory_id','variant_id','partner_net']
  ),
  'anonymous projection omits internal economics and inventory identifiers'
);
select throws_ok(
  'select * from public.get_best_round_first_party_inventory()',
  '42501',
  null,
  'anonymous cannot call the authenticated internal inventory RPC'
);
reset role;

select ok(
  has_function_privilege('anon', 'public.get_public_first_party_sellable_inventory()', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.get_public_first_party_sellable_inventory()', 'EXECUTE')
  and not has_function_privilege('public', 'public.get_public_first_party_sellable_inventory()', 'EXECUTE'),
  'only anon and authenticated receive execute on the sanitized public projection'
);
select ok(
  not has_function_privilege('anon', 'public.get_best_round_first_party_inventory()', 'EXECUTE'),
  'internal inventory RPC remains unavailable to anon'
);
select ok(
  (select prosecdef and proconfig @> array['search_path=""']
   from pg_proc
   where oid = 'public.get_public_first_party_sellable_inventory()'::regprocedure),
  'public projection is read-only SQL SECURITY DEFINER with an empty search_path'
);

select * from finish();
rollback;
