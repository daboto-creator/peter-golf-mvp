-- Nullable generation year for canonical models and user-declared equipment.
alter table public.catalog_product_models
  add column if not exists model_year integer;

alter table public.catalog_product_models
  drop constraint if exists catalog_product_models_model_year_check;

alter table public.catalog_product_models
  add constraint catalog_product_models_model_year_check
  check (model_year is null or model_year between 1900 and 2200);

alter table public.mi_golf_equipment
  add column if not exists model_year integer;

alter table public.mi_golf_equipment
  drop constraint if exists mi_golf_equipment_model_year_check;

alter table public.mi_golf_equipment
  add constraint mi_golf_equipment_model_year_check
  check (model_year is null or model_year between 1900 and 2200);

-- The old key allowed only one generation per brand/category/name. Replace it
-- with a NULL-safe pair of unique indexes so known generations can coexist,
-- while retaining a single unknown-year row.
alter table public.catalog_product_models
  drop constraint if exists catalog_product_models_brand_id_category_id_normalized_model_name_key;

create unique index if not exists catalog_product_models_generation_key
  on public.catalog_product_models (brand_id, category_id, normalized_model_name, model_year)
  where model_year is not null;

create unique index if not exists catalog_product_models_unknown_generation_key
  on public.catalog_product_models (brand_id, category_id, normalized_model_name)
  where model_year is null;

create index if not exists catalog_product_models_model_year_idx
  on public.catalog_product_models (brand_id, category_id, model_year);
