-- Concurrent-safe SKU reservation for new Best Round Pro Shop products.

create sequence if not exists public.brps_product_sku_sequence
  as bigint
  minvalue 1
  start with 1
  increment by 1
  no cycle;

revoke all on sequence public.brps_product_sku_sequence from public, anon, authenticated;

create or replace function public.reserve_brps_product_sku(requested_base text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_base text := upper(btrim(requested_base));
  sequence_value bigint;
  candidate text;
begin
  if not public.can_manage_catalog() then
    raise exception 'Catalog management is not allowed' using errcode = '42501';
  end if;

  if normalized_base !~ '^BRPS-[A-Z0-9]+(?:-[A-Z0-9]+)*$'
    or char_length(normalized_base) > 70
  then
    raise exception 'Product SKU base is invalid' using errcode = '22023';
  end if;

  loop
    sequence_value := nextval('public.brps_product_sku_sequence'::regclass);
    candidate := normalized_base || '-' || lpad(sequence_value::text, 3, '0');

    exit when not exists (
      select 1 from public.products where products.sku = candidate
    ) and not exists (
      select 1 from public.product_variants where product_variants.sku = candidate
    );
  end loop;

  return candidate;
end;
$$;

revoke all on function public.reserve_brps_product_sku(text) from public, anon;
grant execute on function public.reserve_brps_product_sku(text) to authenticated;

comment on function public.reserve_brps_product_sku(text) is
  'Reserves a unique BRPS SKU using a PostgreSQL sequence; gaps are expected.';
