# Modelo de datos

## 1. Estado y alcance

La versión 1 del esquema del MVP está implementada como migraciones SQL
versionadas en `supabase/migrations/`. Incluye usuarios y roles, catálogo,
variantes, inventario, carrito, pedidos de prueba, asesoría, configuración y
auditoría mínima. No incluye pagos reales, datos de tarjeta, Stripe, facturación,
paqueterías ni reservas automáticas de inventario.

La foundation Marketplace es aditiva:
`auth.users -> profiles -> partner_profiles (0..1)`. La misma cuenta conserva su
modo Golfer; Partner no es un rol administrativo. `partner_status_history`
preserva transiciones, `partner_documents` referencia Storage privado y
`marketplace_config_versions` agrupa reglas versionadas. Marketplace permanece
apagado y aún no introduce órdenes multi-Partner. Véase
[MARKETPLACE_FOUNDATION.md](./MARKETPLACE_FOUNDATION.md).

PR 2 amplía aditivamente `partner_profiles` con progreso, datos básicos y datos
fiscales privados, y añade `version` a `partner_documents`. No crea otra tabla
de identidad. Los RPCs de onboarding son la única superficie de escritura del
Partner; estado e historial continúan bajo el workflow de la foundation. Véase
[MARKETPLACE_PARTNER_ONBOARDING.md](./MARKETPLACE_PARTNER_ONBOARDING.md).

PR 3 agrega `catalog_product_models` como identidad canónica mínima referenciada
por `marketplace_listings` y snapshots inmutables en
`marketplace_listing_versions`. Fotos, feedback, historial e inventario Partner
viven en tablas Marketplace separadas; no cambian `products`, variants ni el
inventory first-party. Véase
[MARKETPLACE_PARTNER_LISTINGS.md](./MARKETPLACE_PARTNER_LISTINGS.md).

La migración aplicada que habilita `pgcrypto` permanece sin cambios. Las
migraciones posteriores crean, en orden:

1. tipos, dominios, función de `updated_at`;
2. perfiles, roles y direcciones;
3. catálogo, variantes e imágenes;
4. inventario y movimientos;
5. carrito y pedidos;
6. asesoría, contenido, configuración y auditoría;
7. RLS y políticas;
8. base de autenticación, nombres de perfil y alta automática de clientes.
9. privilegios de columna mínimos para las relaciones públicas del catálogo.
10. autorización y privilegios mínimos para gestión operativa de productos.
11. bucket, políticas y funciones para imágenes de producto.
12. gestión operativa transaccional e idempotente del inventario existente.
13. carrito/checkout, privacidad de pedidos y administración segura de perfil y direcciones.

`supabase/seed.sql` agrega únicamente datos ficticios de desarrollo.

El catálogo público de la aplicación consume este mismo esquema desde
`/productos` y `/productos/[slug]`. No existe una vista ni tabla paralela. La
migración de privilegios públicos completa los `GRANT SELECT` mínimos de marcas,
categorías e imágenes que requieren las políticas RLS ya existentes.

## 2. Convenciones

- Todas las claves primarias son UUID. Se usa `gen_random_uuid()` salvo
  `profiles.id`, que debe ser exactamente el UUID existente de `auth.users`.
- Todas las fechas usan `timestamptz` y sus valores predeterminados se generan
  con `now()`.
- Las entidades mutables tienen `created_at`, `updated_at` y el trigger
  reutilizable `set_updated_at()`.
- Los importes usan el dominio `money_minor_units`, basado en `numeric(14,0)`.
  Representan centavos enteros no negativos: `125000` equivale a
  `$1,250.00 MXN`. No se usa punto flotante.
- La moneda usa `iso_currency_code`, con `MXN` como valor predeterminado.
- Los estados controlados se implementan con enums o `check constraints`.
- Productos, variantes, perfiles y direcciones se archivan mediante estado,
  `archived_at` o ambos cuando debe conservarse trazabilidad.
- Las tablas públicas tienen RLS activada y deniegan todo lo no permitido por
  una política explícita.

## 3. Usuarios y permisos

