# Requisitos de seguridad

## 1. Principios

- Mínimo privilegio, denegación por defecto y defensa en profundidad.
- Recopilación mínima de datos y privacidad desde el diseño.
- Separación estricta de staging y producción.
- Controles de servidor como autoridad; la interfaz y RLS se complementan.
- Registro de acciones sensibles sin secretos ni datos personales innecesarios.

## 2. Secretos y ambientes

- Nunca guardar secretos en Git, documentación, código cliente, logs o errores.
- No usar llaves live, secretos, endpoints o datos de producción en staging.
- No exponer `service_role` de Supabase al navegador.
- Sólo variables expresamente públicas pueden llevar el prefijo público de
  Next.js.
- Mantener separados `peter-golf-staging` y el futuro
  `peter-golf-production`.
- Mantener también proyectos Vercel separados. Preview y staging usan sólo la
  llave publishable del Supabase de staging.
- En `APP_ENV=staging`, exigir URLs HTTPS no locales, pagos y notificaciones
  deshabilitados, ausencia de `service_role` y ausencia de variables SMTP.
- Usar cuentas ficticias precreadas y confirmadas hasta que exista una decisión
  explícita sobre correo de Auth; no asumir registro público arbitrario.
- Servir `noindex` en todo ambiente no productivo.

## 3. RLS implementada

Todas las tablas de `public` tienen RLS activada. La ausencia de política deniega
la operación. No existe ninguna política `USING (true)`.

La lectura anónima se limita a:

- productos `active`, `published` y no archivados;
- marcas y categorías activas que tengan al menos un producto público;
- variantes activas y no archivadas de un producto público;
- imágenes asociadas con un producto público.

Esta apertura está justificada porque esos registros forman el catálogo mínimo
que necesita el visitante. Borradores, productos archivados, costos, inventario
y cualquier dato personal continúan fuera del acceso anónimo.

Además de RLS, los privilegios SQL de `products`, `product_variants`, `brands`,
`categories` y `product_images` se conceden por columnas revisadas. Esto permite
las relaciones públicas de PostgREST sin habilitar `SELECT` amplio ni exponer
`cost`.

Una persona autenticada puede:

- crear, leer y actualizar sólo su `profile`;
- leer sólo sus direcciones;
- crear, leer, actualizar y eliminar únicamente sus carritos y partidas;
- listar y consultar únicamente la proyección segura de sus pedidos mediante
  RPC; no tiene lectura directa de las tablas de pedidos.

El cliente no puede asignar roles, escribir directamente direcciones, crear pedidos, ajustar
inventario directamente ni escribir asesorías o configuración. Las excepciones
operativas actuales son las mutaciones acotadas de `products`, `brands`,
`categories`, `product_images` e inventario mediante RPC, protegidas por Server
Actions, RLS, función de autorización y privilegios mínimos.

## 4. Matriz de acceso por tabla

`Propio` significa que RLS compara el registro con `auth.uid()`. `Catálogo`
significa que se cumplen todos los filtros públicos anteriores. `Backend`
significa que no hay política cliente y la operación requiere un proceso
server-side autorizado. Las columnas de operador y administrador describen el
canal permitido, no un permiso implícito por poseer el rol.

