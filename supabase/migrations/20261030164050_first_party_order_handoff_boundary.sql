-- Give First Party orders an authorized, auditable handoff boundary. Stripe
-- refund recovery uses orders.status='shipped' as proof that stock left custody.
alter table public.orders
  add column first_party_handed_off_at timestamptz,
  add column first_party_handoff_carrier text,
  add column first_party_handoff_tracking_number text,
  add constraint orders_first_party_handoff_fields_consistent check (
    (first_party_handed_off_at is null and first_party_handoff_carrier is null
      and first_party_handoff_tracking_number is null)
    or (first_party_handed_off_at is not null and first_party_handoff_carrier is not null
      and first_party_handoff_tracking_number is not null)
  ),
  add constraint orders_first_party_handoff_text_lengths check (
    (first_party_handoff_carrier is null or char_length(btrim(first_party_handoff_carrier)) between 2 and 80)
    and (first_party_handoff_tracking_number is null
      or char_length(btrim(first_party_handoff_tracking_number)) between 3 and 120)
  );

create or replace function public.record_first_party_order_handoff(
  requested_order_id uuid,
  expected_version integer,
  requested_carrier text,
  requested_tracking_number text,
  requested_idempotency_key uuid
) returns table(order_id uuid, status public.order_status, version integer, replayed boolean)
language plpgsql security invoker set search_path = '' as $$
declare selected public.orders%rowtype; existing public.order_idempotency_keys%rowtype;
  carrier_value text:=btrim(requested_carrier); tracking_value text:=btrim(requested_tracking_number);
  payload_hash text;
begin
  if auth.uid() is null or not public.can_manage_orders() then
    raise exception 'Order access denied' using errcode='42501';
  end if;
  if requested_order_id is null or expected_version<1 or requested_idempotency_key is null
    or char_length(carrier_value) not between 2 and 80
    or char_length(tracking_value) not between 3 and 120 then
    raise exception 'First Party handoff request is invalid' using errcode='22023';
  end if;
  payload_hash:=encode(extensions.digest((requested_order_id::text||':'||expected_version::text||
    ':handoff:'||carrier_value||':'||tracking_value)::bytea,'sha256'),'hex');
  select * into existing from public.order_idempotency_keys
    where idempotency_key=requested_idempotency_key;
  if found then
    if existing.actor_id<>auth.uid() or existing.operation<>'handoff'
      or existing.order_id<>requested_order_id or existing.payload_hash<>payload_hash then
      raise exception 'Idempotency key conflict' using errcode='23505';
    end if;
    return query select o.id,o.status,o.version,true from public.orders o where o.id=requested_order_id;
    return;
  end if;
  select * into selected from public.orders where id=requested_order_id for update;
  if not found then raise exception 'Order not found' using errcode='P0002'; end if;
  if selected.version<>expected_version then raise exception 'Order changed' using errcode='40001'; end if;
  if selected.status<>'preparing' or selected.first_party_handed_off_at is not null
    or not exists(select 1 from public.order_items oi where oi.order_id=selected.id and oi.item_source='FIRST_PARTY')
    or exists(select 1 from public.order_items oi where oi.order_id=selected.id and oi.item_source<>'FIRST_PARTY')
    or not exists(select 1 from public.order_payments p where p.order_id=selected.id and p.status='paid') then
    raise exception 'Order is not eligible for First Party handoff' using errcode='22023';
  end if;
  perform set_config('peter_golf.order_rpc_write','enabled',true);
  update public.orders set status='shipped',first_party_handed_off_at=now(),
    first_party_handoff_carrier=carrier_value,first_party_handoff_tracking_number=tracking_value,
    updated_by=auth.uid(),version=public.orders.version+1
    where id=selected.id;
  insert into public.order_idempotency_keys(idempotency_key,actor_id,operation,order_id,payload_hash)
    values(requested_idempotency_key,auth.uid(),'handoff',selected.id,payload_hash);
  perform set_config('peter_golf.order_rpc_write','disabled',true);
  return query select o.id,o.status,o.version,false from public.orders o where o.id=selected.id;
exception when others then
  perform set_config('peter_golf.order_rpc_write','disabled',true);
  raise;
end;
$$;
revoke all on function public.record_first_party_order_handoff(uuid,integer,text,text,uuid) from public,anon;
grant execute on function public.record_first_party_order_handoff(uuid,integer,text,text,uuid) to authenticated;

alter table public.order_idempotency_keys drop constraint order_idempotency_operation_allowed;
alter table public.order_idempotency_keys add constraint order_idempotency_operation_allowed
  check (operation in ('create','checkout','confirm','cancel','handoff'));