| Tabla        | Propósito y relaciones clave                                                                    |
| ------------ | ----------------------------------------------------------------------------------------------- |
| `profiles`   | Extiende `auth.users`; nombre, apellido, nombre visible, teléfono opcional, locale y archivado. |
| `roles`      | Roles controlados `customer`, `operator` y `admin`.                                             |
| `user_roles` | Relación N:M entre perfiles y roles; conserva quién asignó el rol.                              |
| `addresses`  | Direcciones mexicanas estructuradas; CP, exterior, referencias, versión y predeterminada única. |

Un trigger sobre `auth.users` crea automáticamente el perfil y asigna únicamente
el rol `customer`. Los cambios de roles no están disponibles mediante políticas
cliente. La gestión de catálogo valida el permiso contra `user_roles` y `roles`
mediante una función booleana protegida; no obtiene roles desde metadata.
Las escrituras de perfil y direcciones se limitan a RPC explícitas; el correo
permanece en `auth.users` y `addresses.user_id` siempre se deriva de `auth.uid()`.

## 4. Catálogo

| Tabla              | Propósito y reglas principales                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| `brands`           | Marca con `slug`, nombre y estado `active`/`archived`.                                          |
| `categories`       | Categoría jerárquica, ordenable y archivable; impide autorreferencia directa.                   |
| `products`         | Producto comercial, condición, disponibilidad, importes, publicación, SEO y archivado.          |
| `product_variants` | SKU de variante, atributos JSON, sobreescritura opcional de importes, orden y archivado.        |
| `product_images`   | Ruta de Storage no privilegiada, texto alternativo, orden, imagen principal y evidencia de uso. |

`products` contiene `slug`, `sku`, `name`, `short_description`, `description`,
`condition`, `condition_grade`, `brand_id`, `category_id`, `status`,
`fulfillment_type`, `price`, `compare_at_price`, `cost`, `currency`, `featured`,
`published`, `seo_title`, `seo_description`, `created_at` y `updated_at`, además
de notas de condición, plazo, precio estimado y archivado.

Reglas relevantes:

- `condition`: `new` o `used`;
- `condition_grade`: `like_new`, `excellent`, `very_good`, `good` o `fair`;
- un producto usado requiere grado y notas de condición;
- un producto nuevo no lleva grado de condición;
- `status`: `draft`, `active` o `archived`;
- `fulfillment_type`: `in_stock`, `special_order` o `preorder`;
- sólo un producto `active`, `published` y no archivado puede ser público;
- `compare_at_price`, cuando existe, no puede ser menor que el precio;
- productos fuera de stock inmediato requieren plazo o explicación;
- marcas y categorías referenciadas no se eliminan en cascada.
- `product_images.storage_path` sólo admite
  `products/{product_id}/{uuid}.{jpg|png|webp}` y nunca URLs;
- existe como máximo una imagen principal por producto;
- las funciones de imágenes bloquean el producto para serializar cambios de
  principal, orden, alta y promoción tras eliminar;
- `is_condition_evidence` sólo puede activarse en productos `used`.

El flujo operativo actual no ofrece variantes configurables. La migración
`20260731000200_catalog_base_variant_foundation.sql` agrega la RPC `security
invoker` `create_product_with_base_variant`: inserta el producto y una única
variante base en una transacción. El SKU de ambos es `upper(btrim(sku))`, cumple
`^[A-Z0-9][A-Z0-9._-]*$` y tiene de 1 a 80 caracteres; el nombre de la variante
es el nombre normalizado del producto, sin introducir una etiqueta comercial
nueva. La variante usa `attributes = {}`, `active = true`, `archived_at = null`,
`sort_order = 0` y no copia precio ni costo.

La unicidad global existente de `product_variants.sku` se conserva: impide que
dos variantes compartan identidad comercial y una colisión revierte el alta
completa. Reenviar el alta tropieza con las restricciones únicas del producto y
nunca crea otra variante; editar sigue actualizando sólo `products`.

