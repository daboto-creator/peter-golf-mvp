-- Partner listings, version immutability, inventory and adversarial RLS.
-- Run after `npm run supabase:reset`; fixtures end in ROLLBACK.

begin;

do $$
declare
  allowed_mimes text[];
begin
  select allowed_mime_types into allowed_mimes
  from storage.buckets
  where id = 'marketplace-listing-images' and not public;
  if allowed_mimes <> array['image/jpeg', 'image/png', 'image/webp']::text[]
    or (select file_size_limit from storage.buckets
        where id = 'marketplace-listing-images') <> 10485760
  then
    raise exception 'Marketplace listing bucket is not private or constrained';
  end if;
end;
$$;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('4a000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'listing-partner-a@example.test', '{}', '{}', now(), now()),
  ('4a000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'listing-partner-b@example.test', '{}', '{}', now(), now()),
  ('4a000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'listing-pending@example.test', '{}', '{}', now(), now()),
  ('4a000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated',
   'listing-golfer@example.test', '{}', '{}', now(), now()),
  ('4a000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated',
   'listing-operator@example.test', '{}', '{}', now(), now());

insert into public.user_roles (user_id, role_id)
select '4a000000-0000-4000-8000-000000000005'::uuid, id
from public.roles where name = 'operator';

insert into public.partner_profiles (
  id, user_id, legal_type, status, verified_at
) values
  ('4b000000-0000-4000-8000-000000000001',
   '4a000000-0000-4000-8000-000000000001', 'INDIVIDUAL', 'VERIFIED', now()),
  ('4b000000-0000-4000-8000-000000000002',
   '4a000000-0000-4000-8000-000000000002', 'LEGAL_ENTITY', 'VERIFIED', now()),
  ('4b000000-0000-4000-8000-000000000003',
   '4a000000-0000-4000-8000-000000000003', 'INDIVIDUAL', 'IDENTITY_PENDING', null);

update public.site_settings
set value = '{"enabled": true}'::jsonb
where key = 'marketplace.enabled';

insert into public.brands (id, slug, name)
values ('4c000000-0000-4000-8000-000000000001', 'listing-test-titleist', 'Listing Test Titleist');

select set_config('request.jwt.claim.sub', '4a000000-0000-4000-8000-000000000001', true);
set local role authenticated;

do $$
declare
  listing_record public.marketplace_listings;
  version_record public.marketplace_listing_versions;
  readiness record;
  driver_category_id uuid;
  titleist_id uuid;
  image_id uuid;
  image_type text;
  image_path text;
begin
  select id into strict driver_category_id from public.categories where slug = 'driver';
  select id into strict titleist_id from public.brands order by name limit 1;

  listing_record := public.create_marketplace_listing(driver_category_id);
  perform set_config('test.marketplace_listing_a', listing_record.id::text, true);

  begin
    perform public.save_marketplace_listing_draft(
      listing_record.id, listing_record.lock_version,
      '{"partnerId":"4b000000-0000-4000-8000-000000000002","status":"APPROVED"}'::jsonb
    );
    -- Unknown keys are ignored rather than mass-assigned.
  exception when others then
    raise exception 'Unknown listing payload keys should not mutate privileged fields: %', sqlerrm;
  end;

  select * into strict listing_record from public.marketplace_listings
  where id = listing_record.id;
  listing_record := public.save_marketplace_listing_draft(
    listing_record.id, listing_record.lock_version,
    jsonb_build_object(
      'brandId', titleist_id,
      'proposedModel', 'GT3',
      'title', 'Titleist GT3 Driver 9 Regular Right',
      'description', 'Driver usado en excelente condición, listo para revisión.'
    )
  );
  listing_record := public.save_marketplace_listing_draft(
    listing_record.id, listing_record.lock_version,
    '{"specifications":{"handedness":"right","shaftFlex":"regular","loftDegrees":9,"shaftModel":"Tensei"}}'::jsonb
  );
  listing_record := public.save_marketplace_listing_draft(
    listing_record.id, listing_record.lock_version,
    '{"condition":"used","conditionGrade":"excellent","conditionNotes":"Marcas menores de uso, sin daño estructural.","declaredDefects":[],"defectsAcknowledged":true}'::jsonb
  );
  listing_record := public.save_marketplace_listing_draft(
    listing_record.id, listing_record.lock_version,
    '{"quantity":1,"custody":"PARTNER_CUSTODY","fulfillment":"PARTNER_FULFILLED"}'::jsonb
  );

  select * into strict version_record from public.marketplace_listing_versions
  where id = listing_record.current_version_id;
  foreach image_type in array array['face', 'crown', 'sole'] loop
    image_id := gen_random_uuid();
    image_path := 'listings/4b000000-0000-4000-8000-000000000001/'
      || listing_record.id::text || '/' || version_record.id::text || '/'
      || image_id::text || '.jpg';
    insert into storage.objects (bucket_id, name, owner)
    values ('marketplace-listing-images', image_path, (select auth.uid()));
    perform public.register_marketplace_listing_image(
      listing_record.id, listing_record.lock_version, image_id, image_path,
      image_type, 'Driver ' || image_type, 'image/jpeg', 2048,
      repeat('a', 64), null, null
    );
    select * into strict listing_record from public.marketplace_listings
    where id = listing_record.id;
  end loop;

  select * into strict readiness
  from public.get_marketplace_listing_readiness(listing_record.id);
  if not readiness.ready or readiness.missing_fields <> array[]::text[] then
    raise exception 'Complete Driver listing readiness is incorrect: %', readiness.missing_fields;
  end if;

  listing_record := public.submit_marketplace_listing(
    listing_record.id, listing_record.lock_version
  );
  if listing_record.status <> 'SUBMITTED' then
    raise exception 'Verified Partner could not submit listing';
  end if;

  select * into strict version_record from public.marketplace_listing_versions
  where id = listing_record.current_version_id;
  if version_record.state <> 'SUBMITTED' or version_record.submitted_at is null then
    raise exception 'Submission snapshot was not frozen';
  end if;

  begin
    perform public.save_marketplace_listing_draft(
      listing_record.id, listing_record.lock_version,
      '{"quantity":2}'::jsonb
    );
    raise exception 'Expected submitted snapshot edit to fail';
  exception when serialization_failure or check_violation then null;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', '4a000000-0000-4000-8000-000000000002', true);
set local role authenticated;

do $$
declare
  listing_a uuid := current_setting('test.marketplace_listing_a')::uuid;
  own_listing public.marketplace_listings;
  category_id uuid;
begin
  if exists (select 1 from public.marketplace_listings where id = listing_a)
    or exists (select 1 from public.marketplace_listing_versions where listing_id = listing_a)
    or exists (select 1 from public.marketplace_listing_images where listing_id = listing_a)
    or exists (select 1 from storage.objects where bucket_id = 'marketplace-listing-images')
  then
    raise exception 'Partner B can read Partner A listing or images';
  end if;
  select id into strict category_id from public.categories where slug = 'stand-bag';
  own_listing := public.create_marketplace_listing(category_id);
  own_listing := public.save_marketplace_listing_draft(
    own_listing.id, own_listing.lock_version, '{"quantity":25}'::jsonb
  );
  if (select quantity_on_hand from public.marketplace_listing_inventory
      where listing_id = own_listing.id) <> 25
  then
    raise exception 'Multi-unit Marketplace inventory failed';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', '4a000000-0000-4000-8000-000000000003', true);
set local role authenticated;

do $$
begin
  begin
    perform public.create_marketplace_listing(gen_random_uuid());
    raise exception 'Expected non-verified Partner create to fail';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', '4a000000-0000-4000-8000-000000000004', true);
set local role authenticated;

do $$
begin
  begin
    perform public.create_marketplace_listing(gen_random_uuid());
    raise exception 'Expected Golfer listing create to fail';
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from public.marketplace_listings)
    or exists (select 1 from public.marketplace_listing_review_requests)
  then
    raise exception 'Golfer can read Marketplace private data';
  end if;
end;
$$;

reset role;
set local role anon;
do $$
begin
  begin
    perform 1 from public.marketplace_listings;
    raise exception 'Anonymous can read Marketplace listings';
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from storage.objects where bucket_id = 'marketplace-listing-images') then
    raise exception 'Anonymous can read private listing images';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', '4a000000-0000-4000-8000-000000000005', true);
set local role authenticated;

do $$
declare
  listing_record public.marketplace_listings;
  version_record public.marketplace_listing_versions;
  old_version_id uuid;
  titleist_id uuid;
  model_record public.catalog_product_models;
  internal_comment_id uuid;
begin
  if not public.can_manage_marketplace_listings()
    or public.can_manage_marketplace_configuration()
  then
    raise exception 'Operator Marketplace capabilities are incorrect';
  end if;
  select * into strict listing_record from public.marketplace_listings
  where id = current_setting('test.marketplace_listing_a')::uuid;
  select * into strict version_record from public.marketplace_listing_versions
  where id = listing_record.current_version_id;
  old_version_id := version_record.id;
  select id into strict titleist_id from public.brands order by name limit 1;

  model_record := public.resolve_marketplace_listing_product(
    listing_record.id, listing_record.lock_version, null, titleist_id,
    'GT3', 'Resolved proposal against canonical taxonomy'
  );
  select * into strict listing_record from public.marketplace_listings
  where id = listing_record.id;
  listing_record := public.transition_marketplace_listing_status(
    listing_record.id, listing_record.lock_version, 'UNDER_REVIEW',
    'Operations started human review', '[]'::jsonb, null
  );
  listing_record := public.transition_marketplace_listing_status(
    listing_record.id, listing_record.lock_version, 'CHANGES_REQUESTED',
    'Crown photo needs better lighting',
    '[{"area":"PHOTOS","comment":"Reemplaza la foto de la corona con mejor luz."}]'::jsonb,
    'Internal fraud-safe note not visible to Partner'
  );

  select id into strict internal_comment_id
  from public.marketplace_listing_review_requests
  where listing_id = listing_record.id and visibility = 'INTERNAL';
  perform set_config('test.marketplace_internal_comment', internal_comment_id::text, true);

  if listing_record.status <> 'CHANGES_REQUESTED'
    or listing_record.current_version_id = old_version_id
    or (select version_number from public.marketplace_listing_versions
        where id = listing_record.current_version_id) <> 2
    or (select count(*) from public.marketplace_listing_version_images
        where version_id = listing_record.current_version_id) <> 3
  then
    raise exception 'Changes requested did not create a new editable version';
  end if;

  begin
    update public.marketplace_listing_versions
    set title = 'Tampered submitted title' where id = old_version_id;
    raise exception 'Expected submitted version immutability';
  exception when insufficient_privilege or object_not_in_prerequisite_state then null;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', '4a000000-0000-4000-8000-000000000001', true);
set local role authenticated;

do $$
declare listing_record public.marketplace_listings;
begin
  select * into strict listing_record from public.marketplace_listings
  where id = current_setting('test.marketplace_listing_a')::uuid;
  if not exists (
      select 1 from public.marketplace_listing_review_requests
      where listing_id = listing_record.id and visibility = 'PARTNER_VISIBLE'
    )
    or exists (
      select 1 from public.marketplace_listing_review_requests
      where id = current_setting('test.marketplace_internal_comment')::uuid
    )
  then
    raise exception 'Partner-visible/internal review feedback isolation failed';
  end if;
  listing_record := public.save_marketplace_listing_draft(
    listing_record.id, listing_record.lock_version,
    '{"conditionNotes":"Marcas menores; nueva foto confirma la corona sin daño."}'::jsonb
  );
  listing_record := public.submit_marketplace_listing(
    listing_record.id, listing_record.lock_version
  );
  if listing_record.status <> 'SUBMITTED' then
    raise exception 'Partner could not resubmit corrected version';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', '4a000000-0000-4000-8000-000000000005', true);
set local role authenticated;

do $$
declare listing_record public.marketplace_listings;
begin
  select * into strict listing_record from public.marketplace_listings
  where id = current_setting('test.marketplace_listing_a')::uuid;
  listing_record := public.transition_marketplace_listing_status(
    listing_record.id, listing_record.lock_version, 'UNDER_REVIEW',
    'Operations reviewed corrected version', '[]'::jsonb, null
  );
  listing_record := public.transition_marketplace_listing_status(
    listing_record.id, listing_record.lock_version, 'APPROVED',
    'Corrected version approved for future publication', '[]'::jsonb, null
  );
  if listing_record.status <> 'APPROVED'
    or listing_record.approved_version_id is null
    or listing_record.approved_at is null
    or (select state from public.marketplace_listing_versions
        where id = listing_record.approved_version_id) <> 'APPROVED'
  then
    raise exception 'Approved snapshot did not become immutable and explicit';
  end if;
  if exists (
    select 1 from public.marketplace_listings
    where id = listing_record.id and status = 'PUBLISHED'
  ) then
    raise exception 'Approval accidentally published a listing';
  end if;
end;
$$;

reset role;

do $$
begin
  begin
    insert into public.marketplace_listing_inventory (
      listing_id, quantity_on_hand, quantity_reserved
    ) values (current_setting('test.marketplace_listing_a')::uuid, 1, 2);
    raise exception 'Expected reserved > on hand constraint';
  exception when unique_violation or check_violation then null;
  end;

  if not exists (
    select 1 from public.audit_logs
    where entity_id = current_setting('test.marketplace_listing_a')::uuid
      and action = 'marketplace.listing_approved'
  ) or exists (
    select 1 from public.audit_logs
    where entity_id = current_setting('test.marketplace_listing_a')::uuid
      and metadata::text ilike '%serial%'
  ) then
    raise exception 'Marketplace listing audit is missing or leaked serial data';
  end if;
end;
$$;

rollback;
