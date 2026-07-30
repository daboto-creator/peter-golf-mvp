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

insert into public.products (
  slug,
  sku,
  name,
  short_description,
  description,
  condition,
  condition_grade,
  condition_notes,
  brand_id,
  category_id,
  status,
  fulfillment_type,
  price,
  compare_at_price,
  currency,
  featured,
  published,
  price_is_estimate,
  lead_time_min_days,
  lead_time_max_days,
  seo_title,
  seo_description
)
values
  (
    'set-hierros-iniciacion-demo',
    'PG-DEMO-HIERROS-001',
    'Set de hierros de iniciación demo',
    'Set demostrativo para practicar el flujo de un producto nuevo.',
    'Producto ficticio y sin marca comercial, creado exclusivamente para validar el catálogo local. Incluye una selección demostrativa de hierros; no representa una oferta vigente.',
    'new',
    null,
    null,
    (select id from public.brands where slug = 'marca-demo-norte'),
    (select id from public.categories where slug = 'palos-demo'),
    'active',
    'in_stock',
    849900,
    929900,
    'MXN',
    true,
    true,
    false,
    null,
    null,
    'Set de hierros de iniciación demo',
    'Producto ficticio para probar el catálogo local de Peter Golf.'
  ),
  (
    'putter-seminuevo-demo',
    'PG-DEMO-PUTTER-001',
    'Putter seminuevo demo',
    'Artículo demostrativo con condición seminueva claramente descrita.',
    'Putter genérico ficticio para validar la presentación de productos seminuevos. No utiliza marca, diseño ni propiedad intelectual de terceros.',
    'used',
    'very_good',
    'Presenta marcas cosméticas demostrativas en la cabeza; la cara y el grip se describen como funcionales sólo para fines de prueba.',
    (select id from public.brands where slug = 'marca-demo-centro'),
    (select id from public.categories where slug = 'palos-demo'),
    'active',
    'in_stock',
    219900,
    null,
    'MXN',
    false,
    true,
    false,
    null,
    null,
    null,
    null
  ),
  (
    'bolsa-ligera-demo',
    'PG-DEMO-BOLSA-001',
    'Bolsa ligera demo',
    'Bolsa genérica demostrativa disponible sobre pedido.',
    'Producto ficticio para comprobar mensajes de plazo, precio estimado y variantes en el entorno local.',
    'new',
    null,
    null,
    (select id from public.brands where slug = 'marca-demo-sur'),
    (select id from public.categories where slug = 'bolsas-demo'),
    'active',
    'special_order',
    329900,
    null,
    'MXN',
    false,
    true,
    true,
    5,
    9,
    null,
    null
  ),
  (
    'accesorio-borrador-demo',
    'PG-DEMO-DRAFT-001',
    'Accesorio borrador demo',
    'Registro no público para comprobar las políticas del catálogo.',
    'Este producto ficticio debe permanecer oculto porque está en borrador y no publicado.',
    'new',
    null,
    null,
    (select id from public.brands where slug = 'marca-demo-sur'),
    (select id from public.categories where slug = 'accesorios-demo'),
    'draft',
    'preorder',
    49900,
    null,
    'MXN',
    false,
    false,
    false,
    10,
    15,
    null,
    null
  )
on conflict (slug) do update
set
  sku = excluded.sku,
  name = excluded.name,
  short_description = excluded.short_description,
  description = excluded.description,
  condition = excluded.condition,
  condition_grade = excluded.condition_grade,
  condition_notes = excluded.condition_notes,
  brand_id = excluded.brand_id,
  category_id = excluded.category_id,
  status = excluded.status,
  fulfillment_type = excluded.fulfillment_type,
  price = excluded.price,
  compare_at_price = excluded.compare_at_price,
  currency = excluded.currency,
  featured = excluded.featured,
  published = excluded.published,
  price_is_estimate = excluded.price_is_estimate,
  lead_time_min_days = excluded.lead_time_min_days,
  lead_time_max_days = excluded.lead_time_max_days,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  archived_at = null;

insert into public.product_variants (
  product_id,
  sku,
  name,
  attributes,
  price,
  compare_at_price,
  sort_order
)
values
  (
    (select id from public.products where slug = 'bolsa-ligera-demo'),
    'PG-DEMO-BOLSA-001-GRIS',
    'Gris demo',
    '{"color": "gris demo"}'::jsonb,
    329900,
    null,
    10
  ),
  (
    (select id from public.products where slug = 'bolsa-ligera-demo'),
    'PG-DEMO-BOLSA-001-VERDE',
    'Verde demo',
    '{"color": "verde demo"}'::jsonb,
    339900,
    null,
    20
  ),
  (
    (select id from public.products where slug = 'set-hierros-iniciacion-demo'),
    'PG-DEMO-HIERROS-001-DIESTRO',
    'Orientación diestra demo',
    '{"orientacion": "diestra"}'::jsonb,
    null,
    null,
    10
  )
on conflict (sku) do update
set
  product_id = excluded.product_id,
  name = excluded.name,
  attributes = excluded.attributes,
  price = excluded.price,
  compare_at_price = excluded.compare_at_price,
  active = true,
  sort_order = excluded.sort_order,
  archived_at = null;

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
