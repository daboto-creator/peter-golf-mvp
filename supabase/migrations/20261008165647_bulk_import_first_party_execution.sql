-- PR83: execute approved First Party bulk jobs only. Partner jobs remain
-- preparation-only until the dedicated Partner execution PR.
alter table public.bulk_import_jobs drop constraint if exists bulk_import_jobs_status_check;
alter table public.bulk_import_jobs add constraint bulk_import_jobs_status_check
  check (status in ('UPLOADED','PARSING','NORMALIZING','VALIDATING','RESOLVING_CATALOG','RESOLVING_ASSETS','ANALYZING_PRICING','READY_FOR_REVIEW','APPROVED_FOR_IMPORT','IMPORTING','IMPORTED','PARTIALLY_IMPORTED','FAILED_IMPORT','FAILED','CANCELLED'));

alter table public.bulk_import_jobs
  add column if not exists executed_by uuid references public.profiles(id) on delete set null,
  add column if not exists executed_at timestamptz,
  add column if not exists imported_count integer not null default 0,
  add column if not exists skipped_count integer not null default 0,
  add column if not exists failed_import_count integer not null default 0;

alter table public.bulk_import_rows drop constraint if exists bulk_import_rows_execution_status_check;
alter table public.bulk_import_rows
  add column if not exists execution_status text,
  add column if not exists execution_error text,
  add column if not exists product_id uuid references public.products(id) on delete set null,
  add column if not exists variant_id uuid references public.product_variants(id) on delete set null,
  add column if not exists inventory_id uuid references public.inventory(id) on delete set null,
  add column if not exists executed_at timestamptz;
alter table public.bulk_import_rows add constraint bulk_import_rows_execution_status_check
  check (execution_status is null or execution_status in ('PENDING_IMPORT','IMPORTING','IMPORTED','SKIPPED_EXISTING','FAILED'));

