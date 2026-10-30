begin;

insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('7a000000-0000-4000-8000-000000000001','authenticated','authenticated','model-archive-operator@example.test','{}','{}',now(),now()),
 ('7a000000-0000-4000-8000-000000000002','authenticated','authenticated','model-archive-buyer@example.test','{}','{}',now(),now());
insert into public.user_roles(user_id,role_id)
select '7a000000-0000-4000-8000-000000000001',id from public.roles where name='operator';
insert into public.partner_profiles(id,user_id,legal_type,status,verified_at)
values('7b000000-0000-4000-8000-000000000001','7a000000-0000-4000-8000-000000000002','INDIVIDUAL','VERIFIED',now());

do $$
declare brand_id uuid; category_id uuid; model_id uuid; untouched_model_id uuid;
  original_updated_at timestamptz; listing_id uuid:=gen_random_uuid(); version_id uuid:=gen_random_uuid();
  archived public.catalog_product_models;
begin
  select id into strict brand_id from public.brands where status='active' order by name limit 1;
  select id into strict category_id from public.categories where status='active' order by name limit 1;
  insert into public.catalog_product_models(brand_id,category_id,model_name,normalized_model_name)
  values(brand_id,category_id,'Archive Lifecycle Fixture','archive-lifecycle-fixture') returning id,updated_at into model_id,original_updated_at;
  insert into public.catalog_product_models(brand_id,category_id,model_name,normalized_model_name)
  values(brand_id,category_id,'Archive Lifecycle Unchanged','archive-lifecycle-unchanged') returning id into untouched_model_id;
  insert into public.marketplace_listings(id,partner_id,status,lock_version)
  values(listing_id,'7b000000-0000-4000-8000-000000000001','DRAFT',1);
  insert into public.marketplace_listing_versions(id,listing_id,version_number,state,canonical_model_id,category_id,title,description,condition,condition_grade,condition_notes,defects_acknowledged,specifications,declared_defects,accessories_included,quantity,fulfillment,custody,created_by)
  values(version_id,listing_id,1,'DRAFT',model_id,category_id,'Historical fixture','Fixture','used','good','Fixture',true,'{}','[]','[]',1,'PARTNER_FULFILLED','PARTNER_CUSTODY','7a000000-0000-4000-8000-000000000001');

  perform set_config('request.jwt.claim.sub','7a000000-0000-4000-8000-000000000002',true);
  begin
    perform public.archive_catalog_product_model(model_id,original_updated_at,'test unauthorized');
    raise exception 'buyer unexpectedly archived model';
  exception when insufficient_privilege then null; end;

  begin
    execute 'set local role anon';
    perform public.archive_catalog_product_model(model_id,original_updated_at,'test anonymous');
    raise exception 'anon unexpectedly archived model';
  exception when insufficient_privilege then null; end;
  execute 'reset role';

  -- Partner identity is authenticated but has no catalog role.
  perform set_config('request.jwt.claim.sub','7a000000-0000-4000-8000-000000000002',true);
  begin
    perform public.archive_catalog_product_model(model_id,original_updated_at,'test partner');
    raise exception 'Partner unexpectedly archived model';
  exception when insufficient_privilege then null; end;
  if (select status from public.catalog_product_models where id=model_id)<>'active' then
    raise exception 'unauthorized attempt changed model'; end if;

  perform set_config('request.jwt.claim.sub','7a000000-0000-4000-8000-000000000001',true);
  begin
    perform public.archive_catalog_product_model(gen_random_uuid(),now(),'test missing');
    raise exception 'missing model unexpectedly archived';
  exception when no_data_found then null; end;
  begin
    perform public.archive_catalog_product_model(model_id,original_updated_at + interval '1 second','test stale');
    raise exception 'stale model unexpectedly archived';
  exception when serialization_failure then null; end;

  archived:=public.archive_catalog_product_model(model_id,original_updated_at,'PR88 fixture test');
  if archived.status<>'archived' or archived.lifecycle_status<>'CURRENT' then
    raise exception 'archive changed wrong model fields'; end if;
  archived:=public.archive_catalog_product_model(model_id,archived.updated_at,'PR88 fixture test replay');
  if archived.status<>'archived' then raise exception 'archive replay failed'; end if;
  if not exists(select 1 from public.marketplace_listing_versions where id=version_id and canonical_model_id=model_id)
    then raise exception 'historical model reference was lost'; end if;
  if not exists(select 1 from public.audit_logs where entity_id=model_id and action='catalog.model_archived')
    then raise exception 'archive audit record missing'; end if;
  if (select status from public.catalog_product_models where id=untouched_model_id)<>'active'
    then raise exception 'unrelated active model changed'; end if;
  if has_table_privilege('authenticated','public.catalog_product_models','UPDATE')
    then raise exception 'authenticated role gained direct model update'; end if;
  if has_function_privilege('anon','public.archive_catalog_product_model(uuid,timestamp with time zone,text)','EXECUTE')
    then raise exception 'anon has archive RPC execute'; end if;
end $$;

rollback;