La migración `20260731000300_catalog_base_variant_updates.sql` reemplaza esa
última regla para el flujo base: `update_product_with_base_variant` bloquea el
producto, valida el snapshot esperado de `status` y `published`, exige una sola
variante canónica y sincroniza producto/variante en la misma transacción. La
variante conserva `active = true`, `archived_at = null`, `attributes = {}` y
`sort_order = 0`. La RPC sólo actualiza `sku` y `name`; `price`,
`compare_at_price` y `cost` permanecen exactamente como estaban, incluidos sus
valores `NULL`, y nunca se selecciona ni expone `cost`.

El SKU se normaliza con la misma regla del alta. Las restricciones únicas de
`products.sku` y `product_variants.sku` detectan colisiones; si la segunda
actualización falla, PostgreSQL revierte también la primera. Un contexto local
de transacción exigido por RLS y un trigger impiden modificar directamente la
identidad de producto o variante fuera de la RPC. Huérfanos deben repararse
explícitamente antes de editar. Archivados, múltiples variantes o una única
variante no canónica se rechazan.

No se reparan filas históricas durante la migración. La RPC explícita
`repair_product_base_variant` bloquea un producto no archivado, sólo inserta si
no existe ninguna variante y trata como reintento la única variante canónica ya
creada. Rechaza productos archivados, múltiples variantes y variantes existentes
no canónicas. Esta reparación pertenece al catálogo, no a inventario.

Las consultas públicas seleccionan únicamente los campos de presentación
necesarios y dependen de las políticas RLS existentes. El estado básico de
disponibilidad se deriva de `fulfillment_type` y de los plazos; `inventory` y sus
cantidades no se exponen al visitante. Los precios de variantes pueden
sobrescribir el precio base y, cuando son nulos, la interfaz usa el precio del
producto.

## 5. Inventario

| Tabla                 | Propósito y reglas principales                                                          |
| --------------------- | --------------------------------------------------------------------------------------- |
| `inventory`           | Existencia por variante; cantidad física, reservada y punto de reorden.                 |
| `inventory_movements` | Libro inmutable de recepciones, ajustes, reservas, liberaciones, ventas y devoluciones. |

`quantity_on_hand`, `quantity_reserved` y `reorder_point` nunca pueden ser
negativos. La cantidad reservada no puede superar la existencia. Cada movimiento
conserva cantidades posteriores, motivo, actor y referencia opcional completa.
La cantidad disponible se define como
`quantity_on_hand - quantity_reserved`; esta fase sólo la lee y no implementa
reservas.

La migración `20260731000100_inventory_management_foundation.sql` implementa
las RPC `initialize_inventory` y `adjust_inventory`, y
`20260801000100_inventory_variant_management.sql` elimina únicamente el supuesto
de variante única. Cada variante activa y no archivada se inicializa y ajusta
de forma independiente. La inicialización explícita crea saldo cero; los ajustes
posteriores bloquean filas, recalculan el saldo, actualizan `inventory` e
insertan `inventory_movements` en la misma transacción. `idempotency_key` tiene
un índice único parcial global y protege contra doble envío. Un replay sólo se
acepta para el mismo inventario, actor, tipo, cantidad, motivo normalizado y
referencia; cualquier reutilización distinta devuelve conflicto `23505`.

Las Server Actions resuelven además el par `productId`/`variantId` mediante una
consulta explícita y sólo invocan las RPC cuando la variante pertenece al
producto, está activa y no está archivada. Las RPC no reciben `productId`
porque derivan y bloquean el producto real desde `variant_id`, y vuelven a
validar producto y variante. Así el enlace
de la ruta se verifica en la capa web sin duplicar un parámetro confiable en la
frontera transaccional.

Los movimientos operativos habilitados son `receipt` con delta positivo y
`adjustment` con delta entero distinto de cero. Los demás valores existentes
del enum se reservan para flujos futuros que no están implementados. Ningún
ajuste puede dejar el saldo físico por debajo de cero o de la cantidad reservada
existente. Los productos archivados conservan inventario e historial pero no
reciben nuevos ajustes.

## 6. Carrito y pedidos

