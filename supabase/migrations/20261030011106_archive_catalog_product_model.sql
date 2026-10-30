-- Authorized single-record archival for canonical golf models.
-- Reuses catalog operator/admin authorization; direct client UPDATE remains revoked.
create or replace function public.archive_catalog_product_model(
  requested_model_id uuid,
  expected_updated_at timestamptz,
  requested_reason text
)
returns public.catalog_product_models
language plpgsql
security definer
set search_path = ''
as $$
declare
  model_record public.catalog_product_models;
  reason_value text := btrim(requested_reason);
begin
  if (select auth.uid()) is null or not public.can_manage_catalog() then
    raise exception 'Catalog model archive denied' using errcode = '42501';
  end if;
  if requested_model_id is null or expected_updated_at is null
    or char_length(reason_value) not between 3 and 500 then
    raise exception 'A model, expected update timestamp, and valid reason are required'
      using errcode = '22023';
  end if;

  select * into model_record
  from public.catalog_product_models
  where id = requested_model_id
  for update;
  if not found then
    raise exception 'Catalog model not found' using errcode = 'P0002';
  end if;
  if model_record.updated_at is distinct from expected_updated_at then
    raise exception 'Catalog model version conflict' using errcode = '40001';
  end if;
  if model_record.status = 'archived' then
    return model_record;
  end if;

  update public.catalog_product_models
  set status = 'archived'
  where id = requested_model_id
    and status = 'active'
    and updated_at = expected_updated_at
  returning * into model_record;
  if not found then
    raise exception 'Catalog model version conflict' using errcode = '40001';
  end if;

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    (select auth.uid()), 'catalog.model_archived', 'catalog_product_model',
    model_record.id,
    jsonb_build_object('reason', reason_value, 'previous_status', 'active',
      'status', 'archived', 'updated_at', model_record.updated_at)
  );
  return model_record;
end;
$$;

revoke all on function public.archive_catalog_product_model(uuid, timestamptz, text)
  from public, anon;
grant execute on function public.archive_catalog_product_model(uuid, timestamptz, text)
  to authenticated;
