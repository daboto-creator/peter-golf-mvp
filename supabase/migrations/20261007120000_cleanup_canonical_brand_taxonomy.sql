-- Canonical brand taxonomy cleanup for PR81.
--
-- This migration is data-only and intentionally does not delete brands or
-- products.  The duplicate Taylor Made identity is remapped to TaylorMade,
-- while the staging fixture is archived and unpublished so it cannot appear
-- in shopper-facing catalog reads.  Historical rows remain addressable.

do $$
declare
  canonical_taylormade_id uuid;
  duplicate_taylormade_id uuid;
  staging_fixture_id uuid;
begin
  select id
    into canonical_taylormade_id
    from public.brands
   where slug = 'taylormade'
   limit 1;

  select id
    into duplicate_taylormade_id
    from public.brands
   where slug = 'taylor-made'
   limit 1;

  if canonical_taylormade_id is not null
     and duplicate_taylormade_id is not null
     and canonical_taylormade_id <> duplicate_taylormade_id then
    -- Remap every FK-bearing reference before archiving the duplicate.
    update public.products
       set brand_id = canonical_taylormade_id
     where brand_id = duplicate_taylormade_id;

    update public.market_price_researches
       set brand_id = canonical_taylormade_id
     where brand_id = duplicate_taylormade_id;

    update public.marketplace_listing_versions
       set brand_id = canonical_taylormade_id
     where brand_id = duplicate_taylormade_id;

    update public.mi_golf_equipment
       set canonical_brand_id = canonical_taylormade_id
     where canonical_brand_id = duplicate_taylormade_id;

    update public.brands
       set status = 'archived'
     where id = duplicate_taylormade_id;
  end if;

  select id
    into staging_fixture_id
    from public.brands
   where slug = 'marca-taxonomia-staging'
   limit 1;

  if staging_fixture_id is not null then
    -- Preserve the fixture product row for historical/test references, but
    -- remove it from public catalog visibility before archiving its brand.
    update public.products
       set status = 'archived',
           published = false,
           archived_at = coalesce(archived_at, now())
     where brand_id = staging_fixture_id;

    update public.brands
       set status = 'archived'
     where id = staging_fixture_id;
  end if;
end;
$$;