| Tabla                      | Lectura anónima | Lectura autenticada           | Creación cliente    | Actualización cliente | Eliminación cliente | Operator                 | Admin                    |
| -------------------------- | --------------- | ----------------------------- | ------------------- | --------------------- | ------------------- | ------------------------ | ------------------------ |
| `profiles`                 | No              | Propio                        | No                  | RPC de campos propios | No                  | Backend, alcance mínimo  | Backend, auditado        |
| `roles`                    | No              | No                            | No                  | No                    | No                  | Backend, sólo lectura    | Backend, auditado        |
| `user_roles`               | No              | No                            | No                  | No                    | No                  | No                       | Backend, auditado        |
| `addresses`                | No              | Propias                       | RPC propia          | RPC propia            | RPC propia          | Sin acceso adicional     | Sin acceso adicional     |
| `brands`                   | Catálogo        | Catálogo o gestión autorizada | Server Action + RLS | Server Action + RLS   | No                  | Catálogo autorizado      | Catálogo autorizado      |
| `categories`               | Catálogo        | Catálogo o gestión autorizada | Server Action + RLS | Server Action + RLS   | No                  | Catálogo autorizado      | Catálogo autorizado      |
| `products`                 | Catálogo        | Catálogo o gestión autorizada | Server Action + RLS | Server Action + RLS   | No                  | Catálogo base autorizado | Catálogo base autorizado |
| `product_variants`         | Catálogo        | Catálogo                      | No                  | No                    | No                  | Backend, autorizado      | Backend, auditado        |
| `product_images`           | Catálogo        | Catálogo                      | No                  | No                    | No                  | Server Action + RLS      | Server Action + RLS      |
| `inventory`                | No              | Sólo gestión autorizada       | No                  | No                    | No                  | RPC transaccional        | RPC transaccional        |
| `inventory_movements`      | No              | Sólo gestión autorizada       | No                  | No                    | No                  | RPC; sólo insertar       | RPC; sólo insertar       |
| `shipping_methods`         | No              | No                            | No                  | No                    | No                  | Backend, autorizado      | Backend, auditado        |
| `carts`                    | No              | Propios                       | Propio              | Propio                | Propio              | Backend, soporte         | Backend, auditado        |
| `cart_items`               | No              | De carrito propio             | De carrito propio   | De carrito propio     | De carrito propio   | Backend, soporte         | Backend, auditado        |
| `cart_idempotency_keys`    | No              | Sólo contexto RPC propio      | Sólo RPC            | No                    | No                  | Backend, soporte         | Backend, auditado        |
| `orders`                   | No              | Proyección RPC propia         | No                  | No                    | No                  | Detalle completo         | Detalle completo         |
| `order_items`              | No              | Snapshots por RPC propia      | No                  | No                    | No                  | Detalle completo         | Detalle completo         |
| `order_status_history`     | No              | Estado/fecha por RPC propia   | No                  | No                    | No                  | Detalle completo         | Detalle completo         |
| `order_idempotency_keys`   | No              | Sólo actor/contexto RPC       | Sólo RPC            | No                    | No                  | RPC autorizada           | RPC autorizada           |
| `order_payments`           | No              | Proyección RPC propia         | No                  | Sólo RPC simulada     | No                  | RPC autorizada           | RPC autorizada           |
| `payment_submissions`      | No              | Proyección RPC propia         | Sólo RPC simulada   | No                    | No                  | Lectura autorizada       | Lectura autorizada       |
| `payment_status_history`   | No              | Proyección RPC propia         | No                  | No                    | No                  | RPC; inmutable           | RPC; inmutable           |
| `payment_idempotency_keys` | No              | Sólo actor/contexto RPC       | Sólo RPC            | No                    | No                  | RPC autorizada           | RPC autorizada           |
| `notification_events`      | No              | No                            | No                  | No                    | No                  | RPC operativa            | RPC operativa            |
| `notification_deliveries`  | No              | No                            | No                  | No                    | No                  | RPC operativa            | RPC operativa            |
| `advisory_sessions`        | No              | No                            | No                  | No                    | No                  | Backend, autorizado      | Backend, auditado        |
| `advisory_answers`         | No              | No                            | No                  | No                    | No                  | Backend, autorizado      | Backend, auditado        |
| `advisory_recommendations` | No              | No                            | No                  | No                    | No                  | Backend, autorizado      | Backend, auditado        |
| `advisory_requests`        | No              | No                            | No                  | No                    | No                  | Backend, autorizado      | Backend, auditado        |
| `pages`                    | No              | No                            | No                  | No                    | No                  | Backend, autorizado      | Backend, auditado        |
| `site_settings`            | No              | No                            | No                  | No                    | No                  | Backend, sólo lectura    | Backend, auditado        |
| `audit_logs`               | No              | No                            | No                  | No                    | No                  | Backend; sólo insertar   | Backend; sólo insertar   |

## 5. Operaciones administrativas server-side

Los roles `operator` y `admin` están modelados en `roles` y `user_roles`. Para la
gestión base de productos reciben políticas RLS estrictamente acotadas y
privilegios de columna que excluyen `cost`. La función
`public.can_manage_catalog()` es `security definer`, fija `search_path` vacío,
no acepta parámetros controlados por el cliente y sólo devuelve un booleano
calculado con `auth.uid()`. Así evita recursión de RLS y no expone la lista de
roles.

