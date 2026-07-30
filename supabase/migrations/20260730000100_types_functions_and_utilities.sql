-- Shared types and utilities for the Peter Golf MVP schema.

create domain public.money_minor_units as numeric(14, 0)
  check (value >= 0);

create domain public.iso_currency_code as character(3)
  check (value ~ '^[A-Z]{3}$');

create type public.catalog_record_status as enum ('active', 'archived');
create type public.product_condition as enum ('new', 'used');
create type public.product_condition_grade as enum (
  'like_new',
  'excellent',
  'very_good',
  'good',
  'fair'
);
create type public.product_status as enum ('draft', 'active', 'archived');
create type public.fulfillment_type as enum (
  'in_stock',
  'special_order',
  'preorder'
);
create type public.inventory_movement_type as enum (
  'receipt',
  'adjustment',
  'reservation',
  'release',
  'sale',
  'return'
);
create type public.cart_status as enum ('active', 'converted', 'abandoned');
create type public.order_status as enum (
  'created',
  'pending_confirmation',
  'simulated_payment_approved',
  'preparing',
  'ready_to_ship',
  'shipped',
  'delivered',
  'cancelled',
  'returned'
);
create type public.advisory_session_status as enum (
  'active',
  'completed',
  'abandoned'
);
create type public.advisory_request_status as enum (
  'new',
  'in_contact',
  'resolved',
  'closed'
);
create type public.contact_channel as enum ('email', 'phone', 'whatsapp');
create type public.page_status as enum ('draft', 'published', 'archived');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

