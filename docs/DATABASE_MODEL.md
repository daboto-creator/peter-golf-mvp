# Modelo de datos

## 1. Estado y alcance

La versión 1 del esquema del MVP está implementada como migraciones SQL
versionadas en `supabase/migrations/`. Incluye usuarios y roles, catálogo,
variantes, inventario, carrito, pedidos de prueba, asesoría, configuración y
auditoría mínima. No incluye pagos reales, datos de tarjeta, Stripe, facturación,
paqueterías ni reservas automáticas de inventario.

La migración aplicada que habilita `pgcrypto` permanece sin cambios. Las
migraciones posteriores crean, en orden:

1. tipos, dominios, función de `updated_at`;
2. perfiles, roles y direcciones;
3. catálogo, variantes e imágenes;
4. inventario y movimientos;
5. carrito y pedidos;
6. asesoría, contenido, configuración y auditoría;
7. RLS y políticas.

`supabase/seed.sql` agrega únicamente datos ficticios de desarrollo.

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

| Tabla        | Propósito y relaciones clave                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------- |
| `profiles`   | Extiende `auth.users`; nombre visible, teléfono opcional, locale y archivado.                  |
| `roles`      | Roles controlados `customer`, `operator` y `admin`.                                            |
| `user_roles` | Relación N:M entre perfiles y roles; conserva quién asignó el rol.                             |
| `addresses`  | Direcciones mexicanas de un perfil; CP de cinco dígitos, dirección predeterminada y archivado. |

Los cambios de roles no están disponibles mediante políticas cliente. El
backend deberá validar al actor y registrar la operación privilegiada.

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

## 5. Inventario

| Tabla                 | Propósito y reglas principales                                                          |
| --------------------- | --------------------------------------------------------------------------------------- |
| `inventory`           | Existencia por variante; cantidad física, reservada y punto de reorden.                 |
| `inventory_movements` | Libro inmutable de recepciones, ajustes, reservas, liberaciones, ventas y devoluciones. |

`quantity_on_hand`, `quantity_reserved` y `reorder_point` nunca pueden ser
negativos. La cantidad reservada no puede superar la existencia. Cada movimiento
conserva cantidades posteriores, motivo, actor y referencia opcional completa.
Las mutaciones operativas deberán actualizar inventario y crear su movimiento
en una misma transacción server-side.

## 6. Carrito y pedidos

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
- Una categoría puede tener categoría padre y muchos productos.
- Un producto pertenece a marca y categoría; tiene variantes e imágenes.
- Cada registro de inventario pertenece a una variante.
- Un carrito contiene variantes; un pedido conserva partidas y un historial.
- Una sesión de asesoría contiene respuestas y recomendaciones.
- Las FKs usadas con frecuencia tienen índices explícitos.

Los borrados en cascada se limitan a datos subordinados que carecen de valor
independiente, como partidas de carrito e imágenes. Pedidos, partidas, movimientos
y logs se conservan o son inmutables para proteger trazabilidad.

## 9. Acceso

El detalle por tabla está en `docs/SECURITY_REQUIREMENTS.md`. En resumen:

- público: lectura sólo del catálogo estrictamente relacionado con productos
  activos, publicados y no archivados;
- usuario autenticado: perfil propio, lectura de direcciones propias, carrito
  propio y lectura de pedidos propios;
- operador y administrador: sin acceso privilegiado directo desde el cliente;
  las operaciones elevadas requieren backend server-side, validación de rol,
  mínimo privilegio y auditoría;
- `service_role`: sólo en un entorno seguro de servidor, nunca en el navegador.

## 10. Decisiones pendientes

- Flujo de alta de `profiles` al habilitar Auth.
- Transiciones de estado permitidas y autorización por transición.
- Procedimiento transaccional de reservas y concurrencia de inventario.
- IVA, facturación, descuentos y política final de envíos/devoluciones.
- Aviso de privacidad, retención, anonimización y derechos ARCO.
- Buckets y políticas de Storage para imágenes.
- Pruebas automatizadas positivas y negativas de RLS con usuarios reales de
  prueba.