Un backend que realice una operación privilegiada debe:

1. validar sesión y autorización contra `user_roles`;
2. limitar la acción al permiso concreto del operador o administrador;
3. validar entradas y recalcular importes en servidor;
4. ejecutar cambios relacionados en una transacción;
5. escribir auditoría sin datos sensibles;
6. usar el canal de credenciales mínimo previsto para esa operación.

La gestión base de catálogo e inventario usa la llave pública con la sesión del
usuario y permanece sujeta a RLS; no usa `service_role`. Asignación de roles,
administración de direcciones, costos, métodos de
envío, creación/cambio de pedidos, asesorías, páginas, settings y audit logs
siguen requiriendo un backend futuro específico y auditado.

Las políticas operativas permiten:

- leer productos de cualquier estado a `operator` y `admin`;
- leer todas las marcas y categorías sólo a `operator` y `admin`;
- insertar y actualizar las columnas revisadas de marcas y categorías;
- insertar y actualizar las columnas comerciales revisadas de `products`;
- crear atómicamente el producto y su variante base;
- reparar explícitamente un producto histórico sin ninguna variante;
- publicar, despublicar, archivar y restaurar sin eliminación física.

No conceden `DELETE` de productos, marcas o categorías, acceso a `cost`, ni
gestión general de variantes. `authenticated` sólo recibe `INSERT` de
`product_id`, `sku` y `name` en `product_variants`; RLS exige operator/admin,
producto no archivado, ausencia total de variantes y coincidencia exacta de SKU
y nombre con el producto. Los demás campos permanecen en valores base seguros y
`cost` no puede enviarse ni leerse. La lectura pública conserva sus filtros.

`create_product_with_base_variant` y `repair_product_base_variant` son
`security invoker`, fijan `search_path` vacío y vuelven a comprobar
`can_manage_catalog()`. La primera queda sujeta a RLS en ambos inserts, de modo
que un error intermedio revierte la operación completa. La segunda bloquea la
fila de producto, no acepta archivados y sólo es idempotente para la variante
canónica. No usa `service_role`, `user_metadata`, backfill ni campos ocultos como
autoridad.

`update_product_with_base_variant` conserva el modelo `security invoker`.
Bloquea `products` con `FOR UPDATE`, compara `status` y `published` con el
snapshot esperado y exige exactamente una variante canónica antes de escribir.
RLS sólo permite actualizar `sku` y `name` de `product_variants` mientras la RPC
mantiene un contexto local privado; un trigger aplica el mismo requisito a
cambios directos de `products.sku` o `products.name`. La función no selecciona,
devuelve ni modifica `cost`, y una colisión revierte ambas actualizaciones.

La migración de taxonomías agrega triggers `security invoker` con `search_path`
vacío. Rechazan ciclos, padres archivados nuevos, archivado con productos
activos/publicados y categorías archivadas con hijas activas. Un trigger de
producto permite conservar una FK histórica archivada, pero exige referencias
activas al cambiarla, publicar, activar o restaurar. Sus funciones no pueden
ejecutarse directamente por `anon` ni `authenticated`.

La detección de ciclos recorre con un CTE recursivo los ancestros del padre
solicitado y rechaza la operación si encuentra la categoría editada. La función
se ejecuta sólo como trigger, conserva los permisos del usuario (`security
invoker`), fija `search_path` vacío y tiene `EXECUTE` revocado para clientes.

La migración de imágenes amplía únicamente `product_images`: operator/admin
recibe privilegios de columna mínimos y políticas RLS para alta, edición y
baja. Las funciones `register_product_image`, `update_product_image`,
`reorder_product_images`, `remove_product_image` y `restore_product_image` son
`security invoker`, fijan `search_path` vacío, comprueban
`can_manage_catalog()` y validan pertenencia al producto. Principal y promoción
se serializan bloqueando la fila del producto.

### Storage público de producto

