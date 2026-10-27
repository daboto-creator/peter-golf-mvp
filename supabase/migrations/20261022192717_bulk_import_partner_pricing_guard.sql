-- PR84 corrective: allow an auditable manual Partner price approval when
-- market research is insufficient, while retaining deterministic economics
-- validation in the execution RPC.
create or replace function public.execute_partner_bulk_import(requested_job_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  job record; row record; model record; listing record; version_id uuid;
  inventory_id uuid; payload jsonb; pricing jsonb; condition public.product_condition;
  category_id uuid; brand_id uuid; title text; quantity integer;
  imported integer := 0; skipped integer := 0; failed integer := 0; errors jsonb := '[]'::jsonb;
  next_status text;
begin
  if not public.can_manage_catalog() then
    raise exception 'Partner bulk import execution is not authorized' using errcode = '42501';
  end if;
  select * into job from public.bulk_import_jobs where id = requested_job_id for update;
  if not found then raise exception 'Bulk import job not found' using errcode = 'P0002'; end if;
  if job.import_type <> 'PARTNER' then raise exception 'First Party jobs cannot use the Partner executor' using errcode = '42501'; end if;
  if job.partner_profile_id is null then raise exception 'Partner profile is required' using errcode = '22023'; end if;
  if job.status in ('IMPORTING','IMPORTED') then
    return jsonb_build_object('status',job.status,'imported',coalesce(job.imported_count,0),'skipped',coalesce(job.skipped_count,0),'failed',coalesce(job.failed_import_count,0));
  end if;
  if job.status not in ('APPROVED_FOR_IMPORT','FAILED_IMPORT') then raise exception 'Bulk import job is not approved' using errcode = '22023'; end if;
  update public.bulk_import_jobs set status = 'IMPORTING', executed_by = auth.uid() where id = requested_job_id;
  insert into public.bulk_import_job_events(job_id,event_type,metadata) values (requested_job_id,'IMPORT_STARTED',jsonb_build_object('actorId',auth.uid(),'domainType','PARTNER_LISTING'));
  for row in select * from public.bulk_import_rows where job_id = requested_job_id and not excluded and coalesce(execution_status,'PENDING_IMPORT') in ('PENDING_IMPORT','FAILED') order by row_number loop
    begin
      update public.bulk_import_rows set execution_status='IMPORTING', execution_error=null where id=row.id;
      insert into public.bulk_import_job_events(job_id,event_type,metadata) values (requested_job_id,'ROW_IMPORT_STARTED',jsonb_build_object('rowId',row.id,'domainType','PARTNER_LISTING'));
      if row.external_id is null or btrim(row.external_id) = '' then raise exception 'Missing external id' using errcode='22023'; end if;
      if exists (select 1 from public.bulk_import_partner_execution_links where partner_profile_id=job.partner_profile_id and external_id=btrim(row.external_id)) then
        update public.bulk_import_rows set execution_status='SKIPPED_EXISTING', execution_error='El ID externo ya tiene un borrador para este Partner.', executed_at=now() where id=row.id;
        skipped := skipped + 1;
        insert into public.bulk_import_job_events(job_id,event_type,metadata) values (requested_job_id,'ROW_SKIPPED',jsonb_build_object('rowId',row.id,'reason','EXTERNAL_ID_EXISTS','domainType','PARTNER_LISTING'));
        continue;
      end if;
      payload := row.normalized_payload; pricing := row.pricing_result;
      if coalesce((pricing->>'stale')::boolean,false) or (coalesce(pricing->>'status','') not in ('COMPETITIVE','OVERPRICED','UNDERPRICED') and not (coalesce(pricing->>'status','')='INSUFFICIENT_DATA' and coalesce((pricing->>'manualPriceApproved')::boolean,false))) then raise exception 'Marketplace pricing review required' using errcode='22023'; end if;
      if coalesce(nullif(pricing->>'approvedPriceMinor','')::numeric,0) <= 0 and coalesce(nullif(pricing->>'proposedPriceMinor','')::numeric,0) <= 0 and coalesce(nullif(pricing->>'calculatedPublicPriceMinor','')::numeric,0) <= 0 then raise exception 'Marketplace price is unavailable' using errcode='22023'; end if;
      select m.id,m.brand_id,m.category_id,m.model_name into model from public.catalog_product_models m where m.id=row.canonical_model_id and m.status='active';
      if found then brand_id:=model.brand_id; category_id:=model.category_id; title:=model.model_name;
      else
        select b.id into brand_id from public.brands b where lower(b.name)=lower(payload->>'brand') and b.status='active' limit 1;
        select c.id into category_id from public.categories c where lower(c.slug)=lower(payload->>'categorySlug') and c.status='active' limit 1;
        title:=nullif(btrim(payload->>'model'),'');
        if brand_id is null or category_id is null or title is null then raise exception 'Catalog reference is unavailable' using errcode='22023'; end if;
      end if;
      quantity:=coalesce(nullif(payload->>'quantity','')::integer,1);
      if quantity <= 0 then raise exception 'Quantity must be positive' using errcode='22023'; end if;
      condition:=coalesce(nullif(payload->>'condition','')::public.product_condition,'used'::public.product_condition);
      version_id:=gen_random_uuid(); inventory_id:=gen_random_uuid();
      insert into public.marketplace_listings(partner_id,status) values(job.partner_profile_id,'DRAFT') returning * into listing;
      insert into public.marketplace_listing_versions(id,listing_id,version_number,state,canonical_model_id,brand_id,category_id,proposed_brand,proposed_model,title,description,condition,condition_grade,condition_notes,specifications,quantity,created_by)
      values(version_id,listing.id,1,'DRAFT',row.canonical_model_id,brand_id,category_id,payload->>'brand',payload->>'model',left(title,180),nullif(payload->>'notes',''),condition,case when condition='used' then 'good'::public.product_condition_grade else null end,case when condition='used' then nullif(payload->>'notes','') else null end,payload,quantity,auth.uid());
      update public.marketplace_listings set current_version_id=version_id where id=listing.id returning * into listing;
      insert into public.marketplace_listing_inventory(id,listing_id,quantity_on_hand) values(inventory_id,listing.id,quantity);
      insert into public.marketplace_listing_inventory_movements(inventory_id,listing_version_id,movement_type,quantity_on_hand_delta,quantity_reserved_delta,quantity_on_hand_after,quantity_reserved_after,actor_id,reason)
      values(inventory_id,version_id,'INITIAL',quantity,0,quantity,0,auth.uid(),'Partner bulk import draft initialized');
      insert into public.marketplace_listing_status_history(listing_id,listing_version_id,from_status,to_status,actor_id,reason,lock_version)
      values(listing.id,version_id,null,'DRAFT',auth.uid(),'Partner bulk import draft created',listing.lock_version);
      insert into public.bulk_import_partner_execution_links(job_id,row_id,partner_profile_id,external_id,marketplace_listing_id,marketplace_listing_version_id,marketplace_inventory_id,pricing_snapshot)
      values(requested_job_id,row.id,job.partner_profile_id,btrim(row.external_id),listing.id,version_id,inventory_id,pricing);
      update public.bulk_import_rows set execution_status='IMPORTED',marketplace_listing_id=listing.id,marketplace_listing_version_id=version_id,marketplace_inventory_id=inventory_id,marketplace_pricing_snapshot=pricing,executed_at=now() where id=row.id;
      imported:=imported+1;
      insert into public.bulk_import_job_events(job_id,event_type,metadata) values(requested_job_id,'ROW_IMPORTED',jsonb_build_object('rowId',row.id,'listingId',listing.id,'listingVersionId',version_id,'inventoryId',inventory_id,'domainType','PARTNER_LISTING'));
    exception when others then
      failed:=failed+1;
      update public.bulk_import_rows set execution_status='FAILED',execution_error=case when sqlstate='22023' then 'La fila requiere revisión antes de crear el borrador.' else 'No se pudo crear el borrador de publicación para esta fila.' end,executed_at=now() where id=row.id;
      errors:=errors||jsonb_build_array(jsonb_build_object('rowId',row.id,'code',sqlstate));
      insert into public.bulk_import_job_events(job_id,event_type,metadata) values(requested_job_id,'ROW_IMPORT_FAILED',jsonb_build_object('rowId',row.id,'code',sqlstate,'domainType','PARTNER_LISTING'));
    end;
  end loop;
  next_status:=case when failed=0 then 'IMPORTED' when imported=0 then 'FAILED_IMPORT' else 'PARTIALLY_IMPORTED' end;
  update public.bulk_import_jobs set status=next_status,imported_count=imported,skipped_count=skipped,failed_import_count=failed,executed_at=now() where id=requested_job_id;
  insert into public.bulk_import_job_events(job_id,event_type,metadata) values(requested_job_id,case when failed=0 then 'IMPORT_COMPLETED' when imported=0 then 'IMPORT_FAILED' else 'IMPORT_PARTIALLY_COMPLETED' end,jsonb_build_object('imported',imported,'skipped',skipped,'failed',failed,'domainType','PARTNER_LISTING'));
  return jsonb_build_object('status',next_status,'imported',imported,'skipped',skipped,'failed',failed,'errors',errors);
end;
$$;
revoke all on function public.execute_partner_bulk_import(uuid) from public, anon;
grant execute on function public.execute_partner_bulk_import(uuid) to authenticated;
