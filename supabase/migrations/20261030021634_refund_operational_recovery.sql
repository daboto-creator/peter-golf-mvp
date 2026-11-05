-- First Party inventory recovery is line-scoped and physically dispositioned.
-- Refund webhooks record financial truth; only a provably pre-handoff item or
-- an authorized Ops acceptance can put stock back into sellable inventory.

create type public.inventory_recovery_status as enum (
  'PENDING', 'RESTOCKED', 'NOT_RESTOCKED', 'NOT_REQUIRED'
);
create type public.inventory_recovery_disposition as enum (
  'RESTOCKABLE', 'DAMAGED', 'MISSING_COMPONENTS', 'CONDITION_MISMATCH', 'OTHER'
);

create table public.inventory_recovery_cases (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  order_item_id uuid not null unique references public.order_items(id) on delete restrict,
  refund_id uuid references public.stripe_refunds(id) on delete restrict,
  fulfillment_id uuid references public.order_fulfillments(id) on delete restrict,
  inventory_id uuid not null references public.inventory(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  status public.inventory_recovery_status not null default 'PENDING',
  disposition public.inventory_recovery_disposition,
  reason text,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  constraint inventory_recovery_reason_length check
    (reason is null or char_length(btrim(reason)) between 3 and 500),
  constraint inventory_recovery_resolution_state check (
    (status = 'PENDING' and resolved_at is null and disposition is null)
    or (status = 'RESTOCKED' and resolved_at is not null and disposition = 'RESTOCKABLE')
    or (status = 'NOT_RESTOCKED' and resolved_at is not null and disposition in ('DAMAGED','MISSING_COMPONENTS','CONDITION_MISMATCH','OTHER'))
    or (status = 'NOT_REQUIRED' and resolved_at is not null)
  )
);
create index inventory_recovery_cases_order_idx
  on public.inventory_recovery_cases(order_id, created_at);
create trigger inventory_recovery_cases_set_updated_at
  before update on public.inventory_recovery_cases
  for each row execute function public.set_updated_at();

create table public.inventory_recovery_case_history (
  id uuid primary key default gen_random_uuid(),
  recovery_case_id uuid not null references public.inventory_recovery_cases(id) on delete restrict,
  from_status public.inventory_recovery_status,
  to_status public.inventory_recovery_status not null,
  disposition public.inventory_recovery_disposition,
  actor_source text not null check (actor_source in ('STRIPE_WEBHOOK','OPS')),
  actor_id uuid references public.profiles(id) on delete set null,
  reason text,
  idempotency_key uuid unique,
  created_at timestamptz not null default now(),
  constraint recovery_history_reason_length check
    (reason is null or char_length(btrim(reason)) between 3 and 500)
);
create index inventory_recovery_history_case_idx
  on public.inventory_recovery_case_history(recovery_case_id, created_at);

alter table public.inventory_recovery_cases enable row level security;
alter table public.inventory_recovery_case_history enable row level security;
create policy "orders managers read inventory recovery cases"
  on public.inventory_recovery_cases for select to authenticated
  using ((select public.can_manage_orders()));
create policy "orders managers read inventory recovery history"
  on public.inventory_recovery_case_history for select to authenticated
  using ((select public.can_manage_orders()));
revoke all on public.inventory_recovery_cases, public.inventory_recovery_case_history
  from anon, authenticated;
grant select on public.inventory_recovery_cases, public.inventory_recovery_case_history
  to authenticated;

create or replace function private.guard_inventory_recovery_write()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_setting('peter_golf.inventory_recovery_write', true) is distinct from 'enabled' then
    raise exception 'Inventory recovery writes require an authorized recovery action' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_inventory_recovery_write() from public, anon, authenticated, service_role;
create trigger inventory_recovery_cases_guard
  before insert or update or delete on public.inventory_recovery_cases
  for each row execute function private.guard_inventory_recovery_write();
create trigger inventory_recovery_history_immutable
  before update or delete on public.inventory_recovery_case_history
  for each row execute function public.reject_immutable_row_change();
revoke all on function public.reject_immutable_row_change() from public, anon, authenticated;

create or replace function private.restock_first_party_recovery_case(
  requested_case_id uuid,
  requested_actor_id uuid,
  requested_reason text,
  requested_idempotency_key uuid
)
returns public.inventory_recovery_cases
language plpgsql security definer set search_path = '' as $$
declare c public.inventory_recovery_cases%rowtype; i public.inventory%rowtype;
begin
  select * into c from public.inventory_recovery_cases where id=requested_case_id for update;
  if not found then raise exception 'Inventory recovery case not found' using errcode='P0002'; end if;
  if c.status <> 'PENDING' then return c; end if;
  select * into i from public.inventory where id=c.inventory_id for update;
  if not found then raise exception 'Recovery inventory not found' using errcode='P0002'; end if;
  perform set_config('peter_golf.inventory_rpc_write','enabled',true);
  update public.inventory set quantity_on_hand=quantity_on_hand+c.quantity
    where id=c.inventory_id returning * into i;
  insert into public.inventory_movements(
    inventory_id,movement_type,quantity_delta,quantity_on_hand_after,
    quantity_reserved_after,reason,reference_type,reference_id,actor_id,idempotency_key
  ) values (
    c.inventory_id,'return',c.quantity,i.quantity_on_hand,i.quantity_reserved,
    coalesce(nullif(btrim(requested_reason),''),'Refund recovery accepted by Ops'),
    'inventory_recovery',c.id,requested_actor_id,
    private.marketplace_deterministic_uuid('inventory-recovery:'||c.id::text)
  ) on conflict (idempotency_key) where idempotency_key is not null do nothing;
  perform set_config('peter_golf.inventory_recovery_write','enabled',true);
  update public.inventory_recovery_cases set status='RESTOCKED',disposition='RESTOCKABLE',
    reason=coalesce(nullif(btrim(requested_reason),''),'Pre-handoff refund recovery'),
    resolved_at=now(),resolved_by=requested_actor_id,version=version+1
    where id=c.id returning * into c;
  insert into public.inventory_recovery_case_history(
    recovery_case_id,from_status,to_status,disposition,actor_source,actor_id,reason,idempotency_key
  ) values(c.id,'PENDING','RESTOCKED','RESTOCKABLE',
    case when requested_actor_id is null then 'STRIPE_WEBHOOK' else 'OPS' end,
    requested_actor_id,coalesce(nullif(btrim(requested_reason),''),'Inventory recovered'),requested_idempotency_key)
  on conflict (idempotency_key) where idempotency_key is not null do nothing;
  perform set_config('peter_golf.inventory_recovery_write','disabled',true);
  perform set_config('peter_golf.inventory_rpc_write','disabled',true);
  return c;
exception when others then
  perform set_config('peter_golf.inventory_recovery_write','disabled',true);
  perform set_config('peter_golf.inventory_rpc_write','disabled',true);
  raise;
end;
$$;
revoke all on function private.restock_first_party_recovery_case(uuid,uuid,text,uuid)
  from public, anon, authenticated, service_role;

create or replace function private.create_first_party_recovery_cases_on_refund()
returns trigger language plpgsql security definer set search_path = '' as $$
declare line record; c public.inventory_recovery_cases%rowtype; safe_before_handoff boolean;
  refund_record_id uuid;
begin
  if new.status::text <> 'refunded' or new.refunded_amount <> new.expected_amount
     or (old.status::text='refunded' and old.refunded_amount=new.refunded_amount) then
    return new;
  end if;
  select sr.id into refund_record_id from public.stripe_refunds sr
    where sr.payment_id=new.id and sr.status='succeeded'
    order by sr.last_event_created_at desc,sr.id desc limit 1;
  for line in
    select oi.id order_item_id,oi.order_id,oi.variant_id,oi.quantity,
      r.inventory_id inventory_id,oi.fulfillment_id,
      f.source fulfillment_source,f.status fulfillment_status,f.shipped_at,f.carrier_handoff_actor_id,
      o.status order_status
    from public.order_items oi
    join public.inventory_reservations r on r.order_item_id=oi.id
      and r.source='FIRST_PARTY' and r.status='COMMITTED'
    join public.inventory inv on inv.id=r.inventory_id
    left join public.order_fulfillments f on f.id=oi.fulfillment_id
    join public.orders o on o.id=oi.order_id
    where oi.order_id=new.order_id and oi.item_source='FIRST_PARTY'
      and oi.variant_id is not null
  loop
    perform set_config('peter_golf.inventory_recovery_write','enabled',true);
    insert into public.inventory_recovery_cases(order_id,order_item_id,refund_id,fulfillment_id,inventory_id,variant_id,quantity)
    values(line.order_id,line.order_item_id,refund_record_id,line.fulfillment_id,line.inventory_id,line.variant_id,line.quantity)
    on conflict(order_item_id) do nothing;
    select * into c from public.inventory_recovery_cases where order_item_id=line.order_item_id;
    insert into public.inventory_recovery_case_history(
      recovery_case_id,from_status,to_status,actor_source,reason
    ) values(c.id,null,'PENDING','STRIPE_WEBHOOK','Full financial refund recorded; physical disposition required')
    on conflict do nothing;
    safe_before_handoff :=
      (line.fulfillment_source='BEST_ROUND' and line.fulfillment_status in ('PENDING_CONFIRMATION','CONFIRMED','PREPARING','READY_FOR_CARRIER')
        and line.shipped_at is null and line.carrier_handoff_actor_id is null)
      or (line.fulfillment_id is null and line.order_status='preparing');
    if c.status='PENDING' and safe_before_handoff then
      perform private.restock_first_party_recovery_case(
        c.id,null,'Full refund before Best Round handoff',null
      );
    end if;
    perform set_config('peter_golf.inventory_recovery_write','disabled',true);
  end loop;
  return new;
exception when others then
  perform set_config('peter_golf.inventory_recovery_write','disabled',true);
  raise;
end;
$$;
revoke all on function private.create_first_party_recovery_cases_on_refund()
  from public, anon, authenticated, service_role;
drop trigger if exists zzz_order_payments_first_party_recovery_on_refund on public.order_payments;
create trigger zzz_order_payments_first_party_recovery_on_refund
after update of status,refunded_amount on public.order_payments
for each row execute function private.create_first_party_recovery_cases_on_refund();

create or replace function public.resolve_first_party_inventory_recovery(
  requested_case_id uuid,
  expected_version integer,
  requested_disposition text,
  requested_reason text,
  requested_idempotency_key uuid
)
returns public.inventory_recovery_cases
language plpgsql security definer set search_path = '' as $$
declare c public.inventory_recovery_cases%rowtype; replay public.inventory_recovery_case_history%rowtype;
  disposition_value public.inventory_recovery_disposition;
begin
  if auth.uid() is null or not public.can_manage_orders() then
    raise exception 'Order recovery access denied' using errcode='42501';
  end if;
  if requested_idempotency_key is null then raise exception 'Idempotency key is required' using errcode='22023'; end if;
  if char_length(btrim(coalesce(requested_reason,''))) not between 3 and 500 then
    raise exception 'A reason between 3 and 500 characters is required' using errcode='22023';
  end if;
  if requested_disposition is null or requested_disposition not in ('RESTOCKABLE','DAMAGED','MISSING_COMPONENTS','CONDITION_MISMATCH','OTHER') then
    raise exception 'Unsupported inventory disposition' using errcode='22023';
  end if;
  select * into replay from public.inventory_recovery_case_history
  where idempotency_key=requested_idempotency_key;
  if found then
    if replay.recovery_case_id<>requested_case_id or replay.disposition::text<>requested_disposition
       or replay.reason<>btrim(requested_reason) then
      raise exception 'Idempotency key was already used for a different recovery action' using errcode='22023';
    end if;
    select * into c from public.inventory_recovery_cases where id=requested_case_id;
    return c;
  end if;
  select * into c from public.inventory_recovery_cases where id=requested_case_id for update;
  if not found then raise exception 'Inventory recovery case not found' using errcode='P0002'; end if;
  if c.version<>expected_version then raise exception 'Inventory recovery case changed; refresh and retry' using errcode='40001'; end if;
  if c.status<>'PENDING' then raise exception 'Inventory recovery case is already resolved' using errcode='55000'; end if;
  if not exists(select 1 from public.order_payments p where p.order_id=c.order_id and p.status::text='refunded') then
    raise exception 'A successful refund is required before physical recovery' using errcode='55000';
  end if;
  disposition_value:=requested_disposition::public.inventory_recovery_disposition;
  if disposition_value='RESTOCKABLE' then
    return private.restock_first_party_recovery_case(c.id,auth.uid(),btrim(requested_reason),requested_idempotency_key);
  end if;
  perform set_config('peter_golf.inventory_recovery_write','enabled',true);
  update public.inventory_recovery_cases set status='NOT_RESTOCKED',disposition=disposition_value,
    reason=btrim(requested_reason),resolved_at=now(),resolved_by=auth.uid(),version=version+1
  where id=c.id returning * into c;
  insert into public.inventory_recovery_case_history(
    recovery_case_id,from_status,to_status,disposition,actor_source,actor_id,reason,idempotency_key
  ) values(c.id,'PENDING','NOT_RESTOCKED',disposition_value,'OPS',auth.uid(),btrim(requested_reason),requested_idempotency_key);
  perform set_config('peter_golf.inventory_recovery_write','disabled',true);
  return c;
exception when others then
  perform set_config('peter_golf.inventory_recovery_write','disabled',true);
  raise;
end;
$$;
revoke all on function public.resolve_first_party_inventory_recovery(uuid,integer,text,text,uuid) from public,anon;
grant execute on function public.resolve_first_party_inventory_recovery(uuid,integer,text,text,uuid) to authenticated;

create or replace function public.get_order_inventory_recovery_cases(requested_order_id uuid)
returns table(case_id uuid,order_item_id uuid,product_name text,quantity integer,fulfillment_id uuid,
  fulfillment_status text,payment_status text,refunded_amount bigint,status text,disposition text,
  reason text,version integer,created_at timestamptz,resolved_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.can_manage_orders() then
    raise exception 'Order access denied' using errcode='42501';
  end if;
  return query select c.id,c.order_item_id,coalesce(oi.product_name_snapshot,p.name,'Item'),
    c.quantity,c.fulfillment_id,f.status::text,pay.status::text,pay.refunded_amount::bigint,
    c.status::text,c.disposition::text,c.reason,c.version,c.created_at,c.resolved_at
  from public.inventory_recovery_cases c
  join public.order_items oi on oi.id=c.order_item_id
  left join public.products p on p.id=oi.product_id
  left join public.order_fulfillments f on f.id=c.fulfillment_id
  join public.order_payments pay on pay.order_id=c.order_id
  where c.order_id=requested_order_id order by c.created_at,c.id;
end;
$$;
revoke all on function public.get_order_inventory_recovery_cases(uuid) from public,anon;
grant execute on function public.get_order_inventory_recovery_cases(uuid) to authenticated;

create or replace function public.get_partner_marketplace_refund_visibility(requested_fulfillment_id uuid default null)
returns table(order_id uuid,order_item_id uuid,fulfillment_id uuid,item_title text,
  fulfillment_status text,payment_status text,refund_status text,payable_status text)
language plpgsql security definer set search_path = '' as $$
declare current_partner_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select pp.id into current_partner_id from public.partner_profiles pp
  where pp.user_id=auth.uid();
  if current_partner_id is null then raise exception 'Partner access denied' using errcode='42501'; end if;
  return query select oi.order_id,s.order_item_id,s.fulfillment_id,s.listing_title,
    f.status::text,p.status::text,
    case when p.status::text='refunded' then 'succeeded'
      when p.status::text='partially_refunded' then 'partially_refunded'
      when r.status is not null then r.status::text else 'none' end,mp.status::text
  from public.marketplace_order_item_snapshots s
  join public.order_items oi on oi.id=s.order_item_id and oi.item_source='MARKETPLACE_PARTNER'
  join public.order_fulfillments f on f.id=s.fulfillment_id and f.partner_id=current_partner_id
  join public.order_payments p on p.order_id=oi.order_id
  left join public.marketplace_partner_payables mp on mp.order_item_id=s.order_item_id
    and mp.partner_id=current_partner_id
  left join lateral (select sr.status from public.stripe_refunds sr
    where sr.payment_id=p.id order by sr.last_event_created_at desc,sr.id desc limit 1) r on true
  where requested_fulfillment_id is null or s.fulfillment_id=requested_fulfillment_id;
end;
$$;
revoke all on function public.get_partner_marketplace_refund_visibility(uuid) from public,anon;
grant execute on function public.get_partner_marketplace_refund_visibility(uuid) to authenticated;

-- Preserve the legacy cancellation contract while making its recovery line
-- aware and preventing cancellation after any fulfillment handoff.
create or replace function public.cancel_operational_order(
  requested_order_id uuid, expected_version integer,
  requested_reason text, requested_idempotency_key uuid
)
returns table (order_id uuid, status public.order_status, replayed boolean)
language plpgsql security invoker set search_path = '' as $$
declare selected public.orders%rowtype; existing public.order_idempotency_keys%rowtype;
  line record; inv public.inventory%rowtype; new_balance integer;
  normalized_reason text:=btrim(requested_reason); payload_hash text;
begin
  if not public.can_manage_orders() then raise exception 'Order access denied' using errcode='42501'; end if;
  if requested_idempotency_key is null or char_length(normalized_reason) not between 3 and 500 then
    raise exception 'Cancellation request is invalid' using errcode='22023';
  end if;
  payload_hash:=encode(extensions.digest((requested_order_id::text||':'||expected_version::text||':cancel:'||normalized_reason)::bytea,'sha256'),'hex');
  select * into existing from public.order_idempotency_keys where idempotency_key=requested_idempotency_key;
  if found then
    if existing.actor_id<>auth.uid() or existing.operation<>'cancel' or existing.order_id<>requested_order_id or existing.payload_hash<>payload_hash then
      raise exception 'Idempotency key conflict' using errcode='23505';
    end if;
    return query select o.id,o.status,true from public.orders o where o.id=requested_order_id;
    return;
  end if;
  select * into selected from public.orders where id=requested_order_id for update;
  if not found then raise exception 'Order not found' using errcode='P0002'; end if;
  if selected.status not in ('pending_confirmation','preparing') then raise exception 'Order cannot be cancelled' using errcode='22023'; end if;
  if selected.version<>expected_version then raise exception 'Order changed' using errcode='40001'; end if;
  if exists(select 1 from public.order_fulfillments f where f.order_id=selected.id and
    (f.shipped_at is not null or f.status in ('SHIPPED','DELIVERED','ACCEPTANCE_PENDING','COMPLETED'))) then
    raise exception 'Order cannot be cancelled after fulfillment handoff' using errcode='55000';
  end if;
  if selected.status='preparing' then
    for line in
      select oi.variant_id,sum(oi.quantity)::integer quantity
      from public.order_items oi
      where oi.order_id=selected.id and oi.item_source='FIRST_PARTY' and oi.variant_id is not null
        and not exists(select 1 from public.inventory_recovery_cases rc where rc.order_item_id=oi.id)
        and not exists(select 1 from public.inventory_reservations r where r.order_item_id=oi.id)
      group by oi.variant_id order by oi.variant_id
    loop
      select * into inv from public.inventory where variant_id=line.variant_id for update;
      if not found then raise exception 'Inventory history is inconsistent' using errcode='55000'; end if;
      new_balance:=inv.quantity_on_hand+line.quantity;
      perform set_config('peter_golf.inventory_rpc_write','enabled',true);
      update public.inventory set quantity_on_hand=new_balance where id=inv.id;
      insert into public.inventory_movements(inventory_id,movement_type,quantity_delta,quantity_on_hand_after,
        quantity_reserved_after,reason,reference_type,reference_id,actor_id,idempotency_key)
      values(inv.id,'return',line.quantity,new_balance,inv.quantity_reserved,
        'Cancelación de pedido '||selected.order_number||': '||normalized_reason,
        'order',selected.id,auth.uid(),
        (substr(md5(requested_idempotency_key::text||line.variant_id::text),1,8)||'-'||
         substr(md5(requested_idempotency_key::text||line.variant_id::text),9,4)||'-4'||
         substr(md5(requested_idempotency_key::text||line.variant_id::text),14,3)||'-8'||
         substr(md5(requested_idempotency_key::text||line.variant_id::text),18,3)||'-'||
         substr(md5(requested_idempotency_key::text||line.variant_id::text),21,12))::uuid);
    end loop;
    perform set_config('peter_golf.inventory_rpc_write','disabled',true);
  end if;
  perform set_config('peter_golf.order_rpc_write','enabled',true);
  update public.orders set status='cancelled',cancelled_at=now(),cancelled_by=auth.uid(),
    cancellation_reason=normalized_reason,updated_by=auth.uid(),version=version+1 where id=selected.id;
  insert into public.order_idempotency_keys(idempotency_key,actor_id,operation,order_id,payload_hash)
  values(requested_idempotency_key,auth.uid(),'cancel',selected.id,payload_hash);
  perform set_config('peter_golf.order_rpc_write','disabled',true);
  return query select selected.id,'cancelled'::public.order_status,false;
exception when others then
  perform set_config('peter_golf.inventory_rpc_write','disabled',true);
  perform set_config('peter_golf.order_rpc_write','disabled',true);
  raise;
end;
$$;
revoke all on function public.cancel_operational_order(uuid,integer,text,uuid) from public,anon;
grant execute on function public.cancel_operational_order(uuid,integer,text,uuid) to authenticated;