create table if not exists public.bulk_import_execution_links (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.bulk_import_jobs(id) on delete restrict,
  row_id uuid not null unique references public.bulk_import_rows(id) on delete restrict,
  source_scope_id uuid not null references public.profiles(id) on delete restrict,
  external_id text not null,
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  inventory_id uuid not null references public.inventory(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (source_scope_id, external_id)
);
alter table public.bulk_import_execution_links enable row level security;
drop policy if exists "Catalog staff manage bulk execution links" on public.bulk_import_execution_links;
create policy "Catalog staff manage bulk execution links"
  on public.bulk_import_execution_links for all to authenticated
  using (public.can_manage_catalog()) with check (public.can_manage_catalog());
grant select, insert on public.bulk_import_execution_links to authenticated;

alter table public.bulk_import_jobs enable row level security;
grant update (status, executed_by, executed_at, imported_count, skipped_count, failed_import_count) on public.bulk_import_jobs to authenticated;
grant update (execution_status, execution_error, product_id, variant_id, inventory_id, executed_at) on public.bulk_import_rows to authenticated;

alter table public.bulk_import_job_events drop constraint if exists bulk_import_job_events_event_type_check;
alter table public.bulk_import_job_events add constraint bulk_import_job_events_event_type_check
  check (event_type in ('JOB_CREATED','PARSING_COMPLETE','NORMALIZATION_COMPLETE','VALIDATION_COMPLETE','PRICING_STARTED','PRICING_COMPLETED','JOB_READY','JOB_FAILED','REVIEW_OPENED','ROW_CORRECTED','NORMALIZATION_ACCEPTED','MODEL_RESOLVED','ROW_EXCLUDED','ROW_REINCLUDED','JOB_APPROVED_FOR_IMPORT','JOB_REOPENED_FOR_REVIEW','IMPORT_STARTED','ROW_IMPORT_STARTED','ROW_IMPORTED','ROW_SKIPPED','ROW_IMPORT_FAILED','IMPORT_COMPLETED','IMPORT_PARTIALLY_COMPLETED','IMPORT_FAILED','FAILED_ROWS_RETRY_STARTED','FAILED_ROWS_RETRY_COMPLETED'));

create or replace function public.execute_first_party_bulk_import(requested_job_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
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
  imported integer := 0;
  skipped integer := 0;
  failed integer := 0;
  errors jsonb := '[]'::jsonb;
begin
  if not public.can_manage_catalog() then
    raise exception 'Bulk import execution is not authorized' using errcode = '42501';
  end if;
  select * into job from public.bulk_import_jobs where id = requested_job_id for update;
  if not found then raise exception 'Bulk import job not found' using errcode = 'P0002'; end if;
  if job.import_type <> 'FIRST_PARTY' then raise exception 'Partner bulk jobs cannot be executed here' using errcode = '42501'; end if;
  if job.status in ('IMPORTING','IMPORTED','PARTIALLY_IMPORTED') then
    return jsonb_build_object('status', job.status, 'imported', coalesce(job.imported_count,0), 'skipped', coalesce(job.skipped_count,0), 'failed', coalesce(job.failed_import_count,0));
  end if;
  if job.status <> 'APPROVED_FOR_IMPORT' then raise exception 'Bulk import job is not approved' using errcode = '22023'; end if;

  update public.bulk_import_jobs set status = 'IMPORTING', executed_by = auth.uid() where id = requested_job_id;
  insert into public.bulk_import_job_events(job_id,event_type,metadata)
    values (requested_job_id,'IMPORT_STARTED',jsonb_build_object('actorId',auth.uid()));

  for row in select * from public.bulk_import_rows where job_id = requested_job_id and not excluded and coalesce(execution_status,'PENDING_IMPORT') in ('PENDING_IMPORT','FAILED') order by row_number
  loop
    begin
      update public.bulk_import_rows set execution_status='IMPORTING', execution_error=null where id=row.id;
      insert into public.bulk_import_job_events(job_id,event_type,metadata) values (requested_job_id,'ROW_IMPORT_STARTED',jsonb_build_object('rowId',row.id));
      if row.external_id is null or btrim(row.external_id) = '' then raise exception 'Missing external id' using errcode='22023'; end if;
      if exists (select 1 from public.bulk_import_execution_links where source_scope_id=job.created_by and external_id=btrim(row.external_id)) then
        update public.bulk_import_rows set execution_status='SKIPPED_EXISTING', executed_at=now(), execution_error='El ID externo ya fue importado.' where id=row.id;
        skipped := skipped + 1;
        insert into public.bulk_import_job_events(job_id,event_type,metadata) values (requested_job_id,'ROW_SKIPPED',jsonb_build_object('rowId',row.id,'reason','EXTERNAL_ID_EXISTS'));
        continue;
      end if;
      payload := row.normalized_payload;
      pricing := row.pricing_result;
      if (pricing->>'proposedPriceMinor') is null or (pricing->>'status') = 'INSUFFICIENT_DATA' then raise exception 'Pricing review required' using errcode='22023'; end if;
      acquisition := nullif(payload->>'acquisitionCostMinor','')::numeric;
      if acquisition is null or acquisition <= 0 then raise exception 'Acquisition cost is required' using errcode='22023'; end if;
      price := (pricing->>'proposedPriceMinor')::numeric;
      quantity := coalesce(nullif(payload->>'quantity','')::integer,1);
      if quantity <= 0 then raise exception 'Quantity must be positive' using errcode='22023'; end if;
      condition := coalesce(nullif(payload->>'condition','')::public.product_condition,'used');
      select m.id, m.brand_id, m.category_id, m.model_name, b.name brand_name
        into model from public.catalog_product_models m join public.brands b on b.id=m.brand_id
        where m.id=row.canonical_model_id and m.status='active';
      if found then brand_id := model.brand_id; category_id := model.category_id; else
        select b.id into brand_id from public.brands b where lower(b.name)=lower(payload->>'brand') and b.status='active' limit 1;
        select c.id into category_id from public.categories c where lower(c.slug)=lower(payload->>'categorySlug') and c.status='active' limit 1;
        if brand_id is null or category_id is null then raise exception 'Catalog reference is unavailable' using errcode='22023'; end if;
      end if;
      safe_external := regexp_replace(upper(btrim(row.external_id)),'[^A-Z0-9._-]','-','g');
      base_sku := left('BRBI-' || safe_external, 76);
      product_name := left(coalesce(model.model_name, payload->>'model', payload->>'brand' || ' producto'), 200);
      specs := jsonb_build_object('clubType', replace(payload->>'categorySlug','fairway-wood','fairway_wood'), 'model', coalesce(model.model_name,payload->>'model'), 'modelYear', payload->>'modelYear', 'handedness', case payload->>'hand' when 'RIGHT' then 'right' when 'LEFT' then 'left' else '' end, 'loftDegrees', payload->>'loft', 'bounceDegrees', payload->>'bounce', 'grind', payload->>'grind', 'shaftFlex', lower(replace(coalesce(payload->>'flex',''),'X_STIFF','x_stiff')), 'shaftMaterial', lower(coalesce(payload->>'shaftMaterial','')), 'headcoverIncluded', payload->>'headcover', 'notes', payload->>'notes');
      pricing := pricing || jsonb_build_object('acquisitionCost', acquisition, 'marketReference', pricing->>'marketReferenceMinor', 'marketAverage', pricing->>'marketAverageMinor', 'marketLow', pricing->>'marketLowMinor', 'marketHigh', pricing->>'marketHighMinor', 'marketSampleSize', coalesce(pricing->>'sampleSize','0'), 'marketConfidence', case when pricing->>'marketReferenceMinor' is null then 'unavailable' else 'medium' end, 'marketSource', case when pricing->>'marketReferenceMinor' is null then null else 'Bulk Import Review' end, 'acquisitionChannel','purchase');
      select * into created from public.create_priced_golf_product_with_model_reference(left(lower(regexp_replace(product_name || '-' || safe_external,'[^a-zA-Z0-9]+','-','g')),160), base_sku, product_name, null, payload->>'notes', condition, case when condition='used' then 'good'::public.product_condition_grade else null end, case when condition='used' then coalesce(payload->>'notes','Importación Best Round') else null end, brand_id, category_id, 'in_stock', price, null, 'MXN', false, false, true, null, null, null, null, specs, '[]'::jsonb, pricing, row.canonical_model_id, case when row.canonical_model_id is null then 'USER_ENTERED' else 'RESOLVED' end);
      select * into initialized from public.initialize_inventory(created.variant_id);
      select * into movement from public.adjust_inventory(created.variant_id,'receipt'::public.inventory_movement_type,quantity,'Bulk Import PR83',gen_random_uuid(),'bulk_import_row',row.id);
      insert into public.bulk_import_execution_links(job_id,row_id,source_scope_id,external_id,product_id,variant_id,inventory_id) values(requested_job_id,row.id,job.created_by,btrim(row.external_id),created.product_id,created.variant_id,initialized.inventory_id);
      update public.bulk_import_rows set execution_status='IMPORTED',product_id=created.product_id,variant_id=created.variant_id,inventory_id=initialized.inventory_id,executed_at=now() where id=row.id;
      imported := imported + 1;
      insert into public.bulk_import_job_events(job_id,event_type,metadata) values(requested_job_id,'ROW_IMPORTED',jsonb_build_object('rowId',row.id,'productId',created.product_id,'inventoryId',initialized.inventory_id));
    exception when others then
      failed := failed + 1;
      update public.bulk_import_rows set execution_status='FAILED',execution_error=case when sqlstate='42501' then 'No autorizado para crear inventario.' when sqlstate='22023' then 'La fila requiere revisión antes de importarse.' else 'No se pudo crear el producto e inventario para esta fila.' end,executed_at=now() where id=row.id;
      errors := errors || jsonb_build_array(jsonb_build_object('rowId',row.id,'message','No se pudo importar la fila.','code',sqlstate));
      insert into public.bulk_import_job_events(job_id,event_type,metadata) values(requested_job_id,'ROW_IMPORT_FAILED',jsonb_build_object('rowId',row.id,'code',sqlstate));
    end;
  end loop;
  update public.bulk_import_jobs set status=case when failed=0 then 'IMPORTED' when imported=0 then 'FAILED_IMPORT' else 'PARTIALLY_IMPORTED' end, imported_count=imported, skipped_count=skipped, failed_import_count=failed, executed_at=now() where id=requested_job_id;
  insert into public.bulk_import_job_events(job_id,event_type,metadata) values(requested_job_id,case when failed=0 then 'IMPORT_COMPLETED' when imported=0 then 'IMPORT_FAILED' else 'IMPORT_PARTIALLY_COMPLETED' end,jsonb_build_object('imported',imported,'skipped',skipped,'failed',failed));
  return jsonb_build_object('status',case when failed=0 then 'IMPORTED' when imported=0 then 'FAILED_IMPORT' else 'PARTIALLY_IMPORTED' end,'imported',imported,'skipped',skipped,'failed',failed,'errors',errors);
end;
$$;
revoke all on function public.execute_first_party_bulk_import(uuid) from public, anon;
grant execute on function public.execute_first_party_bulk_import(uuid) to authenticated;
