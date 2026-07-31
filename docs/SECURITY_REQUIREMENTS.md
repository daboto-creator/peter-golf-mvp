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
- leer únicamente sus pedidos, partidas e historial.

El cliente no puede asignar roles, modificar direcciones, crear pedidos, ajustar
inventario ni escribir asesorías o configuración directamente. La única
excepción operativa actual son las mutaciones acotadas de `products`, protegidas
por Server Actions, RLS, función de autorización y privilegios de columna.

## 4. Matriz de acceso por tabla

`Propio` significa que RLS compara el registro con `auth.uid()`. `Catálogo`
significa que se cumplen todos los filtros públicos anteriores. `Backend`
significa que no hay política cliente y la operación requiere un proceso
server-side autorizado. Las columnas de operador y administrador describen el
canal permitido, no un permiso implícito por poseer el rol.

| Tabla                      | Lectura anónima | Lectura autenticada           | Creación cliente    | Actualización cliente | Eliminación cliente | Operator                 | Admin                    |
| -------------------------- | --------------- | ----------------------------- | ------------------- | --------------------- | ------------------- | ------------------------ | ------------------------ |
| `profiles`                 | No              | Propio                        | Propio              | Propio                | No                  | Backend, alcance mínimo  | Backend, auditado        |
| `roles`                    | No              | No                            | No                  | No                    | No                  | Backend, sólo lectura    | Backend, auditado        |
| `user_roles`               | No              | No                            | No                  | No                    | No                  | No                       | Backend, auditado        |
| `addresses`                | No              | Propias                       | No                  | No                    | No                  | Backend, soporte         | Backend, auditado        |
| `brands`                   | Catálogo        | Catálogo                      | No                  | No                    | No                  | Backend, autorizado      | Backend, auditado        |
| `categories`               | Catálogo        | Catálogo                      | No                  | No                    | No                  | Backend, autorizado      | Backend, auditado        |
| `products`                 | Catálogo        | Catálogo o gestión autorizada | Server Action + RLS | Server Action + RLS   | No                  | Catálogo base autorizado | Catálogo base autorizado |
| `product_variants`         | Catálogo        | Catálogo                      | No                  | No                    | No                  | Backend, autorizado      | Backend, auditado        |
| `product_images`           | Catálogo        | Catálogo                      | No                  | No                    | No                  | Server Action + RLS      | Server Action + RLS      |
| `inventory`                | No              | No                            | No                  | No                    | No                  | Backend transaccional    | Backend, auditado        |
| `inventory_movements`      | No              | No                            | No                  | No                    | No                  | Backend; sólo insertar   | Backend; sólo insertar   |
| `shipping_methods`         | No              | No                            | No                  | No                    | No                  | Backend, autorizado      | Backend, auditado        |
| `carts`                    | No              | Propios                       | Propio              | Propio                | Propio              | Backend, soporte         | Backend, auditado        |
| `cart_items`               | No              | De carrito propio             | De carrito propio   | De carrito propio     | De carrito propio   | Backend, soporte         | Backend, auditado        |
| `orders`                   | No              | Propios                       | No                  | No                    | No                  | Backend, autorizado      | Backend, auditado        |
| `order_items`              | No              | De pedido propio              | No                  | No                    | No                  | Backend, autorizado      | Backend, auditado        |
| `order_status_history`     | No              | De pedido propio              | No                  | No                    | No                  | Backend; sólo insertar   | Backend; sólo insertar   |
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

La gestión base de productos implementada usa la llave pública con la sesión del
usuario y permanece sujeta a RLS; no usa `service_role`. Asignación de roles,
administración de direcciones, costos, inventario, movimientos, métodos de
envío, creación/cambio de pedidos, asesorías, páginas, settings y audit logs
siguen requiriendo un backend futuro específico y auditado.

Las políticas operativas permiten:

- leer productos de cualquier estado a `operator` y `admin`;
- leer únicamente marcas y categorías activas;
- insertar y actualizar las columnas comerciales revisadas de `products`;
- publicar, despublicar, archivar y restaurar sin eliminación física.

No conceden `DELETE` de productos, acceso a `cost`, ni mutaciones de marcas,
categorías o variantes. La lectura pública conserva sus filtros previos.

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

Antes de recopilar contacto se debe explicar finalidad y obtener consentimiento.
El backend de asesoría debe aplicar minimización y rate limiting. Antes de
producción siguen pendientes aviso de privacidad, conservación, eliminación y
derechos ARCO conforme a la normativa aplicable.

## 9. Validación y salida a producción

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
