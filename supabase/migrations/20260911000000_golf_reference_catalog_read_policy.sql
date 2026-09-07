-- Reference data is non-sensitive. Authenticated golfers may read active
-- canonical entries; only catalog staff/server workflows may write them.
create policy "authenticated users can read active golf reference brands"
  on public.brands for select to authenticated
  using (status = 'active');
create policy "authenticated users can read active golf reference categories"
  on public.categories for select to authenticated
  using (status = 'active' and exists (
    select 1 from public.category_spec_profiles p where p.category_id = categories.id
  ));
create policy "authenticated users can read active golf reference models"
  on public.catalog_product_models for select to authenticated
  using (status = 'active');