La base operativa de pedidos manuales, sus snapshots, transacciones e
idempotencia se documenta en [ORDER_MANAGEMENT.md](./ORDER_MANAGEMENT.md).
El carrito y checkout autenticado se documentan en
[CUSTOMER_CART_AND_CHECKOUT.md](./CUSTOMER_CART_AND_CHECKOUT.md).

| Tabla                  | Propósito y reglas principales                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| `shipping_methods`     | Métodos configurables con tarifa de referencia, moneda, estado y orden.                     |
| `carts`                | Carrito de un perfil; sólo puede existir uno activo por usuario.                            |
| `cart_items`           | Variante y cantidad positiva; una variante aparece una vez por carrito.                     |
| `orders`               | Pedido de prueba con estado, totales calculados y snapshot de dirección.                    |
| `order_items`          | Snapshots de producto, variante, SKU, condición, precio, moneda, cantidad y total de línea. |
| `order_status_history` | Historial inmutable creado automáticamente al insertar o cambiar el estado de un pedido.    |

Estados de pedido:

- `created`;
- `pending_confirmation`;
- `simulated_payment_approved`;
- `preparing`;
- `ready_to_ship`;
- `shipped`;
- `delivered`;
- `cancelled`;
- `returned`.

`simulated_payment_approved` permanece en el enum de pedido sólo por
compatibilidad histórica y no se usa en los flujos nuevos. La aprobación vive en
`order_payments.status = paid`; no cambia `orders.status`.

Los totales son consistentes por constraint:
`total = subtotal - discount_total + shipping_total + tax_total`. La base no
autoriza al cliente a crear o modificar pedidos; el backend debe recalcular
todos los importes con datos vigentes. `order_items.product_id` y
`order_items.variant_id` usan `ON DELETE RESTRICT`, por lo que un producto o
variante asociado con un pedido no puede eliminarse. Los snapshots sobreviven a
cambios posteriores del catálogo.

No existen columnas de tarjeta, CVV, cuenta bancaria, token de pago ni
transacción real. `simulated_payment_approved` representa únicamente el flujo de
prueba y no un cargo.

### Agregado de pagos de pedido

La migración `20260803000000_order_payments_foundation.sql` agrega
`order_payments`, `payment_submissions`, `payment_status_history` y
`payment_idempotency_keys`. Sus estados son `pending`, `submitted`,
`under_review`, `paid`, `rejected` y `refunded`; no son estados de pedido.
Importe y moneda se copian desde `orders` dentro de SQL. Las columnas
`orders.payment_status/payment_method` y sus enums permanecen temporalmente como
legacy compatible, pero las lecturas y acciones nuevas usan el agregado. El
detalle completo está en [ORDER_PAYMENTS.md](./ORDER_PAYMENTS.md).

### Outbox de notificaciones

`notification_events` deriva hechos de `order_status_history` y
`payment_status_history` mediante triggers diferidos. `notification_deliveries`
mantiene destinatario, lease, intentos y resultado SMTP. Los eventos son
inmutables y la entrega es independiente de pedido, pago e inventario. Véase
[ORDER_NOTIFICATIONS.md](./ORDER_NOTIFICATIONS.md).

## 7. Asesoría, configuración y auditoría

| Tabla                      | Propósito y reglas principales                                                            |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| `advisory_sessions`        | Sesión opcionalmente ligada a perfil, contexto mínimo y estado.                           |
| `advisory_answers`         | Respuesta JSON por clave de pregunta dentro de una sesión.                                |
| `advisory_recommendations` | Productos o variantes recomendados, orden, razón y autor.                                 |
| `advisory_requests`        | Solicitud con contacto mínimo, canal coherente, consentimiento, seguimiento y asignación. |
| `pages`                    | Contenido estructurado con borrador, publicación o archivado.                             |
| `site_settings`            | Configuración JSON por clave; `is_public` es metadato y no concede acceso por sí mismo.   |
| `audit_logs`               | Registro inmutable de actor, acción, entidad, metadatos no sensibles y request opcional.  |

