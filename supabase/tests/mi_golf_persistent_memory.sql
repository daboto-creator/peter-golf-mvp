-- PR81 hosted SQL/RLS assertions. Run against the target Supabase project.
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'mi_golf_recommendation_snapshots'
  ) then raise exception 'Mi Golf recommendation history table is missing'; end if;

  if not exists (
    select 1 from pg_class
    where oid = 'public.mi_golf_profiles'::regclass and relrowsecurity
  ) or not exists (
    select 1 from pg_class
    where oid = 'public.mi_golf_equipment'::regclass and relrowsecurity
  ) or not exists (
    select 1 from pg_class
    where oid = 'public.mi_golf_objectives'::regclass and relrowsecurity
  ) or not exists (
    select 1 from pg_class
    where oid = 'public.mi_golf_recommendation_snapshots'::regclass and relrowsecurity
  ) then raise exception 'Mi Golf durable tables must all have RLS enabled'; end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename in ('mi_golf_profiles','mi_golf_equipment','mi_golf_objectives','mi_golf_recommendation_snapshots')
      and roles @> array['anon']::name[]
  ) then raise exception 'Anon must not have Mi Golf policies'; end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'mi_golf_recommendation_snapshots'
      and roles @> array['authenticated']::name[]
      and qual like '%auth.uid()%'
  ) then raise exception 'Recommendation history must be owner-scoped'; end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'mi_golf_profiles'
      and column_name = 'handicap_source'
  ) then raise exception 'Profile provenance columns are missing'; end if;
end $$;
