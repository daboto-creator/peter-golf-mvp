-- Secure customer profile and address management, plus saved-address checkout.

alter table public.addresses
  add column if not exists exterior_number text,
  add column if not exists delivery_references text,
  add column if not exists version integer not null default 1;

alter table public.addresses
  drop constraint if exists addresses_label_length;
alter table public.addresses
  add constraint addresses_label_length
    check (char_length(btrim(label)) between 2 and 40) not valid;
alter table public.addresses
  add constraint addresses_phone_length
    check (phone is not null and char_length(btrim(phone)) between 7 and 30) not valid,
  add constraint addresses_line_1_length
    check (char_length(btrim(line_1)) between 1 and 160) not valid,
  add constraint addresses_exterior_number_length
    check (exterior_number is null or char_length(btrim(exterior_number)) between 1 and 30) not valid,
  add constraint addresses_line_2_length
    check (line_2 is null or char_length(btrim(line_2)) between 1 and 30) not valid,
  add constraint addresses_neighborhood_length
    check (neighborhood is not null and char_length(btrim(neighborhood)) between 1 and 120) not valid,
  add constraint addresses_city_length
    check (char_length(btrim(city)) between 1 and 120) not valid,
  add constraint addresses_state_length
    check (char_length(btrim(state)) between 1 and 120) not valid,
  add constraint addresses_references_length
    check (delivery_references is null or char_length(btrim(delivery_references)) between 1 and 500) not valid,
  add constraint addresses_version_positive check (version > 0);

-- Customers retain read access through RLS, but all writes go through the
-- narrowly scoped functions below. They cannot choose user_id or restricted
-- profile fields.
revoke insert, update, delete on public.addresses from authenticated;
revoke insert, update on public.profiles from authenticated;
grant select on public.profiles to authenticated;

drop policy if exists "users can create own profile" on public.profiles;
drop policy if exists "users can update own profile" on public.profiles;
drop policy if exists "checkout rpc can save own address" on public.addresses;

