-- PR82 corrective fix: Operations discard removes the parent job and relies on
-- the existing ON DELETE CASCADE relationships for rows, issues and events.
-- RLS still limits DELETE to users covered by the existing operator policy;
-- Partners are not granted a delete policy and cannot use this capability.
grant delete on public.bulk_import_jobs to authenticated;
