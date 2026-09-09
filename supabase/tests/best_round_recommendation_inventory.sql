-- PR77 first-party recommendation inventory is authenticated, bounded and sellability-gated.
begin;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '77000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'pr77-buyer@example.test', '{}', '{}', now(), now()
);

do $$
declare
  selected_brand uuid;
  selected_category uuid;
begin
  select id into strict selected_brand from public.brands order by id limit 1;
  select category.id into strict selected_category
  from public.categories category
  join public.category_spec_profiles profile on profile.category_id=category.id
  where profile.club_type='driver'
  order by category.id limit 1;

  insert into public.products (
    id, slug, sku, name, condition, brand_id, category_id,
    status, fulfillment_type, price, published, archived_at
  ) values
    ('77000000-0000-4000-8000-000000000010','pr77-sellable','PR77-SELL','PR77 Sellable','new',selected_brand,selected_category,'active','in_stock',10000,true,null),
    ('77000000-0000-4000-8000-000000000011','pr77-zero-stock','PR77-ZERO','PR77 Zero','new',selected_brand,selected_category,'active','in_stock',10000,true,null),
    ('77000000-0000-4000-8000-000000000012','pr77-unpublished','PR77-DRAFT','PR77 Draft','new',selected_brand,selected_category,'active','in_stock',10000,false,null),
    ('77000000-0000-4000-8000-000000000013','pr77-archived','PR77-ARCH','PR77 Archived','new',selected_brand,selected_category,'archived','in_stock',10000,false,now());

  insert into public.product_variants (id,product_id,sku,name,active) values
    ('77000000-0000-4000-8000-000000000020','77000000-0000-4000-8000-000000000010','PR77-SELL-V','Default',true),
    ('77000000-0000-4000-8000-000000000021','77000000-0000-4000-8000-000000000011','PR77-ZERO-V','Default',true),
    ('77000000-0000-4000-8000-000000000022','77000000-0000-4000-8000-000000000012','PR77-DRAFT-V','Default',true),
    ('77000000-0000-4000-8000-000000000023','77000000-0000-4000-8000-000000000013','PR77-ARCH-V','Default',true);

  insert into public.inventory(variant_id,quantity_on_hand,quantity_reserved) values
    ('77000000-0000-4000-8000-000000000020',3,1),
    ('77000000-0000-4000-8000-000000000021',1,1),
    ('77000000-0000-4000-8000-000000000022',2,0),
    ('77000000-0000-4000-8000-000000000023',2,0);
end $$;

set local role anon;
do $$ begin
  begin
    perform * from public.get_best_round_first_party_inventory();
    raise exception 'Anonymous role invoked recommendation inventory';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select set_config('request.jwt.claim.sub','77000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$
declare result record;
begin
  select * into strict result
  from public.get_best_round_first_party_inventory()
  where product_id='77000000-0000-4000-8000-000000000010';
  if result.available_quantity <> 2 or result.price <> 10000 or result.match_category <> 'DRIVER' then
    raise exception 'Sellable unit projection was incorrect';
  end if;
  if exists(
    select 1 from public.get_best_round_first_party_inventory()
    where product_id in (
      '77000000-0000-4000-8000-000000000011',
      '77000000-0000-4000-8000-000000000012',
      '77000000-0000-4000-8000-000000000013'
    )
  ) then raise exception 'Unsellable first-party inventory was exposed'; end if;
end $$;
reset role;

select 'best round recommendation inventory checks passed' as result;
rollback;
