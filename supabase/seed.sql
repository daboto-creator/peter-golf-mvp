-- Safe, idempotent development data. No users or real contact data.

insert into public.roles (name, description)
values
  ('customer', 'Cliente autenticado'),
  ('operator', 'Operación de catálogo, inventario y seguimiento'),
  ('admin', 'Administración autorizada del sistema')
on conflict (name) do update
set description = excluded.description;

insert into public.brands (slug, name, description)
values
  ('marca-demo-norte', 'Marca Demo Norte', 'Marca ficticia para desarrollo.'),
  ('marca-demo-sur', 'Marca Demo Sur', 'Marca ficticia para desarrollo.'),
  ('marca-demo-centro', 'Marca Demo Centro', 'Marca ficticia para desarrollo.')
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  status = 'active';

insert into public.categories (slug, name, description, sort_order)
values
  ('palos-demo', 'Palos demo', 'Categoría ficticia para desarrollo.', 10),
  ('bolsas-demo', 'Bolsas demo', 'Categoría ficticia para desarrollo.', 20),
  ('accesorios-demo', 'Accesorios demo', 'Categoría ficticia para desarrollo.', 30)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  status = 'active',
  sort_order = excluded.sort_order;

insert into public.shipping_methods (
  code,
  name,
  description,
  base_price,
  currency,
  sort_order
)
values
  (
    'cotizacion_manual_demo',
    'Cotización manual demo',
    'Método ficticio; la tarifa y el plazo requieren confirmación.',
    0,
    'MXN',
    10
  ),
  (
    'recoleccion_queretaro_demo',
    'Recolección en Querétaro demo',
    'Opción ficticia para pruebas locales; no representa un servicio vigente.',
    0,
    'MXN',
    20
  )
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  base_price = excluded.base_price,
  currency = excluded.currency,
  active = true,
  sort_order = excluded.sort_order;

insert into public.site_settings (key, value, description, is_public)
values
  (
    'app.environment',
    '"staging"'::jsonb,
    'Identificador no secreto del ambiente de prueba.',
    false
  ),
  (
    'payments.mode',
    '"disabled"'::jsonb,
    'Los pagos reales permanecen deshabilitados.',
    false
  ),
  (
    'catalog.default_currency',
    '"MXN"'::jsonb,
    'Moneda predeterminada del catálogo.',
    false
  )
on conflict (key) do update
set
  value = excluded.value,
  description = excluded.description,
  is_public = excluded.is_public;
