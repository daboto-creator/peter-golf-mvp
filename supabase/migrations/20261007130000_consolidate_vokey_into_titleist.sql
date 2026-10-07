-- Consolidate Vokey Design into the Titleist canonical brand.
-- Vokey remains customer-visible in wedge model names (for example,
-- "Vokey SM10"). Historical rows are preserved; duplicate brand/model rows
-- are archived only after their references have been remapped.

do $$
declare
  titleist_id uuid;
  vokey_id uuid;
begin
  select id into titleist_id from public.brands where slug = 'titleist' limit 1;
  select id into vokey_id from public.brands where slug = 'vokey' limit 1;

  if titleist_id is null or vokey_id is null or titleist_id = vokey_id then
    return;
  end if;

  create temporary table _vokey_model_map (
    old_model_id uuid primary key,
    new_model_id uuid not null
  ) on commit drop;

  -- Add missing canonical Titleist wedge model families. SM10 already exists
  -- as Titleist / Vokey SM10 and is reused below instead of duplicated.
  insert into public.catalog_product_models (
    brand_id, category_id, model_name, normalized_model_name, status
  )
  select
    titleist_id,
    m.category_id,
    'Vokey ' || m.model_name,
    'vokey-' || m.normalized_model_name,
    'active'
  from public.catalog_product_models m
  join public.categories c on c.id = m.category_id
  where m.brand_id = vokey_id
    and c.slug = 'wedge'
    and m.normalized_model_name <> 'sm10'
    and not exists (
      select 1
      from public.catalog_product_models existing
      where existing.brand_id = titleist_id
        and existing.category_id = m.category_id
        and existing.normalized_model_name = 'vokey-' || m.normalized_model_name
    );

  insert into _vokey_model_map (old_model_id, new_model_id)
  select old.id, new.id
  from public.catalog_product_models old
  join public.categories c on c.id = old.category_id
  join public.catalog_product_models new
    on new.brand_id = titleist_id
   and new.category_id = old.category_id
   and new.normalized_model_name = case
     when old.normalized_model_name = 'sm10' then 'vokey-sm10'
     else 'vokey-' || old.normalized_model_name
   end
  where old.brand_id = vokey_id
    and c.slug = 'wedge';

  -- Remap every model FK, including immutable marketplace/order snapshots.
  update public.products p
     set canonical_model_id = map.new_model_id
    from _vokey_model_map map
   where p.canonical_model_id = map.old_model_id;

  update public.marketplace_listing_versions l
     set canonical_model_id = map.new_model_id
    from _vokey_model_map map
   where l.canonical_model_id = map.old_model_id;

  update public.marketplace_market_analyses a
     set canonical_product_model_id = map.new_model_id
    from _vokey_model_map map
   where a.canonical_product_model_id = map.old_model_id;

  update public.marketplace_pricing_quotes q
     set canonical_product_model_id = map.new_model_id
    from _vokey_model_map map
   where q.canonical_product_model_id = map.old_model_id;

  update public.marketplace_order_item_snapshots s
     set canonical_product_model_id = map.new_model_id
    from _vokey_model_map map
   where s.canonical_product_model_id = map.old_model_id;

  update public.mi_golf_equipment e
     set canonical_model_id = map.new_model_id
    from _vokey_model_map map
   where e.canonical_model_id = map.old_model_id;

  -- Remap brand references while preserving all product, listing, research,
  -- and user-equipment rows.
  update public.products set brand_id = titleist_id where brand_id = vokey_id;
  update public.market_price_researches set brand_id = titleist_id where brand_id = vokey_id;
  update public.marketplace_listing_versions set brand_id = titleist_id where brand_id = vokey_id;
  update public.mi_golf_equipment set canonical_brand_id = titleist_id where canonical_brand_id = vokey_id;

  update public.catalog_product_models
     set status = 'archived'
   where brand_id = vokey_id;

  update public.brands
     set status = 'archived'
   where id = vokey_id;
end;
$$;
