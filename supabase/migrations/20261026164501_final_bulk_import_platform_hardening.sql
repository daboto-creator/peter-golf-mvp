-- PR84 corrective 13: final shared-platform hardening.
-- This additive migration changes executable policy only; it does not rewrite
-- historical bulk-import rows or completed jobs.

create or replace function public.reconcile_bulk_import_job_aggregate(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_imported integer;
  v_skipped integer;
  v_failed integer;
  v_included integer;
begin
  select count(*) filter (where not bir.excluded and bir.execution_status = 'IMPORTED'),
         count(*) filter (where not bir.excluded and bir.execution_status = 'SKIPPED_EXISTING'),
         count(*) filter (where not bir.excluded and bir.execution_status = 'FAILED'),
         count(*) filter (where not bir.excluded)
    into v_imported, v_skipped, v_failed, v_included
    from public.bulk_import_rows bir
   where bir.job_id = p_job_id;

  update public.bulk_import_jobs bj
     set imported_count = v_imported,
         skipped_count = v_skipped,
         failed_import_count = v_failed,
         status = case
           when v_failed = 0 and v_imported + v_skipped >= v_included then 'IMPORTED'
           when v_imported = 0 and v_failed > 0 then 'FAILED_IMPORT'
           else 'PARTIALLY_IMPORTED'
         end,
         updated_at = now()
   where bj.id = p_job_id;
end;
$$;

create or replace function public.bulk_import_job_aggregate_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_imported integer;
  v_skipped integer;
  v_failed integer;
  v_included integer;
begin
  if new.status in ('IMPORTED','PARTIALLY_IMPORTED','FAILED_IMPORT')
     and not (old.status = 'PARTIALLY_IMPORTED' and new.status = 'FAILED_IMPORT') then
    select count(*) filter (where not bir.excluded and bir.execution_status = 'IMPORTED'),
           count(*) filter (where not bir.excluded and bir.execution_status = 'SKIPPED_EXISTING'),
           count(*) filter (where not bir.excluded and bir.execution_status = 'FAILED'),
           count(*) filter (where not bir.excluded)
      into v_imported, v_skipped, v_failed, v_included
      from public.bulk_import_rows bir
     where bir.job_id = new.id;
    new.imported_count := v_imported;
    new.skipped_count := v_skipped;
    new.failed_import_count := v_failed;
    if old.status = 'IMPORTING' or old.status = 'APPROVED_FOR_IMPORT' then
      new.status := case
        when v_failed = 0 and v_imported + v_skipped >= v_included then 'IMPORTED'
        when v_imported = 0 and v_failed > 0 then 'FAILED_IMPORT'
        else 'PARTIALLY_IMPORTED'
      end;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.reconcile_bulk_import_job_aggregate(uuid) from public, anon, authenticated;
revoke all on function public.bulk_import_job_aggregate_before_update() from public, anon, authenticated;

create or replace function public.execute_first_party_bulk_import(requested_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  job record; row record; model record; created record; initialized record; movement record;
  current_rule record; current_fee record;
  payload jsonb; pricing jsonb; specs jsonb;
  condition public.product_condition;
  price public.money_minor_units; financial_price public.money_minor_units;
  acquisition public.money_minor_units; quantity integer;
  brand_id uuid; resolved_category_id uuid; current_rule_code text;
  product_name text; safe_external text; base_sku text; floor_reason text;
  failure_category text;
  attempt_imported integer := 0; attempt_skipped integer := 0; attempt_failed integer := 0;
  aggregate_status text; aggregate_imported integer; aggregate_skipped integer; aggregate_failed integer;
  errors jsonb := '[]'::jsonb;
begin
  if not public.can_manage_catalog() then
    raise exception 'Bulk import execution is not authorized' using errcode = '42501';
  end if;

  select * into job from public.bulk_import_jobs where id = requested_job_id for update;
  if not found then raise exception 'Bulk import job not found' using errcode = 'P0002'; end if;
  if job.import_type <> 'FIRST_PARTY' then raise exception 'Partner bulk jobs cannot be executed here' using errcode = '42501'; end if;
  if job.status = 'IMPORTED' then
    return jsonb_build_object('status',job.status,'imported',coalesce(job.imported_count,0),'skipped',coalesce(job.skipped_count,0),'failed',coalesce(job.failed_import_count,0));
  end if;
  if job.status not in ('APPROVED_FOR_IMPORT','PARTIALLY_IMPORTED','FAILED_IMPORT') then raise exception 'Bulk import job is not approved' using errcode = '22023'; end if;

  update public.bulk_import_jobs set status='IMPORTING', executed_by=auth.uid() where id=requested_job_id;
  insert into public.bulk_import_job_events(job_id,event_type,metadata)
    values(requested_job_id,'IMPORT_STARTED',jsonb_build_object('actorId',auth.uid(),'domainType','FIRST_PARTY'));

  for row in
    select bir.* from public.bulk_import_rows bir
     where bir.job_id=requested_job_id and not bir.excluded
       and coalesce(bir.execution_status,'PENDING_IMPORT') in ('PENDING_IMPORT','FAILED')
     order by bir.row_number
  loop
    failure_category := null;
    begin
      update public.bulk_import_rows set execution_status='IMPORTING',execution_error=null where id=row.id;
      insert into public.bulk_import_job_events(job_id,event_type,metadata)
        values(requested_job_id,'ROW_IMPORT_STARTED',jsonb_build_object('rowId',row.id,'domainType','FIRST_PARTY'));

      failure_category := 'INVALID_EXTERNAL_ID';
      if row.external_id is null or btrim(row.external_id)='' then raise exception 'Missing external id' using errcode='22023'; end if;
      if exists (
        select 1 from public.bulk_import_execution_links bel
         where bel.source_scope_id=job.created_by and bel.external_id=btrim(row.external_id)
      ) then
        update public.bulk_import_rows set execution_status='SKIPPED_EXISTING',executed_at=now(),execution_error='El ID externo ya fue importado.' where id=row.id;
        attempt_skipped:=attempt_skipped+1;
        insert into public.bulk_import_job_events(job_id,event_type,metadata)
          values(requested_job_id,'ROW_SKIPPED',jsonb_build_object('rowId',row.id,'reason','EXTERNAL_ID_EXISTS','domainType','FIRST_PARTY'));
        continue;
      end if;

      payload:=coalesce(row.normalized_payload,'{}'::jsonb);
      pricing:=coalesce(row.pricing_result,'{}'::jsonb);
      condition:=coalesce(nullif(payload->>'condition','')::public.product_condition,'used');

      failure_category := 'PRICING_REVIEW_REQUIRED';
      if coalesce(pricing->>'stale','false')='true' then raise exception 'Pricing review required' using errcode='22023'; end if;
      price:=coalesce(nullif(pricing->>'approvedPriceMinor','')::numeric,nullif(pricing->>'proposedPriceMinor','')::numeric,nullif(pricing->>'calculatedPublicPriceMinor','')::numeric);
      if price is null or price<=0 then raise exception 'Pricing review required' using errcode='22023'; end if;
      if coalesce(pricing->>'status','') not in ('COMPETITIVE','OVERPRICED','UNDERPRICED')
         and not (coalesce(pricing->>'manualPriceApproved','false')='true' and coalesce(pricing->>'humanReviewStatus','')='APPROVED') then
        raise exception 'Pricing review required' using errcode='22023';
      end if;

      failure_category := 'ACQUISITION_COST_REQUIRED';
      acquisition:=nullif(payload->>'acquisitionCostMinor','')::numeric;
      if acquisition is null or acquisition<=0 then raise exception 'Acquisition cost is required' using errcode='22023'; end if;

      failure_category := 'PRICING_REVIEW_REQUIRED';
      select c.id into resolved_category_id from public.categories c
       where lower(c.slug)=lower(payload->>'categorySlug') and c.status='active' limit 1;
      if resolved_category_id is null then raise exception 'Pricing configuration unavailable' using errcode='22023'; end if;
      select case when condition='new' then cpp.new_rule_code else cpp.used_rule_code end
        into current_rule_code from public.category_pricing_profiles cpp where cpp.category_id=resolved_category_id;
      select pr.* into current_rule from public.pricing_rules pr where pr.code=current_rule_code and pr.active;
      select pfc.* into current_fee from public.payment_fee_configs pfc where pfc.code='stripe_domestic_mx' and pfc.active;
      if current_rule.code is null or current_fee.code is null
         or coalesce(pricing->>'pricingRuleCode','')<>current_rule.code
         or nullif(pricing->>'targetReturnBps','')::integer is distinct from current_rule.target_return_bps
         or coalesce(pricing->>'paymentFeeConfigCode','')<>current_fee.code
         or nullif(pricing->>'paymentFeePercentageBps','')::integer is distinct from current_fee.percentage_bps
         or nullif(pricing->>'paymentFeeFixedMinor','')::numeric is distinct from current_fee.fixed_fee then
        raise exception 'Pricing configuration changed after review' using errcode='22023';
      end if;

      financial_price:=nullif(pricing->>'financialPriceMinor','')::numeric;
      if financial_price is not null and financial_price>0 and price<financial_price then
        failure_category := 'FINANCIAL_FLOOR_VIOLATION';
        floor_reason:=nullif(btrim(pricing->>'manualPriceReason'),'');
        if coalesce(pricing->>'financialFloorOverrideApproved','false')<>'true'
           or floor_reason is null or not public.can_override_pricing_floor() then
          raise exception 'Price is below the financial floor' using errcode='42501';
        end if;
      end if;

      failure_category := 'INVALID_QUANTITY';
      quantity:=coalesce(nullif(payload->>'quantity','')::integer,1);
      if quantity<=0 then raise exception 'Quantity must be positive' using errcode='22023'; end if;

      failure_category := 'MANUAL_MODEL_APPROVAL_REQUIRED';
      if row.canonical_model_id is null and not (
        coalesce(row.manual_resolution->'model'->>'approved','false')='true'
        and nullif(btrim(row.manual_resolution->'model'->>'brand'),'') is not null
        and nullif(btrim(row.manual_resolution->'model'->>'model'),'') is not null
        and lower(btrim(row.manual_resolution->'model'->>'brand'))=lower(btrim(payload->>'brand'))
        and lower(btrim(row.manual_resolution->'model'->>'model'))=lower(btrim(payload->>'model'))
        and lower(btrim(row.manual_resolution->'model'->>'category'))=lower(btrim(payload->>'category'))
        and nullif(row.manual_resolution->'model'->>'modelYear','')::integer is not distinct from nullif(payload->>'modelYear','')::integer
      ) then raise exception 'Manual model approval is required' using errcode='22023'; end if;

      select m.id,m.brand_id,m.category_id,m.model_name,b.name as brand_name into model
        from public.catalog_product_models m join public.brands b on b.id=m.brand_id
       where m.id=row.canonical_model_id and m.status='active';
      if found then brand_id:=model.brand_id; resolved_category_id:=model.category_id;
      else
        failure_category := 'CATALOG_REFERENCE_UNAVAILABLE';
        select b.id into brand_id from public.brands b where lower(b.name)=lower(payload->>'brand') and b.status='active' limit 1;
        if brand_id is null or resolved_category_id is null then raise exception 'Catalog reference is unavailable' using errcode='22023'; end if;
      end if;

      safe_external:=regexp_replace(upper(btrim(row.external_id)),'[^A-Z0-9._-]','-','g');
      base_sku:=left('BRBI-'||safe_external,76);
      product_name:=left(coalesce(model.model_name,payload->>'model',payload->>'brand'||' producto'),200);
      specs:=jsonb_build_object('clubType',replace(payload->>'categorySlug','fairway-wood','fairway_wood'),'model',coalesce(model.model_name,payload->>'model'),'modelYear',payload->>'modelYear','handedness',case payload->>'hand' when 'RIGHT' then 'right' when 'LEFT' then 'left' else '' end,'loftDegrees',payload->>'loft','bounceDegrees',payload->>'bounce','grind',payload->>'grind','shaftFlex',lower(replace(coalesce(payload->>'flex',''),'X_STIFF','x_stiff')),'shaftMaterial',lower(coalesce(payload->>'shaftMaterial','')),'headcoverIncluded',payload->>'headcover','notes',payload->>'notes');
      pricing:=pricing||jsonb_build_object('acquisitionCost',acquisition,'marketReference',pricing->>'marketReferenceMinor','marketAverage',pricing->>'marketAverageMinor','marketLow',pricing->>'marketLowMinor','marketHigh',pricing->>'marketHighMinor','marketSampleSize',coalesce(pricing->>'sampleSize','0'),'marketConfidence',case when pricing->>'marketReferenceMinor' is null then 'unavailable' else 'medium' end,'marketSource',case when pricing->>'marketReferenceMinor' is null then null else 'Bulk Import Review' end,'acquisitionChannel','purchase');

      failure_category := 'PRODUCT_CREATION_FAILED';
      select * into created from public.create_priced_golf_product_with_model_reference(
        left(lower(regexp_replace(product_name||'-'||safe_external,'[^a-zA-Z0-9]+','-','g')),160),base_sku,product_name,null,payload->>'notes',condition,
        case when condition='used' then 'good'::public.product_condition_grade else null end,
        case when condition='used' then coalesce(payload->>'notes','Importación Best Round') else null end,
        brand_id,resolved_category_id,'in_stock',price,null,'MXN',false,false,true,null,null,null,null,specs,'[]'::jsonb,pricing,row.canonical_model_id,
        case when row.canonical_model_id is null then 'USER_ENTERED' else 'RESOLVED' end);
      failure_category := 'INVENTORY_INITIALIZATION_FAILED';
      select * into initialized from public.initialize_inventory(created.variant_id);
      failure_category := 'INVENTORY_ADJUSTMENT_FAILED';
      select * into movement from public.adjust_inventory(created.variant_id,'receipt'::public.inventory_movement_type,quantity,'Bulk Import PR83',gen_random_uuid(),'bulk_import_row',row.id);
      failure_category := 'EXECUTION_LINK_FAILED';
      insert into public.bulk_import_execution_links(job_id,row_id,source_scope_id,external_id,product_id,variant_id,inventory_id)
        values(requested_job_id,row.id,job.created_by,btrim(row.external_id),created.product_id,created.variant_id,initialized.inventory_id);
      update public.bulk_import_rows set execution_status='IMPORTED',product_id=created.product_id,variant_id=created.variant_id,inventory_id=initialized.inventory_id,executed_at=now() where id=row.id;
      attempt_imported:=attempt_imported+1;
      insert into public.bulk_import_job_events(job_id,event_type,metadata)
        values(requested_job_id,'ROW_IMPORTED',jsonb_build_object('rowId',row.id,'productId',created.product_id,'inventoryId',initialized.inventory_id,'domainType','FIRST_PARTY'));
    exception when others then
      if failure_category='PRODUCT_CREATION_FAILED' and (sqlstate='42501' or lower(sqlerrm) like '%financial floor%' or lower(sqlerrm) like '%below the financial%') then failure_category:='FINANCIAL_FLOOR_VIOLATION';
      elsif failure_category='PRODUCT_CREATION_FAILED' and sqlstate='22023' then failure_category:='PRICING_APPLICATION_FAILED'; end if;
      attempt_failed:=attempt_failed+1;
      update public.bulk_import_rows set execution_status='FAILED',execution_error=case
        when failure_category='INVALID_EXTERNAL_ID' then 'Falta el ID externo.'
        when failure_category='PRICING_REVIEW_REQUIRED' then 'El precio requiere revisión y aprobación.'
        when failure_category='FINANCIAL_FLOOR_VIOLATION' then 'El precio está por debajo del mínimo financiero.'
        when failure_category='ACQUISITION_COST_REQUIRED' then 'Falta el costo de adquisición.'
        when failure_category='INVALID_QUANTITY' then 'La cantidad debe ser mayor que cero.'
        when failure_category='MANUAL_MODEL_APPROVAL_REQUIRED' then 'El modelo manual debe aprobarse antes de importar.'
        when failure_category='CATALOG_REFERENCE_UNAVAILABLE' then 'No se encontró la referencia de catálogo.'
        when failure_category='PRICING_APPLICATION_FAILED' then 'No se pudo aplicar el precio revisado.'
        when failure_category='INVENTORY_INITIALIZATION_FAILED' then 'No se pudo inicializar el inventario.'
        when failure_category='INVENTORY_ADJUSTMENT_FAILED' then 'No se pudo registrar la existencia inicial.'
        when failure_category='EXECUTION_LINK_FAILED' then 'No se pudo vincular la ejecución.'
        else 'No se pudo crear el producto e inventario para esta fila.' end,executed_at=now() where id=row.id;
      errors:=errors||jsonb_build_array(jsonb_build_object('rowId',row.id,'message','No se pudo importar la fila.','code',sqlstate,'category',coalesce(failure_category,'INTERNAL_SYSTEM_ERROR')));
      insert into public.bulk_import_job_events(job_id,event_type,metadata)
        values(requested_job_id,'ROW_IMPORT_FAILED',jsonb_build_object('rowId',row.id,'code',sqlstate,'category',coalesce(failure_category,'INTERNAL_SYSTEM_ERROR'),'domainType','FIRST_PARTY'));
    end;
  end loop;

  perform public.reconcile_bulk_import_job_aggregate(requested_job_id);
  select bj.status,bj.imported_count,bj.skipped_count,bj.failed_import_count into aggregate_status,aggregate_imported,aggregate_skipped,aggregate_failed from public.bulk_import_jobs bj where bj.id=requested_job_id;
  insert into public.bulk_import_job_events(job_id,event_type,metadata)
    values(requested_job_id,case when aggregate_failed=0 then 'IMPORT_COMPLETED' when aggregate_imported=0 then 'IMPORT_FAILED' else 'IMPORT_PARTIALLY_COMPLETED' end,jsonb_build_object('imported',aggregate_imported,'skipped',aggregate_skipped,'failed',aggregate_failed,'thisAttemptImported',attempt_imported,'thisAttemptSkipped',attempt_skipped,'thisAttemptFailed',attempt_failed,'domainType','FIRST_PARTY'));
  return jsonb_build_object('status',aggregate_status,'imported',aggregate_imported,'skipped',aggregate_skipped,'failed',aggregate_failed,'attemptImported',attempt_imported,'attemptSkipped',attempt_skipped,'attemptFailed',attempt_failed,'errors',errors);
end;
$$;

revoke all on function public.execute_first_party_bulk_import(uuid) from public, anon;
grant execute on function public.execute_first_party_bulk_import(uuid) to authenticated;

create or replace function public.execute_partner_bulk_import(requested_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job record; v_row record; v_model record; v_listing record;
  v_version_id uuid; v_inventory_id uuid; v_payload jsonb; v_pricing jsonb; v_economics jsonb;
  v_condition public.product_condition; v_category_id uuid; v_brand_id uuid;
  v_title text; v_quantity integer; v_effective_price numeric; v_partner_net numeric;
  v_imported integer:=0; v_skipped integer:=0; v_failed integer:=0;
  v_failure_category text; v_aggregate_status text; v_aggregate_imported integer; v_aggregate_skipped integer; v_aggregate_failed integer;
  v_errors jsonb:='[]'::jsonb;
begin
  if not public.can_manage_catalog() then raise exception 'Partner bulk import execution is not authorized' using errcode='42501'; end if;
  select bj.* into v_job from public.bulk_import_jobs bj where bj.id=requested_job_id for update;
  if not found then raise exception 'Bulk import job not found' using errcode='P0002'; end if;
  if v_job.import_type<>'PARTNER' then raise exception 'First Party jobs cannot use the Partner executor' using errcode='42501'; end if;
  if v_job.partner_profile_id is null then raise exception 'Partner profile is required' using errcode='22023'; end if;
  if v_job.status='IMPORTED' then return jsonb_build_object('status',v_job.status,'imported',coalesce(v_job.imported_count,0),'skipped',coalesce(v_job.skipped_count,0),'failed',coalesce(v_job.failed_import_count,0)); end if;
  if v_job.status not in ('APPROVED_FOR_IMPORT','PARTIALLY_IMPORTED','FAILED_IMPORT') then raise exception 'Bulk import job is not approved' using errcode='22023'; end if;
  update public.bulk_import_jobs bj set status='IMPORTING',executed_by=auth.uid() where bj.id=requested_job_id;
  insert into public.bulk_import_job_events(job_id,event_type,metadata) values(requested_job_id,'IMPORT_STARTED',jsonb_build_object('actorId',auth.uid(),'domainType','PARTNER_LISTING'));

  for v_row in select bir.* from public.bulk_import_rows bir where bir.job_id=requested_job_id and not bir.excluded and coalesce(bir.execution_status,'PENDING_IMPORT') in ('PENDING_IMPORT','FAILED') order by bir.row_number loop
    v_failure_category:=null;
    begin
      update public.bulk_import_rows bir set execution_status='IMPORTING',execution_error=null where bir.id=v_row.id;
      insert into public.bulk_import_job_events(job_id,event_type,metadata) values(requested_job_id,'ROW_IMPORT_STARTED',jsonb_build_object('rowId',v_row.id,'domainType','PARTNER_LISTING'));
      v_failure_category:='INVALID_EXTERNAL_ID';
      if v_row.external_id is null or btrim(v_row.external_id)='' then raise exception 'Missing external id' using errcode='22023'; end if;
      if exists(select 1 from public.bulk_import_partner_execution_links bel where bel.partner_profile_id=v_job.partner_profile_id and bel.external_id=btrim(v_row.external_id)) then
        update public.bulk_import_rows bir set execution_status='SKIPPED_EXISTING',execution_error='El ID externo ya tiene un borrador para este Partner.',executed_at=now() where bir.id=v_row.id;
        v_skipped:=v_skipped+1;
        insert into public.bulk_import_job_events(job_id,event_type,metadata) values(requested_job_id,'ROW_SKIPPED',jsonb_build_object('rowId',v_row.id,'reason','EXTERNAL_ID_EXISTS','domainType','PARTNER_LISTING'));
        continue;
      end if;

      v_payload:=coalesce(v_row.normalized_payload,'{}'::jsonb); v_pricing:=coalesce(v_row.pricing_result,'{}'::jsonb); v_economics:=v_pricing->'economics';
      v_failure_category:='PRICING_REVIEW_REQUIRED';
      if coalesce((v_pricing->>'stale')::boolean,false)
         or (coalesce(v_pricing->>'status','') not in ('COMPETITIVE','OVERPRICED','UNDERPRICED')
             and not (coalesce(v_pricing->>'status','')='INSUFFICIENT_DATA' and coalesce((v_pricing->>'manualPriceApproved')::boolean,false) and coalesce(v_pricing->>'humanReviewStatus','')='APPROVED')) then
        raise exception 'Marketplace pricing review required' using errcode='22023';
      end if;
      v_effective_price:=coalesce(nullif(v_pricing->>'approvedPriceMinor','')::numeric,nullif(v_pricing->>'proposedPriceMinor','')::numeric,nullif(v_pricing->>'calculatedPublicPriceMinor','')::numeric);
      if v_effective_price is null or v_effective_price<=0 then raise exception 'Marketplace price is unavailable' using errcode='22023'; end if;

      v_failure_category:='MARKETPLACE_ECONOMICS_INVALID';
      v_partner_net:=nullif(v_economics->>'partnerNetMinor','')::numeric;
      if v_economics is null
         or nullif(v_economics->>'publicPriceMinor','')::numeric is distinct from v_effective_price
         or v_partner_net is null or v_partner_net<=0
         or (nullif(v_pricing->>'estimatedPartnerNetMinor','') is not null and nullif(v_pricing->>'estimatedPartnerNetMinor','')::numeric is distinct from v_partner_net)
         or coalesce(nullif(v_economics->>'commissionMinor','')::numeric,-1)<0
         or coalesce(nullif(v_economics->>'commissionVatMinor','')::numeric,-1)<0
         or coalesce(nullif(v_economics->>'processingTotalMinor','')::numeric,-1)<0
         or coalesce(nullif(v_economics->>'adminPercentageFeeMinor','')::numeric,-1)<0
         or coalesce(nullif(v_economics->>'adminFixedFeeMinor','')::numeric,-1)<0
         or coalesce(nullif(v_economics->>'estimatedBestRoundRevenueMinor','')::numeric,-1)<0
         or coalesce(v_economics->>'meetsMinimumMarketplaceRevenue','true')='false' then
        raise exception 'Marketplace economics are invalid' using errcode='22023';
      end if;

      v_failure_category:='MANUAL_MODEL_APPROVAL_REQUIRED';
      if v_row.canonical_model_id is null and not (
        coalesce(v_row.manual_resolution->'model'->>'approved','false')='true'
        and nullif(btrim(v_row.manual_resolution->'model'->>'brand'),'') is not null
        and nullif(btrim(v_row.manual_resolution->'model'->>'model'),'') is not null
        and lower(btrim(v_row.manual_resolution->'model'->>'brand'))=lower(btrim(v_payload->>'brand'))
        and lower(btrim(v_row.manual_resolution->'model'->>'model'))=lower(btrim(v_payload->>'model'))
        and lower(btrim(v_row.manual_resolution->'model'->>'category'))=lower(btrim(v_payload->>'category'))
        and nullif(v_row.manual_resolution->'model'->>'modelYear','')::integer is not distinct from nullif(v_payload->>'modelYear','')::integer
      ) then raise exception 'Manual model approval is required' using errcode='22023'; end if;

      v_failure_category:='CATALOG_REFERENCE_UNAVAILABLE';
      select m.id,m.brand_id,m.category_id,m.model_name into v_model from public.catalog_product_models m where m.id=v_row.canonical_model_id and m.status='active';
      if found then v_brand_id:=v_model.brand_id; v_category_id:=v_model.category_id; v_title:=v_model.model_name;
      else
        select b.id into v_brand_id from public.brands b where lower(b.name)=lower(v_payload->>'brand') and b.status='active' limit 1;
        select c.id into v_category_id from public.categories c where lower(c.slug)=lower(v_payload->>'categorySlug') and c.status='active' limit 1;
        v_title:=nullif(btrim(v_payload->>'model'),'');
        if v_brand_id is null or v_category_id is null or v_title is null then raise exception 'Catalog reference is unavailable' using errcode='22023'; end if;
      end if;

      v_failure_category:='INVALID_QUANTITY';
      v_quantity:=coalesce(nullif(v_payload->>'quantity','')::integer,1);
      if v_quantity<=0 then raise exception 'Quantity must be positive' using errcode='22023'; end if;
      v_condition:=coalesce(nullif(v_payload->>'condition','')::public.product_condition,'used'::public.product_condition);
      v_version_id:=gen_random_uuid(); v_inventory_id:=gen_random_uuid();

      v_failure_category:='LISTING_CREATION_FAILED';
      insert into public.marketplace_listings(partner_id,status) values(v_job.partner_profile_id,'DRAFT') returning * into v_listing;
      insert into public.marketplace_listing_versions(id,listing_id,version_number,state,canonical_model_id,brand_id,category_id,proposed_brand,proposed_model,title,description,condition,condition_grade,condition_notes,specifications,quantity,created_by)
      values(v_version_id,v_listing.id,1,'DRAFT',v_row.canonical_model_id,v_brand_id,v_category_id,v_payload->>'brand',v_payload->>'model',left(v_title,180),nullif(v_payload->>'notes',''),v_condition,case when v_condition='used' then 'good'::public.product_condition_grade else null end,case when v_condition='used' then nullif(v_payload->>'notes','') else null end,v_payload,v_quantity,auth.uid());
      update public.marketplace_listings ml set current_version_id=v_version_id where ml.id=v_listing.id returning ml.* into v_listing;
      insert into public.marketplace_listing_status_history(listing_id,listing_version_id,from_status,to_status,actor_id,reason,lock_version)
      values(v_listing.id,v_version_id,null,'DRAFT',auth.uid(),'Partner bulk import draft created',v_listing.lock_version);
      v_failure_category:='INVENTORY_INITIALIZATION_FAILED';
      insert into public.marketplace_listing_inventory(id,listing_id,quantity_on_hand) values(v_inventory_id,v_listing.id,v_quantity);
      insert into public.marketplace_listing_inventory_movements(inventory_id,listing_version_id,movement_type,quantity_on_hand_delta,quantity_reserved_delta,quantity_on_hand_after,quantity_reserved_after,actor_id,reason)
      values(v_inventory_id,v_version_id,'INITIAL',v_quantity,0,v_quantity,0,auth.uid(),'Partner bulk import draft initialized');
      v_failure_category:='EXECUTION_LINK_FAILED';
      insert into public.bulk_import_partner_execution_links(job_id,row_id,partner_profile_id,external_id,marketplace_listing_id,marketplace_listing_version_id,marketplace_inventory_id,pricing_snapshot)
      values(requested_job_id,v_row.id,v_job.partner_profile_id,btrim(v_row.external_id),v_listing.id,v_version_id,v_inventory_id,v_pricing);
      update public.bulk_import_rows bir set execution_status='IMPORTED',marketplace_listing_id=v_listing.id,marketplace_listing_version_id=v_version_id,marketplace_inventory_id=v_inventory_id,marketplace_pricing_snapshot=v_pricing,executed_at=now() where bir.id=v_row.id;
      v_imported:=v_imported+1;
      insert into public.bulk_import_job_events(job_id,event_type,metadata) values(requested_job_id,'ROW_IMPORTED',jsonb_build_object('rowId',v_row.id,'listingId',v_listing.id,'listingVersionId',v_version_id,'inventoryId',v_inventory_id,'domainType','PARTNER_LISTING'));
    exception when others then
      v_failed:=v_failed+1;
      update public.bulk_import_rows bir set execution_status='FAILED',execution_error=case
        when v_failure_category='INVALID_EXTERNAL_ID' then 'Falta el ID externo.'
        when v_failure_category='PRICING_REVIEW_REQUIRED' then 'El precio requiere revisión y aprobación.'
        when v_failure_category='MARKETPLACE_ECONOMICS_INVALID' then 'La economía Marketplace de esta fila no es válida.'
        when v_failure_category='MANUAL_MODEL_APPROVAL_REQUIRED' then 'El modelo manual debe aprobarse antes de crear el borrador.'
        when v_failure_category='CATALOG_REFERENCE_UNAVAILABLE' then 'No se encontró la referencia de catálogo.'
        when v_failure_category='INVALID_QUANTITY' then 'La cantidad debe ser mayor que cero.'
        when v_failure_category='INVENTORY_INITIALIZATION_FAILED' then 'No se pudo inicializar el inventario Marketplace.'
        when v_failure_category='EXECUTION_LINK_FAILED' then 'No se pudo vincular la ejecución Marketplace.'
        else 'No se pudo crear el borrador de publicación para esta fila.' end,executed_at=now() where bir.id=v_row.id;
      v_errors:=v_errors||jsonb_build_array(jsonb_build_object('rowId',v_row.id,'code',sqlstate,'category',coalesce(v_failure_category,'ROW_IMPORT_FAILED')));
      insert into public.bulk_import_job_events(job_id,event_type,metadata) values(requested_job_id,'ROW_IMPORT_FAILED',jsonb_build_object('rowId',v_row.id,'code',sqlstate,'category',coalesce(v_failure_category,'ROW_IMPORT_FAILED'),'domainType','PARTNER_LISTING'));
    end;
  end loop;

  perform public.reconcile_bulk_import_job_aggregate(requested_job_id);
  select bj.status,bj.imported_count,bj.skipped_count,bj.failed_import_count into v_aggregate_status,v_aggregate_imported,v_aggregate_skipped,v_aggregate_failed from public.bulk_import_jobs bj where bj.id=requested_job_id;
  insert into public.bulk_import_job_events(job_id,event_type,metadata) values(requested_job_id,case when v_aggregate_failed=0 then 'IMPORT_COMPLETED' when v_aggregate_imported=0 then 'IMPORT_FAILED' else 'IMPORT_PARTIALLY_COMPLETED' end,jsonb_build_object('imported',v_aggregate_imported,'skipped',v_aggregate_skipped,'failed',v_aggregate_failed,'thisAttemptImported',v_imported,'thisAttemptSkipped',v_skipped,'thisAttemptFailed',v_failed,'domainType','PARTNER_LISTING'));
  return jsonb_build_object('status',v_aggregate_status,'imported',v_aggregate_imported,'skipped',v_aggregate_skipped,'failed',v_aggregate_failed,'attemptImported',v_imported,'attemptSkipped',v_skipped,'attemptFailed',v_failed,'errors',v_errors);
end;
$$;

revoke all on function public.execute_partner_bulk_import(uuid) from public, anon;
grant execute on function public.execute_partner_bulk_import(uuid) to authenticated;
