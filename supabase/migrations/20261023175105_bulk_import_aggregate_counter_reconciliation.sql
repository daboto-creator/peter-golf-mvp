-- PR84 corrective 6: aggregate job counters must describe the complete
-- current row state, including rows imported by earlier retry attempts.
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
  select count(*) filter (where bir.execution_status = 'IMPORTED'),
         count(*) filter (where bir.execution_status = 'SKIPPED_EXISTING'),
         count(*) filter (where bir.execution_status = 'FAILED'),
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
  -- A PARTIALLY_IMPORTED -> FAILED_IMPORT transition is the retry lock
  -- acquired by the server action. Preserve FAILED_IMPORT so the executor
  -- can claim the job; its terminal transition is reconciled below.
  if new.status in ('IMPORTED','PARTIALLY_IMPORTED','FAILED_IMPORT')
     and not (old.status = 'PARTIALLY_IMPORTED' and new.status = 'FAILED_IMPORT') then
    select count(*) filter (where bir.execution_status = 'IMPORTED'),
           count(*) filter (where bir.execution_status = 'SKIPPED_EXISTING'),
           count(*) filter (where bir.execution_status = 'FAILED'),
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

drop trigger if exists bulk_import_job_aggregate_reconciliation on public.bulk_import_jobs;
create trigger bulk_import_job_aggregate_reconciliation
before update of status on public.bulk_import_jobs
for each row execute function public.bulk_import_job_aggregate_before_update();

revoke all on function public.reconcile_bulk_import_job_aggregate(uuid) from public, anon, authenticated;
revoke all on function public.bulk_import_job_aggregate_before_update() from public, anon, authenticated;
