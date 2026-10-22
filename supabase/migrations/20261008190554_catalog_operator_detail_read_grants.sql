-- Catalog operator detail pages read a few reviewed/internal columns that are
-- intentionally excluded from the public product projection. Keep the grant
-- narrow: RLS remains the authorization boundary and no cost column is exposed.
grant select (
  condition_score,
  target_player,
  canonical_model_id,
  model_reference_status
) on public.products to authenticated;
