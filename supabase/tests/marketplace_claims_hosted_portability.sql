begin;
do $$ begin
  if has_function_privilege('anon','private.run_marketplace_acceptance_job_internal(timestamptz,text)','EXECUTE')
    or has_function_privilege('authenticated','private.run_marketplace_acceptance_job_internal(timestamptz,text)','EXECUTE')
    or has_function_privilege('service_role','private.run_marketplace_acceptance_job_internal(timestamptz,text)','EXECUTE')
  then raise exception 'Hosted acceptance executor leaked'; end if;
  if not exists(select 1 from cron.job where jobname='best-round-marketplace-delivery-auto-accept-hourly'
    and command not like '%auth.uid%') then raise exception 'Cron requires human auth'; end if;
end $$;
rollback;
