-- Preserve the user's original text while optionally linking Mi Golf equipment
-- to the shared catalog taxonomy. Unresolved entries remain user-entered.
update public.mi_golf_profiles set handedness = upper(handedness)
where handedness is not null;
alter table public.mi_golf_profiles drop constraint mi_golf_profiles_handedness_valid;
alter table public.mi_golf_profiles add constraint mi_golf_profiles_handedness_valid
  check (handedness is null or handedness in ('RIGHT','LEFT','UNKNOWN'));
alter table public.mi_golf_equipment
  add column category_id uuid references public.categories(id) on delete set null,
  add column category_input text,
  add column canonical_brand_id uuid references public.brands(id) on delete set null,
  add column canonical_model_id uuid references public.catalog_product_models(id) on delete set null,
  add column brand_input text,
  add column model_input text,
  add column reference_status text not null default 'USER_ENTERED';

alter table public.mi_golf_equipment
  add constraint mi_golf_equipment_reference_status_valid
  check (reference_status in ('RESOLVED','USER_ENTERED','PENDING_REVIEW'));

create index mi_golf_equipment_canonical_brand_idx
  on public.mi_golf_equipment(canonical_brand_id)
  where canonical_brand_id is not null;
create index mi_golf_equipment_canonical_model_idx
  on public.mi_golf_equipment(canonical_model_id)
  where canonical_model_id is not null;

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