create or replace function public.update_customer_profile(
  requested_first_name text,
  requested_last_name text,
  requested_phone text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_first_name text := regexp_replace(btrim(requested_first_name), '\s+', ' ', 'g');
  normalized_last_name text := regexp_replace(btrim(requested_last_name), '\s+', ' ', 'g');
  normalized_phone text := regexp_replace(btrim(requested_phone), '\s+', ' ', 'g');
  normalized_display_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  normalized_display_name := concat_ws(' ', normalized_first_name, normalized_last_name);
  if char_length(normalized_first_name) not between 1 and 80
    or char_length(normalized_last_name) not between 1 and 80
    or char_length(normalized_display_name) not between 2 and 120
    or char_length(normalized_phone) not between 7 and 30
  then
    raise exception 'Profile data is invalid' using errcode = '22023';
  end if;
  update public.profiles
  set first_name = normalized_first_name,
      last_name = normalized_last_name,
      display_name = normalized_display_name,
      phone = normalized_phone
  where id = auth.uid() and archived_at is null;
  if not found then
    raise exception 'Profile is unavailable' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.normalize_customer_address(requested jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  normalized jsonb;
begin
  if jsonb_typeof(requested) <> 'object' then
    raise exception 'Address is invalid' using errcode = '22023';
  end if;
  normalized := jsonb_build_object(
    'label', regexp_replace(btrim(requested->>'label'), '\s+', ' ', 'g'),
    'recipient_name', regexp_replace(btrim(requested->>'recipient_name'), '\s+', ' ', 'g'),
    'phone', regexp_replace(btrim(requested->>'phone'), '\s+', ' ', 'g'),
    'street', regexp_replace(btrim(requested->>'street'), '\s+', ' ', 'g'),
    'exterior_number', regexp_replace(btrim(requested->>'exterior_number'), '\s+', ' ', 'g'),
    'interior_number', nullif(regexp_replace(btrim(requested->>'interior_number'), '\s+', ' ', 'g'), ''),
    'neighborhood', regexp_replace(btrim(requested->>'neighborhood'), '\s+', ' ', 'g'),
    'city', regexp_replace(btrim(requested->>'city'), '\s+', ' ', 'g'),
    'state', regexp_replace(btrim(requested->>'state'), '\s+', ' ', 'g'),
    'postal_code', btrim(requested->>'postal_code'),
    'references', nullif(regexp_replace(btrim(requested->>'references'), '\s+', ' ', 'g'), ''),
    'country_code', 'MX',
    'is_default', coalesce((requested->>'is_default')::boolean, false)
  );
  if char_length(normalized->>'label') not between 2 and 40
    or char_length(normalized->>'recipient_name') not between 2 and 120
    or char_length(normalized->>'phone') not between 7 and 30
    or char_length(normalized->>'street') not between 1 and 160
    or char_length(normalized->>'exterior_number') not between 1 and 30
    or ((normalized->>'interior_number') is not null and char_length(normalized->>'interior_number') > 30)
    or char_length(normalized->>'neighborhood') not between 1 and 120
    or char_length(normalized->>'city') not between 1 and 120
    or char_length(normalized->>'state') not between 1 and 120
    or normalized->>'postal_code' !~ '^[0-9]{5}$'
    or ((normalized->>'references') is not null and char_length(normalized->>'references') > 500)
  then
    raise exception 'Address is invalid' using errcode = '22023';
  end if;
  return normalized;
exception when invalid_text_representation then
  raise exception 'Address is invalid' using errcode = '22023';
end;
$$;

create or replace function public.manage_customer_address(
  requested_operation text,
  requested_address_id uuid,
  expected_version integer,
  requested_address jsonb
)
returns table (address_id uuid, version integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized jsonb;
  selected public.addresses%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if requested_operation not in ('create', 'update', 'delete', 'set_default') then
    raise exception 'Address request is invalid' using errcode = '22023';
  end if;

  -- A profile row lock serializes every address mutation for one customer.
  perform 1 from public.profiles where id = auth.uid() for update;
  if not found then
    raise exception 'Profile is unavailable' using errcode = 'P0002';
  end if;

  if requested_operation = 'create' then
    normalized := public.normalize_customer_address(requested_address);
    if (normalized->>'is_default')::boolean then
      update public.addresses set is_default = false, version = addresses.version + 1
      where user_id = auth.uid() and is_default and archived_at is null;
    end if;
    insert into public.addresses (
      user_id, label, recipient_name, phone, line_1, exterior_number, line_2,
      neighborhood, city, state, postal_code, country_code, delivery_references, is_default
    ) values (
      auth.uid(), normalized->>'label', normalized->>'recipient_name', normalized->>'phone',
      normalized->>'street', normalized->>'exterior_number', normalized->>'interior_number',
      normalized->>'neighborhood', normalized->>'city', normalized->>'state',
      normalized->>'postal_code', 'MX', normalized->>'references',
      (normalized->>'is_default')::boolean
    ) returning addresses.id, addresses.version into address_id, version;
    return next;
    return;
  end if;

  select * into selected from public.addresses
  where id = requested_address_id and user_id = auth.uid() and archived_at is null
  for update;
  if not found then
    raise exception 'Address is unavailable' using errcode = 'P0002';
  end if;
  if expected_version is null or selected.version <> expected_version then
    raise exception 'Address changed' using errcode = '40001';
  end if;

  if requested_operation = 'delete' then
    delete from public.addresses where id = selected.id and user_id = auth.uid();
    address_id := selected.id;
    version := selected.version;
    return next;
    return;
  end if;

  if requested_operation = 'set_default' then
    update public.addresses set is_default = false, version = addresses.version + 1
    where user_id = auth.uid() and is_default and id <> selected.id and archived_at is null;
    update public.addresses set is_default = true, version = addresses.version + 1
    where id = selected.id returning addresses.id, addresses.version into address_id, version;
    return next;
    return;
  end if;

  normalized := public.normalize_customer_address(requested_address);
  if (normalized->>'is_default')::boolean then
    update public.addresses set is_default = false, version = addresses.version + 1
    where user_id = auth.uid() and is_default and id <> selected.id and archived_at is null;
  end if;
  update public.addresses set
    label = normalized->>'label', recipient_name = normalized->>'recipient_name',
    phone = normalized->>'phone', line_1 = normalized->>'street',
    exterior_number = normalized->>'exterior_number', line_2 = normalized->>'interior_number',
    neighborhood = normalized->>'neighborhood', city = normalized->>'city',
    state = normalized->>'state', postal_code = normalized->>'postal_code',
    country_code = 'MX', delivery_references = normalized->>'references',
    is_default = (normalized->>'is_default')::boolean,
    version = addresses.version + 1
  where id = selected.id
  returning addresses.id, addresses.version into address_id, version;
  return next;
end;
$$;

-- New checkout signature. A saved address ID is resolved here and browser
-- address fields are ignored. The existing six-argument function remains for
-- backwards compatibility and performs the atomic cart/order transaction.
create or replace function public.create_customer_checkout_order(
  requested_cart_id uuid,
  expected_version integer,
  requested_shipping_method_id uuid,
  requested_saved_address_id uuid,
  requested_address jsonb,
  requested_save_address boolean,
  requested_idempotency_key uuid
)
returns table (order_id uuid, order_number text, replayed boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected public.addresses%rowtype;
  resolved_address jsonb;
  result record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if requested_saved_address_id is not null then
    select * into selected from public.addresses
    where id = requested_saved_address_id and user_id = auth.uid() and archived_at is null;
    if not found then
      raise exception 'Address is unavailable' using errcode = 'P0002';
    end if;
    resolved_address := jsonb_build_object(
      'recipient_name', selected.recipient_name, 'phone', selected.phone,
      'street', selected.line_1,
      'exterior_number', coalesce(selected.exterior_number, 'S/N'),
      'interior_number', selected.line_2, 'neighborhood', selected.neighborhood,
      'city', selected.city, 'state', selected.state, 'postal_code', selected.postal_code,
      'references', selected.delivery_references, 'country_code', 'MX'
    );
    requested_save_address := false;
  else
    resolved_address := requested_address;
  end if;

  select * into result from public.create_customer_checkout_order(
    requested_cart_id, expected_version, requested_shipping_method_id,
    resolved_address, requested_save_address, requested_idempotency_key
  );

  if requested_saved_address_id is not null and not result.replayed then
    update public.orders set shipping_address_id = selected.id
    where id = result.order_id and user_id = auth.uid();
  elsif requested_saved_address_id is null and requested_save_address and not result.replayed then
    update public.addresses set
      line_1 = resolved_address->>'street',
      exterior_number = resolved_address->>'exterior_number',
      line_2 = nullif(resolved_address->>'interior_number', ''),
      delivery_references = nullif(resolved_address->>'references', '')
    where id = (select shipping_address_id from public.orders where id = result.order_id)
      and user_id = auth.uid();
  end if;
  return query select result.order_id, result.order_number, result.replayed;
end;
$$;

revoke all on function public.update_customer_profile(text, text, text),
  public.normalize_customer_address(jsonb),
  public.manage_customer_address(text, uuid, integer, jsonb),
  public.create_customer_checkout_order(uuid, integer, uuid, uuid, jsonb, boolean, uuid)
from public, anon;
grant execute on function public.update_customer_profile(text, text, text),
  public.manage_customer_address(text, uuid, integer, jsonb),
  public.create_customer_checkout_order(uuid, integer, uuid, uuid, jsonb, boolean, uuid)
to authenticated;
revoke execute on function
  public.create_customer_checkout_order(uuid, integer, uuid, jsonb, boolean, uuid)
from authenticated;
