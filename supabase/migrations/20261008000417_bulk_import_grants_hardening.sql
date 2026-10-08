-- Least-privilege follow-up for PR82 foundation tables. RLS remains the
-- authorization boundary; table grants only expose the operations required by
-- the preview/history service.
revoke all on public.bulk_import_jobs, public.bulk_import_rows,
  public.bulk_import_row_issues, public.bulk_import_job_events
  from public, anon, authenticated;

grant select, insert, update on public.bulk_import_jobs to authenticated;
grant select, insert, update on public.bulk_import_rows to authenticated;
grant select, insert, update on public.bulk_import_row_issues to authenticated;
grant select, insert on public.bulk_import_job_events to authenticated;
