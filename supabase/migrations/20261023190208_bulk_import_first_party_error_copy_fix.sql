-- PR84 corrective 10:
-- First Party review/execution financial-floor parity, durable manual-model gate, and accurate failure categories.
-- Derived from corrective 9 with additive replacement semantics.
-- PR84 corrective 9: First Party execution must accept the same manually
-- reviewed pricing state as the review layer, and failed rows must be retryable.
create or replace function public.execute_first_party_bulk_import(requested_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  job record;
  row record;
  model record;
  created record;
  initialized record;
  movement record;
  payload jsonb;
  pricing jsonb;
  specs jsonb;
  condition public.product_condition;
  price public.money_minor_units;
  acquisition public.money_minor_units;
  quantity integer;
  brand_id uuid;
  category_id uuid;
  product_name text;
  safe_external text;
  base_sku text;
  failure_category text;
  attempt_imported integer := 0;
  attempt_skipped integer := 0;
  attempt_failed integer := 0;
  aggregate_status text;
  aggregate_imported integer;
  aggregate_skipped integer;
  aggregate_failed integer;
  errors jsonb := '[]'::jsonb;
begin
  if not public.can_manage_catalog() then
    raise exception 'Bulk import execution is not authorized' using errcode = '42501';
  end if;

  select * into job
    from public.bulk_import_jobs
   where id = requested_job_id
   for update;
  if not found then
    raise exception 'Bulk import job not found' using errcode = 'P0002';
  end if;
  if job.import_type <> 'FIRST_PARTY' then
    raise exception 'Partner bulk jobs cannot be executed here' using errcode = '42501';
  end if;
  if job.status = 'IMPORTED' then
    return jsonb_build_object(
      'status', job.status,
      'imported', coalesce(job.imported_count, 0),
      'skipped', coalesce(job.skipped_count, 0),
      'failed', coalesce(job.failed_import_count, 0)
    );
  end if;
  if job.status not in ('APPROVED_FOR_IMPORT', 'PARTIALLY_IMPORTED', 'FAILED_IMPORT') then
    raise exception 'Bulk import job is not approved' using errcode = '22023';
  end if;

  update public.bulk_import_jobs
     set status = 'IMPORTING', executed_by = auth.uid()
   where id = requested_job_id;
  insert into public.bulk_import_job_events(job_id, event_type, metadata)
    values (requested_job_id, 'IMPORT_STARTED', jsonb_build_object('actorId', auth.uid(), 'domainType', 'FIRST_PARTY'));

  for row in
    select *
      from public.bulk_import_rows bir
     where bir.job_id = requested_job_id
       and not bir.excluded
       and coalesce(bir.execution_status, 'PENDING_IMPORT') in ('PENDING_IMPORT', 'FAILED')
     order by bir.row_number
  loop
    failure_category := null;
    begin
      update public.bulk_import_rows
         set execution_status = 'IMPORTING', execution_error = null
       where id = row.id;
      insert into public.bulk_import_job_events(job_id, event_type, metadata)
        values (requested_job_id, 'ROW_IMPORT_STARTED', jsonb_build_object('rowId', row.id, 'domainType', 'FIRST_PARTY'));

      if row.external_id is null or btrim(row.external_id) = '' then
        failure_category := 'INVALID_EXTERNAL_ID';
        raise exception 'Missing external id' using errcode = '22023';
      end if;
      if exists (
        select 1
          from public.bulk_import_execution_links bel
         where bel.source_scope_id = job.created_by
           and bel.external_id = btrim(row.external_id)
      ) then
        update public.bulk_import_rows
           set execution_status = 'SKIPPED_EXISTING', executed_at = now(), execution_error = 'El ID externo ya fue importado.'
         where id = row.id;
        attempt_skipped := attempt_skipped + 1;
        insert into public.bulk_import_job_events(job_id, event_type, metadata)
          values (requested_job_id, 'ROW_SKIPPED', jsonb_build_object('rowId', row.id, 'reason', 'EXTERNAL_ID_EXISTS', 'domainType', 'FIRST_PARTY'));
        continue;
      end if;

      payload := coalesce(row.normalized_payload, '{}'::jsonb);
      pricing := coalesce(row.pricing_result, '{}'::jsonb);

      failure_category := 'PRICING_REVIEW_REQUIRED';
      if coalesce(pricing->>'stale', 'false') = 'true' then
        raise exception 'Pricing review required' using errcode = '22023';
      end if;
      price := coalesce(
        nullif(pricing->>'approvedPriceMinor', '')::numeric,
        nullif(pricing->>'proposedPriceMinor', '')::numeric
      );
      if price is null or price <= 0 then
        raise exception 'Pricing review required' using errcode = '22023';
      end if;
      if coalesce(pricing->>'status', '') not in ('COMPETITIVE', 'OVERPRICED', 'UNDERPRICED')
         and not (
           (coalesce(pricing->>'manualPriceApproved', 'false') = 'true'
             or coalesce(pricing->>'manualOverride', 'false') = 'true')
           and coalesce(pricing->>'humanReviewStatus', '') = 'APPROVED'
         ) then
        raise exception 'Pricing review required' using errcode = '22023';
      end if;

      failure_category := 'ACQUISITION_COST_REQUIRED';
      acquisition := nullif(payload->>'acquisitionCostMinor', '')::numeric;
      if acquisition is null or acquisition <= 0 then
        raise exception 'Acquisition cost is required' using errcode = '22023';
      end if;

      failure_category := 'INVALID_QUANTITY';
      quantity := coalesce(nullif(payload->>'quantity', '')::integer, 1);
      if quantity <= 0 then
        raise exception 'Quantity must be positive' using errcode = '22023';
      end if;

      condition := coalesce(nullif(payload->>'condition', '')::public.product_condition, 'used');
      if row.canonical_model_id is null and not (
        coalesce(row.manual_resolution->'model'->>'approved', 'false') = 'true'
        and nullif(btrim(row.manual_resolution->'model'->>'brand'), '') is not null
        and nullif(btrim(row.manual_resolution->'model'->>'model'), '') is not null
        and lower(btrim(row.manual_resolution->'model'->>'brand')) = lower(btrim(payload->>'brand'))
        and lower(btrim(row.manual_resolution->'model'->>'model')) = lower(btrim(payload->>'model'))
        and (nullif(row.manual_resolution->'model'->>'modelYear', '') is null or nullif(payload->>'modelYear', '') is null or row.manual_resolution->'model'->>'modelYear' = payload->>'modelYear')
      ) then
        failure_category := 'MANUAL_MODEL_APPROVAL_REQUIRED';
        raise exception 'Manual model approval is required' using errcode = '22023';
      end if;
      select m.id, m.brand_id, m.category_id, m.model_name, b.name as brand_name
        into model
        from public.catalog_product_models m
        join public.brands b on b.id = m.brand_id
       where m.id = row.canonical_model_id
         and m.status = 'active';
      if found then
        brand_id := model.brand_id;
        category_id := model.category_id;
      else
        failure_category := 'CATALOG_REFERENCE_UNAVAILABLE';
        select b.id into brand_id
          from public.brands b
         where lower(b.name) = lower(payload->>'brand')
           and b.status = 'active'
         limit 1;
        select c.id into category_id
          from public.categories c
         where lower(c.slug) = lower(payload->>'categorySlug')
           and c.status = 'active'
         limit 1;
        if brand_id is null or category_id is null then
          raise exception 'Catalog reference is unavailable' using errcode = '22023';
        end if;
      end if;

      safe_external := regexp_replace(upper(btrim(row.external_id)), '[^A-Z0-9._-]', '-', 'g');
      base_sku := left('BRBI-' || safe_external, 76);
      product_name := left(coalesce(model.model_name, payload->>'model', payload->>'brand' || ' producto'), 200);
      specs := jsonb_build_object(
        'clubType', replace(payload->>'categorySlug', 'fairway-wood', 'fairway_wood'),
        'model', coalesce(model.model_name, payload->>'model'),
        'modelYear', payload->>'modelYear',
        'handedness', case payload->>'hand' when 'RIGHT' then 'right' when 'LEFT' then 'left' else '' end,
        'loftDegrees', payload->>'loft',
        'bounceDegrees', payload->>'bounce',
        'grind', payload->>'grind',
        'shaftFlex', lower(replace(coalesce(payload->>'flex', ''), 'X_STIFF', 'x_stiff')),
        'shaftMaterial', lower(coalesce(payload->>'shaftMaterial', '')),
        'headcoverIncluded', payload->>'headcover',
        'notes', payload->>'notes'
      );
      pricing := pricing || jsonb_build_object(
        'acquisitionCost', acquisition,
        'marketReference', pricing->>'marketReferenceMinor',
        'marketAverage', pricing->>'marketAverageMinor',
        'marketLow', pricing->>'marketLowMinor',
        'marketHigh', pricing->>'marketHighMinor',
        'marketSampleSize', coalesce(pricing->>'sampleSize', '0'),
        'marketConfidence', case when pricing->>'marketReferenceMinor' is null then 'unavailable' else 'medium' end,
        'marketSource', case when pricing->>'marketReferenceMinor' is null then null else 'Bulk Import Review' end,
        'acquisitionChannel', 'purchase'
      );
      failure_category := 'PRODUCT_CREATION_FAILED';
      select * into created
        from public.create_priced_golf_product_with_model_reference(
          left(lower(regexp_replace(product_name || '-' || safe_external, '[^a-zA-Z0-9]+', '-', 'g')), 160),
          base_sku,
          product_name,
          null,
          payload->>'notes',
          condition,
          case when condition = 'used' then 'good'::public.product_condition_grade else null end,
          case when condition = 'used' then coalesce(payload->>'notes', 'Importación Best Round') else null end,
          brand_id,
          category_id,
          'in_stock',
          price,
          null,
          'MXN',
          false,
          false,
          true,
          null,
          null,
          null,
          null,
          specs,
          '[]'::jsonb,
          pricing,
          row.canonical_model_id,
          case when row.canonical_model_id is null then 'USER_ENTERED' else 'RESOLVED' end
        );
      select * into initialized from public.initialize_inventory(created.variant_id);
      select * into movement from public.adjust_inventory(created.variant_id, 'receipt'::public.inventory_movement_type, quantity, 'Bulk Import PR83', gen_random_uuid(), 'bulk_import_row', row.id);
      insert into public.bulk_import_execution_links(job_id, row_id, source_scope_id, external_id, product_id, variant_id, inventory_id)
        values (requested_job_id, row.id, job.created_by, btrim(row.external_id), created.product_id, created.variant_id, initialized.inventory_id);
      update public.bulk_import_rows
         set execution_status = 'IMPORTED', product_id = created.product_id, variant_id = created.variant_id, inventory_id = initialized.inventory_id, executed_at = now()
       where id = row.id;
      attempt_imported := attempt_imported + 1;
      insert into public.bulk_import_job_events(job_id, event_type, metadata)
        values (requested_job_id, 'ROW_IMPORTED', jsonb_build_object('rowId', row.id, 'productId', created.product_id, 'inventoryId', initialized.inventory_id, 'domainType', 'FIRST_PARTY'));
    exception when others then
      if failure_category = 'PRODUCT_CREATION_FAILED' and (sqlstate = '42501' or lower(sqlerrm) like '%financial floor%' or lower(sqlerrm) like '%below the financial%') then
        failure_category := 'FINANCIAL_FLOOR_VIOLATION';
      elsif failure_category = 'PRODUCT_CREATION_FAILED' and sqlstate = '22023' then
        failure_category := 'PRICING_APPLICATION_FAILED';
      end if;
      attempt_failed := attempt_failed + 1;
      update public.bulk_import_rows
         set execution_status = 'FAILED',
             execution_error = case
               when failure_category = 'FINANCIAL_FLOOR_VIOLATION' then 'El precio está por debajo del mínimo financiero.'
               when sqlstate = '42501' then 'No autorizado para crear inventario.'
               when failure_category = 'PRICING_REVIEW_REQUIRED' then 'El precio requiere revisión y aprobación.'
               when failure_category = 'ACQUISITION_COST_REQUIRED' then 'Falta el costo de adquisición.'
               when failure_category = 'INVALID_QUANTITY' then 'La cantidad debe ser mayor que cero.'
               when failure_category = 'CATALOG_REFERENCE_UNAVAILABLE' then 'No se encontró la referencia de catálogo.'
               when failure_category = 'MANUAL_MODEL_APPROVAL_REQUIRED' then 'El modelo manual debe aprobarse antes de importar.'
               when failure_category = 'PRICING_APPLICATION_FAILED' then 'No se pudo aplicar el precio revisado.'
               else 'No se pudo crear el producto e inventario para esta fila.'
             end,
             executed_at = now()
       where id = row.id;
      errors := errors || jsonb_build_array(jsonb_build_object('rowId', row.id, 'message', 'No se pudo importar la fila.', 'code', sqlstate, 'category', coalesce(failure_category, 'INTERNAL_SYSTEM_ERROR')));
      insert into public.bulk_import_job_events(job_id, event_type, metadata)
        values (requested_job_id, 'ROW_IMPORT_FAILED', jsonb_build_object('rowId', row.id, 'code', sqlstate, 'category', coalesce(failure_category, 'INTERNAL_SYSTEM_ERROR'), 'domainType', 'FIRST_PARTY'));
    end;
  end loop;

  perform public.reconcile_bulk_import_job_aggregate(requested_job_id);
  select bj.status, bj.imported_count, bj.skipped_count, bj.failed_import_count
    into aggregate_status, aggregate_imported, aggregate_skipped, aggregate_failed
    from public.bulk_import_jobs bj
   where bj.id = requested_job_id;
  insert into public.bulk_import_job_events(job_id, event_type, metadata)
    values (
      requested_job_id,
      case when aggregate_failed = 0 then 'IMPORT_COMPLETED' when aggregate_imported = 0 then 'IMPORT_FAILED' else 'IMPORT_PARTIALLY_COMPLETED' end,
      jsonb_build_object('imported', aggregate_imported, 'skipped', aggregate_skipped, 'failed', aggregate_failed, 'thisAttemptImported', attempt_imported, 'thisAttemptSkipped', attempt_skipped, 'thisAttemptFailed', attempt_failed, 'domainType', 'FIRST_PARTY')
    );
  return jsonb_build_object('status', aggregate_status, 'imported', aggregate_imported, 'skipped', aggregate_skipped, 'failed', aggregate_failed, 'attemptImported', attempt_imported, 'attemptSkipped', attempt_skipped, 'attemptFailed', attempt_failed, 'errors', errors);
end;
$$;

revoke all on function public.execute_first_party_bulk_import(uuid) from public, anon;
grant execute on function public.execute_first_party_bulk_import(uuid) to authenticated;


