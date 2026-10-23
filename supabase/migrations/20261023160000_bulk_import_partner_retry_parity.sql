-- PR84 corrective 11: shared retry/counter/manual-model safety for Partner execution.\n-- PR84 corrective 3: qualify the Partner executor variables so PL/pgSQL
-- cannot confuse them with marketplace table columns (SQLSTATE 42702).
create or replace function public.execute_partner_bulk_import(requested_job_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_job record; v_row record; v_model record; v_listing record;
  v_version_id uuid; v_inventory_id uuid; v_payload jsonb; v_pricing jsonb;
  v_condition public.product_condition; v_category_id uuid; v_brand_id uuid;
  v_title text; v_quantity integer; v_imported integer := 0; v_skipped integer := 0;
  v_failed integer := 0; v_failure_category text; v_aggregate_status text; v_aggregate_imported integer; v_aggregate_skipped integer; v_aggregate_failed integer; v_errors jsonb := '[]'::jsonb; v_next_status text;
begin
  if not public.can_manage_catalog() then
    raise exception 'Partner bulk import execution is not authorized' using errcode = '42501';
  end if;
  select bj.* into v_job from public.bulk_import_jobs bj where bj.id = requested_job_id for update;
  if not found then raise exception 'Bulk import job not found' using errcode = 'P0002'; end if;
  if v_job.import_type <> 'PARTNER' then raise exception 'First Party jobs cannot use the Partner executor' using errcode = '42501'; end if;
  if v_job.partner_profile_id is null then raise exception 'Partner profile is required' using errcode = '22023'; end if;
  if v_job.status = 'IMPORTED' then
    return jsonb_build_object('status',v_job.status,'imported',coalesce(v_job.imported_count,0),'skipped',coalesce(v_job.skipped_count,0),'failed',coalesce(v_job.failed_import_count,0));
  end if;
  if v_job.status not in ('APPROVED_FOR_IMPORT','PARTIALLY_IMPORTED','FAILED_IMPORT') then raise exception 'Bulk import job is not approved' using errcode = '22023'; end if;
  update public.bulk_import_jobs bj set status='IMPORTING', executed_by=auth.uid() where bj.id=requested_job_id;
  insert into public.bulk_import_job_events(job_id,event_type,metadata) values(requested_job_id,'IMPORT_STARTED',jsonb_build_object('actorId',auth.uid(),'domainType','PARTNER_LISTING'));
  for v_row in select bir.* from public.bulk_import_rows bir where bir.job_id=requested_job_id and not bir.excluded and coalesce(bir.execution_status,'PENDING_IMPORT') in ('PENDING_IMPORT','FAILED') order by bir.row_number loop
    v_failure_category := null;
    begin
      update public.bulk_import_rows bir set execution_status='IMPORTING', execution_error=null where bir.id=v_row.id;
      insert into public.bulk_import_job_events(job_id,event_type,metadata) values(requested_job_id,'ROW_IMPORT_STARTED',jsonb_build_object('rowId',v_row.id,'domainType','PARTNER_LISTING'));
      if v_row.external_id is null or btrim(v_row.external_id)='' then raise exception 'Missing external id' using errcode='22023'; end if;
      if exists (select 1 from public.bulk_import_partner_execution_links bel where bel.partner_profile_id=v_job.partner_profile_id and bel.external_id=btrim(v_row.external_id)) then
        update public.bulk_import_rows bir set execution_status='SKIPPED_EXISTING', execution_error='El ID externo ya tiene un borrador para este Partner.', executed_at=now() where bir.id=v_row.id;
        v_skipped:=v_skipped+1;
        insert into public.bulk_import_job_events(job_id,event_type,metadata) values(requested_job_id,'ROW_SKIPPED',jsonb_build_object('rowId',v_row.id,'reason','EXTERNAL_ID_EXISTS','domainType','PARTNER_LISTING'));
        continue;
      end if;
      v_payload:=coalesce(v_row.normalized_payload,'{}'::jsonb); v_pricing:=coalesce(v_row.pricing_result,'{}'::jsonb);
      v_failure_category := 'PRICING_REVIEW_REQUIRED';
      if coalesce((v_pricing->>'stale')::boolean,false) or (coalesce(v_pricing->>'status','') not in ('COMPETITIVE','OVERPRICED','UNDERPRICED') and not (coalesce(v_pricing->>'status','')='INSUFFICIENT_DATA' and coalesce((v_pricing->>'manualPriceApproved')::boolean,false) and coalesce(v_pricing->>'humanReviewStatus','')='APPROVED')) then raise exception 'Marketplace pricing review required' using errcode='22023'; end if;
      if coalesce(nullif(v_pricing->>'approvedPriceMinor','')::numeric,0)<=0 and coalesce(nullif(v_pricing->>'proposedPriceMinor','')::numeric,0)<=0 and coalesce(nullif(v_pricing->>'calculatedPublicPriceMinor','')::numeric,0)<=0 then raise exception 'Marketplace price is unavailable' using errcode='22023'; end if;
      v_failure_category := 'MARKETPLACE_ECONOMICS_INVALID';
      if coalesce(v_pricing->'economics'->>'publicPriceMinor', '') = ''
         or coalesce(nullif(v_pricing->'economics'->>'partnerNetMinor','')::numeric, 0) <= 0
         or coalesce(nullif(v_pricing->'economics'->>'commissionMinor','')::numeric, -1) < 0
         or coalesce(nullif(v_pricing->'economics'->>'commissionVatMinor','')::numeric, -1) < 0
         or coalesce(nullif(v_pricing->'economics'->>'processingTotalMinor','')::numeric, -1) < 0
         or coalesce(nullif(v_pricing->'economics'->>'adminPercentageFeeMinor','')::numeric, -1) < 0
         or coalesce(nullif(v_pricing->'economics'->>'adminFixedFeeMinor','')::numeric, -1) < 0
         or coalesce(nullif(v_pricing->'economics'->>'estimatedBestRoundRevenueMinor','')::numeric, -1) < 0
         or coalesce(v_pricing->'economics'->>'meetsMinimumMarketplaceRevenue', 'true') = 'false' then
        raise exception 'Marketplace economics are invalid' using errcode='22023';
      end if;
      v_failure_category := 'MANUAL_MODEL_APPROVAL_REQUIRED';
      if v_row.canonical_model_id is null and not (
        coalesce(v_row.manual_resolution->'model'->>'approved','false') = 'true'
        and nullif(btrim(v_row.manual_resolution->'model'->>'brand'),'') is not null
        and nullif(btrim(v_row.manual_resolution->'model'->>'model'),'') is not null
        and lower(btrim(v_row.manual_resolution->'model'->>'brand')) = lower(btrim(v_payload->>'brand'))
        and lower(btrim(v_row.manual_resolution->'model'->>'model')) = lower(btrim(v_payload->>'model'))
        and (nullif(v_row.manual_resolution->'model'->>'modelYear','') is null or nullif(v_payload->>'modelYear','') is null or v_row.manual_resolution->'model'->>'modelYear' = v_payload->>'modelYear')
      ) then
        raise exception 'Manual model approval is required' using errcode='22023';
      end if;
      v_failure_category := 'CATALOG_REFERENCE_UNAVAILABLE';
      select m.id,m.brand_id,m.category_id,m.model_name into v_model from public.catalog_product_models m where m.id=v_row.canonical_model_id and m.status='active';
      if found then v_brand_id:=v_model.brand_id; v_category_id:=v_model.category_id; v_title:=v_model.model_name;
      else
        select b.id into v_brand_id from public.brands b where lower(b.name)=lower(v_payload->>'brand') and b.status='active' limit 1;
        select c.id into v_category_id from public.categories c where lower(c.slug)=lower(v_payload->>'categorySlug') and c.status='active' limit 1;
        v_title:=nullif(btrim(v_payload->>'model'),'');
        if v_brand_id is null or v_category_id is null or v_title is null then raise exception 'Catalog reference is unavailable' using errcode='22023'; end if;
      end if;
      v_failure_category := 'INVALID_QUANTITY';
      v_quantity:=coalesce(nullif(v_payload->>'quantity','')::integer,1);
      if v_quantity<=0 then raise exception 'Quantity must be positive' using errcode='22023'; end if;
      v_condition:=coalesce(nullif(v_payload->>'condition','')::public.product_condition,'used'::public.product_condition);
      v_version_id:=gen_random_uuid(); v_inventory_id:=gen_random_uuid();
      v_failure_category := 'LISTING_CREATION_FAILED';
      insert into public.marketplace_listings(partner_id,status) values(v_job.partner_profile_id,'DRAFT') returning * into v_listing;
      insert into public.marketplace_listing_versions(id,listing_id,version_number,state,canonical_model_id,brand_id,category_id,proposed_brand,proposed_model,title,description,condition,condition_grade,condition_notes,specifications,quantity,created_by)
      values(v_version_id,v_listing.id,1,'DRAFT',v_row.canonical_model_id,v_brand_id,v_category_id,v_payload->>'brand',v_payload->>'model',left(v_title,180),nullif(v_payload->>'notes',''),v_condition,case when v_condition='used' then 'good'::public.product_condition_grade else null end,case when v_condition='used' then nullif(v_payload->>'notes','') else null end,v_payload,v_quantity,auth.uid());
      update public.marketplace_listings ml set current_version_id=v_version_id where ml.id=v_listing.id returning ml.* into v_listing;
      v_failure_category := 'INVENTORY_INITIALIZATION_FAILED';
      insert into public.marketplace_listing_inventory(id,listing_id,quantity_on_hand) values(v_inventory_id,v_listing.id,v_quantity);
      insert into public.marketplace_listing_inventory_movements(inventory_id,listing_version_id,movement_type,quantity_on_hand_delta,quantity_reserved_delta,quantity_on_hand_after,quantity_reserved_after,actor_id,reason)
      values(v_inventory_id,v_version_id,'INITIAL',v_quantity,0,v_quantity,0,auth.uid(),'Partner bulk import draft initialized');
      insert into public.marketplace_listing_status_history(listing_id,listing_version_id,from_status,to_status,actor_id,reason,lock_version)
      values(v_listing.id,v_version_id,null,'DRAFT',auth.uid(),'Partner bulk import draft created',v_listing.lock_version);
      v_failure_category := 'EXECUTION_LINK_FAILED';
      insert into public.bulk_import_partner_execution_links(job_id,row_id,partner_profile_id,external_id,marketplace_listing_id,marketplace_listing_version_id,marketplace_inventory_id,pricing_snapshot)
      values(requested_job_id,v_row.id,v_job.partner_profile_id,btrim(v_row.external_id),v_listing.id,v_version_id,v_inventory_id,v_pricing);
      update public.bulk_import_rows bir set execution_status='IMPORTED',marketplace_listing_id=v_listing.id,marketplace_listing_version_id=v_version_id,marketplace_inventory_id=v_inventory_id,marketplace_pricing_snapshot=v_pricing,executed_at=now() where bir.id=v_row.id;
      v_imported:=v_imported+1;
      insert into public.bulk_import_job_events(job_id,event_type,metadata) values(requested_job_id,'ROW_IMPORTED',jsonb_build_object('rowId',v_row.id,'listingId',v_listing.id,'listingVersionId',v_version_id,'inventoryId',v_inventory_id,'domainType','PARTNER_LISTING'));
    exception when others then
      v_failed:=v_failed+1;
      update public.bulk_import_rows bir set execution_status='FAILED',execution_error=case when v_failure_category='MARKETPLACE_ECONOMICS_INVALID' then 'La economía Marketplace de esta fila no es válida.' when v_failure_category='MANUAL_MODEL_APPROVAL_REQUIRED' then 'El modelo manual debe aprobarse antes de crear el borrador.' when v_failure_category='INVALID_QUANTITY' then 'La cantidad debe ser mayor que cero.' when v_failure_category='CATALOG_REFERENCE_UNAVAILABLE' then 'No se encontró la referencia de catálogo.' when sqlstate='42702' then 'No pudimos crear el borrador por un error interno de datos.' else 'No se pudo crear el borrador de publicación para esta fila.' end,executed_at=now() where bir.id=v_row.id;
      v_errors:=v_errors||jsonb_build_array(jsonb_build_object('rowId',v_row.id,'code',sqlstate,'category',coalesce(v_failure_category,'ROW_IMPORT_FAILED')));
      insert into public.bulk_import_job_events(job_id,event_type,metadata) values(requested_job_id,'ROW_IMPORT_FAILED',jsonb_build_object('rowId',v_row.id,'code',sqlstate,'category',coalesce(v_failure_category,'ROW_IMPORT_FAILED'),'domainType','PARTNER_LISTING'));
    end;
  end loop;
  perform public.reconcile_bulk_import_job_aggregate(requested_job_id);
  select bj.status,bj.imported_count,bj.skipped_count,bj.failed_import_count into v_aggregate_status,v_aggregate_imported,v_aggregate_skipped,v_aggregate_failed from public.bulk_import_jobs bj where bj.id=requested_job_id;
  v_next_status:=v_aggregate_status;
  insert into public.bulk_import_job_events(job_id,event_type,metadata) values(requested_job_id,case when v_aggregate_failed=0 then 'IMPORT_COMPLETED' when v_aggregate_imported=0 then 'IMPORT_FAILED' else 'IMPORT_PARTIALLY_COMPLETED' end,jsonb_build_object('imported',v_aggregate_imported,'skipped',v_aggregate_skipped,'failed',v_aggregate_failed,'thisAttemptImported',v_imported,'thisAttemptSkipped',v_skipped,'thisAttemptFailed',v_failed,'domainType','PARTNER_LISTING'));
  return jsonb_build_object('status',v_next_status,'imported',v_aggregate_imported,'skipped',v_aggregate_skipped,'failed',v_aggregate_failed,'attemptImported',v_imported,'attemptSkipped',v_skipped,'attemptFailed',v_failed,'errors',v_errors);
end;
$$;
revoke all on function public.execute_partner_bulk_import(uuid) from public, anon;
grant execute on function public.execute_partner_bulk_import(uuid) to authenticated;
