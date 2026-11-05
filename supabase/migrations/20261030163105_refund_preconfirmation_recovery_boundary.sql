-- Real web checkout stays pending_confirmation until Ops accepts the order,
-- and does not create a fulfillment row before that point. That is still a
-- provably pre-handoff state for Best Round-owned inventory.
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
      or (line.fulfillment_id is null and line.order_status in ('pending_confirmation','preparing'));
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