- Bucket exclusivo `product-images`, público para lectura directa del catálogo.
- Sólo rutas
  `products/{product_id}/{uuid}.{jpg|png|webp}` validadas por aplicación,
  constraint y políticas.
- Límite 5 MiB y allowlist exacta `image/jpeg`, `image/png`, `image/webp`.
- Subida y eliminación requieren `authenticated`, `can_manage_catalog()`, un
  producto existente y el prefijo de ese producto.
- No existe escritura general para `authenticated`, actualización de objetos,
  `service_role`, SVG, URLs firmadas ni nombres originales en la ruta.

La migración correctiva `20260730001200_fix_product_image_storage_policies.sql`
califica la ruta como `storage.objects.name` dentro del subquery que comprueba
la existencia del producto. Sin esa calificación, PostgreSQL resolvía `name`
como `products.name` y evaluaba `foldername` sobre el nombre comercial en vez de
sobre la ruta del objeto. La corrección reemplaza sólo las políticas de `INSERT`
y `DELETE` de objetos y conserva todos sus controles anteriores.

## 6. Entradas, precios e inventario

La gestión manual de pedidos usa `can_manage_orders()` y
`requireOrdersManager()` para operator/admin, RPC `security invoker`, RLS,
triggers de contexto, versión optimista e idempotencia ligada a actor y payload.
Los precios, snapshots y totales se resuelven en SQL; el navegador no es
autoridad. Véase [ORDER_MANAGEMENT.md](./ORDER_MANAGEMENT.md).

- Validar en servidor tipo, formato, tamaño, rango, pertenencia y transición.
- Normalizar entradas y codificar salidas según contexto.
- Aplicar límites de tamaño, frecuencia, idempotencia y mitigación de abuso.
- No confiar en IDs, precios, condición, stock, disponibilidad ni totales
  enviados por el cliente.
- Calcular descuento, impuesto, envío y total exclusivamente en servidor.
- Proteger ajustes y reservas con transacciones y controles de concurrencia.
- Registrar actor y motivo de cambios de inventario o precio.

Los constraints protegen importes no negativos, consistencia de totales,
cantidades de inventario y snapshots, pero no sustituyen las reglas del backend.

La lectura de pedidos del cliente usa `list_customer_orders()` y
`get_customer_order(uuid)`, ambas `security invoker` y con `search_path` vacío.
RLS exige `auth.uid()`, origen web y un contexto transaccional local que las RPC
retiran antes de devolver. Esto es necesario porque clientes y operadores
comparten el rol SQL `authenticated`: los grants de tabla que soportan las RPC
operativas no pueden diferenciar el rol de negocio. Las políticas
`can_manage_orders()` siguen dando a operator/admin el detalle completo; el
cliente sólo recibe una proyección explícita con historial sanitizado de estados
y sin notas, actores, motivos internos ni llaves de idempotencia.

La gestión de inventario usa Server Actions que ejecutan
`requireCatalogManager()` y RPC `security invoker` con `search_path` vacío. RLS
valida nuevamente `can_manage_catalog()`. `adjust_inventory` bloquea el producto
y la fila de inventario, revalida el saldo y escribe saldo y movimiento de forma
atómica. Los grants de escritura por columna existen sólo para soportar
`security invoker`; triggers exigen un contexto transaccional privado que sólo
establecen las RPC. Por eso se rechazan tanto un `UPDATE inventory` como un
`INSERT inventory_movements` directo. El contexto se desactiva antes de devolver
el resultado.

Cada ajuste exige UUID de idempotencia único, actor `auth.uid()`, cantidad
entera no nula y motivo de 3 a 500 caracteres. No se devuelve texto SQL interno
a la interfaz. No existe permiso `DELETE` ni `UPDATE` de movimientos.

## 7. Funciones y trazabilidad

Las funciones de trigger fijan `search_path` vacío. Su ejecución directa fue
revocada a `public`, `anon` y `authenticated`. `record_order_status_change()` es
`security definer` únicamente para que el trigger pueda escribir el historial;
no acepta argumentos controlados por el cliente.

`handle_new_auth_user()` también es `security definer`, fija `search_path` vacío
y sólo se ejecuta mediante el trigger de `auth.users`. Valida la metadata de
nombre, crea el perfil del mismo UUID y asigna exclusivamente el rol `customer`.
No acepta roles desde metadata ni concede `operator` o `admin`.

