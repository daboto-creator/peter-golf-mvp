-- Public catalog, variants, and product media.

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  description text,
  status public.catalog_record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brands_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint brands_name_length check (char_length(name) between 1 and 120)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories (id) on delete restrict,
  slug text not null unique,
  name text not null,
  description text,
  status public.catalog_record_status not null default 'active',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_slug_format
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint categories_name_length check (char_length(name) between 1 and 120),
  constraint categories_sort_order_nonnegative check (sort_order >= 0),
  constraint categories_not_own_parent check (parent_id is null or parent_id <> id)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  sku text not null unique,
  name text not null,
  short_description text,
  description text,
  condition public.product_condition not null,
  condition_grade public.product_condition_grade,
  condition_notes text,
  brand_id uuid not null references public.brands (id) on delete restrict,
  category_id uuid not null references public.categories (id) on delete restrict,
  status public.product_status not null default 'draft',
  fulfillment_type public.fulfillment_type not null,
  price public.money_minor_units not null,
  compare_at_price public.money_minor_units,
  cost public.money_minor_units,
  currency public.iso_currency_code not null default 'MXN',
  featured boolean not null default false,
  published boolean not null default false,
  price_is_estimate boolean not null default false,
  lead_time_min_days integer,
  lead_time_max_days integer,
  seo_title text,
  seo_description text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_slug_format
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint products_sku_length check (char_length(sku) between 1 and 80),
  constraint products_name_length check (char_length(name) between 1 and 200),
  constraint products_used_condition_details check (
    (condition = 'used' and condition_grade is not null and condition_notes is not null)
    or (condition = 'new' and condition_grade is null)
  ),
  constraint products_compare_at_price_valid
    check (compare_at_price is null or compare_at_price >= price),
  constraint products_lead_time_valid check (
    lead_time_min_days is null
    or (
      lead_time_min_days >= 0
      and lead_time_max_days is not null
      and lead_time_max_days >= lead_time_min_days
    )
  ),
  constraint products_non_stock_lead_time check (
    fulfillment_type = 'in_stock'
    or lead_time_min_days is not null
    or description is not null
  ),
  constraint products_publication_state check (
    not published or (status = 'active' and archived_at is null)
  )
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  sku text not null unique,
  name text not null,
  attributes jsonb not null default '{}'::jsonb,
  price public.money_minor_units,
  compare_at_price public.money_minor_units,
  cost public.money_minor_units,
  active boolean not null default true,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_variants_attributes_object
    check (jsonb_typeof(attributes) = 'object'),
  constraint product_variants_compare_at_price_valid
    check (compare_at_price is null or price is null or compare_at_price >= price),
  constraint product_variants_sort_order_nonnegative check (sort_order >= 0)
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete set null,
  storage_path text not null,
  alt_text text not null,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  is_condition_evidence boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_images_storage_path_not_url
    check (storage_path !~* '^https?://'),
  constraint product_images_alt_text_length
    check (char_length(alt_text) between 1 and 300),
  constraint product_images_sort_order_nonnegative check (sort_order >= 0)
);

create index categories_parent_id_idx on public.categories (parent_id);
create index products_brand_id_idx on public.products (brand_id);
create index products_category_id_idx on public.products (category_id);
create index products_public_catalog_idx
  on public.products (featured desc, created_at desc)
  where status = 'active' and published and archived_at is null;
create index products_name_search_idx on public.products using gin (
  to_tsvector('spanish', name || ' ' || coalesce(short_description, ''))
);
create index product_variants_product_id_idx
  on public.product_variants (product_id);
create index product_images_product_id_idx on public.product_images (product_id);
create index product_images_variant_id_idx on public.product_images (variant_id);
create unique index product_images_one_primary_per_product_idx
  on public.product_images (product_id)
  where is_primary;

create trigger brands_set_updated_at
before update on public.brands
for each row execute function public.set_updated_at();

create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create trigger product_variants_set_updated_at
before update on public.product_variants
for each row execute function public.set_updated_at();

create trigger product_images_set_updated_at
before update on public.product_images
for each row execute function public.set_updated_at();

