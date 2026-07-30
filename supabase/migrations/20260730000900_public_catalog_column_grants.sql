-- Complete the public catalog access already constrained by the RLS policies in
-- 20260730000700_rls_and_policies.sql. Grant only presentation columns needed
-- by anonymous and authenticated catalog readers.

revoke select on public.brands from anon, authenticated;
grant select (
  id,
  slug,
  name,
  description,
  status
) on public.brands to anon, authenticated;

revoke select on public.categories from anon, authenticated;
grant select (
  id,
  parent_id,
  slug,
  name,
  description,
  status,
  sort_order
) on public.categories to anon, authenticated;

revoke select on public.product_images from anon, authenticated;
grant select (
  id,
  product_id,
  variant_id,
  storage_path,
  alt_text,
  sort_order,
  is_primary,
  is_condition_evidence
) on public.product_images to anon, authenticated;
