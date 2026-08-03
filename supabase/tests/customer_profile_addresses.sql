-- Customer profile/address ownership, RPC authorization and default rules.
-- Runs entirely in a transaction and always ends with ROLLBACK.

begin;

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('15000000-0000-4000-8000-000000000001','authenticated','authenticated','address.one@example.test','{}','{}',now(),now()),
  ('15000000-0000-4000-8000-000000000002','authenticated','authenticated','address.two@example.test','{}','{}',now(),now()),
  ('15000000-0000-4000-8000-000000000003','authenticated','authenticated','address.operator@example.test','{}','{}',now(),now()),
  ('15000000-0000-4000-8000-000000000004','authenticated','authenticated','address.admin@example.test','{}','{}',now(),now());
insert into public.user_roles (user_id, role_id)
select '15000000-0000-4000-8000-000000000003', id from public.roles where name='operator';
insert into public.user_roles (user_id, role_id)
select '15000000-0000-4000-8000-000000000004', id from public.roles where name='admin';
insert into public.addresses(id,user_id,label,recipient_name,phone,line_1,exterior_number,
  neighborhood,city,state,postal_code,country_code)
values('25000000-0000-4000-8000-000000000001','15000000-0000-4000-8000-000000000001',
  'Otra','Cliente Uno','4421234567','Juárez','5','Centro','Querétaro','Querétaro','76000','MX');

-- Anonymous callers cannot invoke customer mutation functions.
set local role anon;
do $$ begin
  begin
    perform public.update_customer_profile('Ana','Pérez','4421234567');
    raise exception 'Expected anonymous profile rejection';
  exception when insufficient_privilege then null; end;
  begin
    perform public.manage_customer_address('create',null,null,'{}');
    raise exception 'Expected anonymous address rejection';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
set local role authenticated;

do $$
declare first_address record; second_address record; current_version integer;
  payload jsonb := '{"label":"Casa","recipient_name":"Ana Pérez","phone":"4421234567",
    "street":"Reforma","exterior_number":"10","interior_number":"  ",
    "neighborhood":"Centro","city":"Querétaro","state":"Querétaro",
    "postal_code":"76000","references":" Portón   verde ","country_code":"MX",
    "is_default":true}'::jsonb;
begin
  if (select count(*) from public.profiles) <> 1 then
    raise exception 'Customer can read another profile';
  end if;
  perform public.update_customer_profile(' Ana ',' Pérez ',' 442 123 4567 ');
  if not exists (select 1 from public.profiles where id=auth.uid()
    and display_name='Ana Pérez' and phone='442 123 4567') then
    raise exception 'Profile update or normalization failed';
  end if;
  begin
    update public.profiles set archived_at=now() where id=auth.uid();
    raise exception 'Direct restricted profile update succeeded';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.user_roles(user_id,role_id)
    select auth.uid(),id from public.roles where name='admin';
    raise exception 'Customer changed roles';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.addresses(user_id,label,recipient_name,phone,line_1,exterior_number,
      neighborhood,city,state,postal_code,country_code)
    values(auth.uid(),'Casa','Ana Pérez','4421234567','Reforma','10','Centro','Querétaro','Querétaro','76000','MX');
    raise exception 'Direct address insert succeeded';
  exception when insufficient_privilege then null; end;

  select * into first_address from public.manage_customer_address('create',null,null,payload);
  if not exists (select 1 from public.addresses where id=first_address.address_id
    and is_default and line_2 is null and delivery_references='Portón verde' and country_code='MX') then
    raise exception 'Address creation/normalization failed';
  end if;
  select * into second_address from public.manage_customer_address('create',null,null,
    jsonb_set(jsonb_set(payload,'{label}','"Oficina"'),'{exterior_number}','"20"'));
  if (select count(*) from public.addresses where is_default) <> 1
    or not exists (select 1 from public.addresses where id=second_address.address_id and is_default)
  then raise exception 'Unique default replacement failed'; end if;

  select version into current_version from public.addresses where id=first_address.address_id;
  perform public.manage_customer_address('set_default',first_address.address_id,current_version,'{}');
  if (select count(*) from public.addresses where is_default) <> 1
    or not exists (select 1 from public.addresses where id=first_address.address_id and is_default)
  then raise exception 'Set default failed'; end if;

  select version into current_version from public.addresses where id=first_address.address_id;
  perform public.manage_customer_address('delete',first_address.address_id,current_version,'{}');
  if exists (select 1 from public.addresses where is_default) then
    raise exception 'Deleting default reassigned another address';
  end if;
end $$;

reset role;
select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$
declare foreign_id uuid := '25000000-0000-4000-8000-000000000001'; foreign_version integer := 1;
begin
  if (select count(*) from public.addresses) <> 0 then
    raise exception 'Customer can read foreign addresses';
  end if;
  begin
    perform public.manage_customer_address('update',foreign_id,foreign_version,
      '{"label":"Ajena","recipient_name":"Persona Ajena","phone":"4421234567",
       "street":"Calle","exterior_number":"1","interior_number":null,
       "neighborhood":"Centro","city":"Ciudad","state":"Estado","postal_code":"76000",
       "references":null,"country_code":"MX","is_default":false}');
    raise exception 'Foreign address update succeeded';
  exception when no_data_found then null;
    when others then if sqlstate <> 'P0002' then raise; end if;
  end;
  begin
    perform public.manage_customer_address('delete',foreign_id,foreign_version,'{}');
    raise exception 'Foreign address delete succeeded';
  exception when no_data_found then null;
    when others then if sqlstate <> 'P0002' then raise; end if;
  end;
  begin
    perform public.create_customer_checkout_order(
      '25000000-0000-4000-8000-000000000001',1,
      '35000000-0000-4000-8000-000000000001',foreign_id,'{}',false,
      '45000000-0000-4000-8000-000000000001');
    raise exception 'Checkout accepted a foreign saved address';
  exception when no_data_found then null;
    when others then if sqlstate <> 'P0002' then raise; end if;
  end;
  begin
    perform public.create_customer_checkout_order(
      '25000000-0000-4000-8000-000000000001',1,
      '35000000-0000-4000-8000-000000000001','{}',false,
      '45000000-0000-4000-8000-000000000002');
    raise exception 'Legacy checkout entry point remained callable';
  exception when insufficient_privilege then null; end;
end $$;

rollback;