Las tablas de asesoría no tienen políticas cliente en esta fase. Un endpoint
server-side deberá validar tamaño, formato, consentimiento, rate limiting y
minimización antes de escribirlas. `audit_logs.metadata` no debe guardar
secretos ni copias innecesarias de datos personales.

## 8. Relaciones e integridad

- `profiles` se relaciona 1:1 con `auth.users`.
- Un perfil tiene roles, direcciones, carritos, pedidos y opcionalmente sesiones
  o solicitudes de asesoría.
- Una categoría puede tener categoría padre y muchos productos. La jerarquía no
  admite autorreferencias ni ciclos; un padre nuevo debe estar activo.
- Un producto pertenece a marca y categoría; tiene variantes e imágenes.
- Cada registro de inventario pertenece a una variante.
- Un carrito contiene variantes; un pedido conserva partidas y un historial.
- Una sesión de asesoría contiene respuestas y recomendaciones.
- Las FKs usadas con frecuencia tienen índices explícitos.

Los borrados en cascada se limitan a datos subordinados que carecen de valor
independiente, como partidas de carrito e imágenes. Pedidos, partidas, movimientos
y logs se conservan o son inmutables para proteger trazabilidad.

Marcas y categorías usan `active`/`archived`; no existe borrado físico
operativo. La migración `20260731000000_catalog_taxonomy_management.sql` impide
archivar una taxonomía con productos activos o publicados, e impide archivar
categorías con hijas activas. Los productos históricos conservan sus FKs. Una
referencia archivada actual puede conservarse al editar, pero cambiar, publicar,
activar o restaurar un producto exige referencias activas. `sort_order` es un
entero no negativo y no representa una interfaz drag-and-drop.

## 9. Acceso

El detalle por tabla está en `docs/SECURITY_REQUIREMENTS.md`. En resumen:

- público: lectura sólo del catálogo estrictamente relacionado con productos
  activos, publicados y no archivados;
- usuario autenticado: perfil propio, lectura de direcciones propias, carrito
  propio y lectura de pedidos propios;
- operador y administrador: la base de catálogo usa Server Components y Server
  Actions con una sesión autenticada, validación de rol en base de datos, RLS y
  privilegios de columna; las demás operaciones elevadas continúan requiriendo
  un backend específico, mínimo privilegio y auditoría;
- `service_role`: sólo en un entorno seguro de servidor, nunca en el navegador.

## 10. Storage de imágenes

El bucket público exclusivo `product-images` limita cada objeto a 5 MiB y
acepta sólo JPEG, PNG y WebP. La ruta usa UUID aleatorios y nunca el nombre
original. La lectura directa es pública porque forma parte del catálogo; las
altas y bajas exigen una sesión operator/admin validada con
`can_manage_catalog()`.

Storage y Postgres no comparten una transacción distribuida. Al subir, la
aplicación elimina el objeto si falla el registro. Al borrar, conserva un
snapshot, elimina el registro y promueve la siguiente principal dentro de una
transacción SQL, elimina Storage y restaura el registro si Storage falla.

## 11. Decisiones pendientes

- Transiciones de estado permitidas y autorización por transición.
- Procedimiento transaccional de reservas, ventas y devoluciones de inventario.
- IVA, facturación, descuentos y política final de envíos/devoluciones.
- Aviso de privacidad, retención, anonimización y derechos ARCO.
- Redimensionado, recorte, compresión, moderación y optimización avanzada de
  imágenes.
- Pruebas automatizadas positivas y negativas de RLS con usuarios reales de
  prueba.
- Auditoría persistente de cambios de catálogo; esta primera base conserva
  `updated_at`, pero `products` no tiene `created_by` ni `updated_by`.

## 12. Partner Score y Tiers

La extensión Marketplace PR 4 se documenta en
`docs/MARKETPLACE_PARTNER_SCORE_TIERS.md`. Su fuente primaria es append-only
(`partner_score_events`, `partner_ratings`, penalties e historial); los snapshots
explican cada cálculo y `partner_score_tier_state` funciona únicamente como cache
actual. Las métricas diarias reconstruyen volumen desde status e inventory
movements Marketplace, sin tocar inventario first-party.