`can_manage_catalog_references()` también fija `search_path` vacío, devuelve
siempre `false` a quien no tenga permiso operativo y sólo permite que las
políticas acepten una marca y categoría activas. No concede ejecución a `anon`.

`inventory_movements`, `order_status_history` y `audit_logs` rechazan `UPDATE` y
`DELETE`. La corrección de un evento debe representarse con otro evento, no
reescribiendo el historial.

## 8. Pagos y datos personales

El MVP no acepta pagos reales. No se integra Stripe ni otro proveedor y no se
almacenan tarjeta, CVV, cuenta bancaria, token o credencial financiera.
`simulated_payment_approved` es un estado de prueba y nunca debe mostrarse como
un cargo real.

El agregado simulado de pagos aplica RLS sin acceso `anon`, escritura sólo por
RPC `security invoker`, locks, versión e idempotencia. El cliente sólo opera su
pedido web confirmado y recibe una proyección que omite actores, motivos y claves
internas. `PAYMENTS_MODE` es server-only y se complementa con un setting privado
en base. No se usa `service_role`, datos bancarios reales, comprobantes ni
Storage. Véase [ORDER_PAYMENTS.md](./ORDER_PAYMENTS.md).

Antes de recopilar contacto se debe explicar finalidad y obtener consentimiento.
El backend de asesoría debe aplicar minimización y rate limiting. Antes de
producción siguen pendientes aviso de privacidad, conservación, eliminación y
derechos ARCO conforme a la normativa aplicable.

## 9. Hosting, caché y despliegue de staging

El proyecto Vercel de staging usa `main` como rama estable y un alias canónico
`vercel.app`. La producción futura no comparte proyecto, variables ni Supabase.
Los previews no dependen de Auth y usan el origen canónico de staging para los
callbacks configurados.

No existe service worker, PWA ni caché persistente del catálogo. Las rutas que
dependen de cookies permanecen dinámicas. Los assets de Next.js tienen nombres
con hash y cada deployment de Vercel es inmutable, por lo que el rollback del
frontend selecciona un deployment anterior en lugar de mezclar artefactos.

`GET /api/health/supabase` es dinámico, usa `Cache-Control: no-store`, selecciona
como máximo el `id` de una marca visible y sólo responde estado, ambiente,
timestamp y nombre del servicio. No devuelve URLs, llaves, filas, PII, errores
internos ni stack traces.

Inbucket/Mailpit sólo existe localmente. Preview y staging usan
`NOTIFICATIONS_MODE=disabled`, no configuran SMTP y no reclaman la outbox. Una
CSP se difiere hasta poder validar Auth, Server Actions, Storage e imágenes; no
se agrega una política improvisada.

Antes de las 10 migraciones pendientes se exige respaldo lógico inmediato, dry
run exacto y autorización separada. Se preservan datos y no se aplica seed. El
RPO es ese respaldo y el RTO objetivo es menor a cuatro horas. El rollback de
base usa restauración o migración compensatoria; `db reset --linked` está
prohibido.

## 10. Validación y salida a producción

La outbox de notificaciones se escribe desde historiales inmutables. SMTP se
procesa después del commit y sólo contra un host local en modo `test`. Las
tablas no tienen políticas cliente; las funciones operativas verifican
`can_manage_orders()`. La retención inicial de destinatarios, metadata y errores
sanitizados es de 90 días. Véase
[ORDER_NOTIFICATIONS.md](./ORDER_NOTIFICATIONS.md).

- Probar cada política con casos permitidos y denegados para `anon`,
  `authenticated`, otro usuario, operator y admin.
- Verificar aislamiento entre usuarios mediante acceso directo por UUID.
- Revisar cualquier función futura `security definer`, sus permisos y
  `search_path`.
- Mantener buckets privados por defecto y agregar políticas específicas al
  habilitar Storage.
- No desplegar operación real hasta aprobar RLS, privacidad, recuperación,
  monitoreo, control de acceso y hallazgos críticos/altos.
- El rate limiting adicional a los límites nativos de Supabase permanece como
  decisión pendiente antes de producción.
