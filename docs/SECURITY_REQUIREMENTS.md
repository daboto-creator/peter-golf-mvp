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

El cliente no puede asignar roles, modificar direcciones, crear pedidos, cambiar
estados, ajustar inventario ni escribir asesorías o configuración directamente.

## 4. Matriz de acceso por tabla

`Propio` significa que RLS compara el registro con `auth.uid()`. `Catálogo`
significa que se cumplen todos los filtros públicos anteriores. `Backend`
significa que no hay política cliente y la operación requiere un proceso
server-side autorizado. Las columnas de operador y administrador describen el
canal permitido, no un permiso implícito por poseer el rol.

| Tabla                      | Lectura anónima | Lectura autenticada | Creación cliente  | Actualización cliente | Eliminación cliente | Operator                | Admin                  |
| -------------------------- | --------------- | ------------------- | ----------------- | --------------------- | ------------------- | ----------------------- | ---------------------- |
| `profiles`                 | No              | Propio              | Propio            | Propio                | No                  | Backend, alcance mínimo | Backend, auditado      |
| `roles`                    | No              | No                  | No                | No                    | No                  | Backend, sólo lectura   | Backend, auditado      |
| `user_roles`               | No              | No                  | No                | No                    | No                  | No                      | Backend, auditado      |
| `addresses`                | No              | Propias             | No                | No                    | No                  | Backend, soporte        | Backend, auditado      |
| `brands`                   | Catálogo        | Catálogo            | No                | No                    | No                  | Backend, autorizado     | Backend, auditado      |
| `categories`               | Catálogo        | Catálogo            | No                | No                    | No                  | Backend, autorizado     | Backend, auditado      |
| `products`                 | Catálogo        | Catálogo            | No                | No                    | No                  | Backend, autorizado     | Backend, auditado      |
| `product_variants`         | Catálogo        | Catálogo            | No                | No                    | No                  | Backend, autorizado     | Backend, auditado      |
| `product_images`           | Catálogo        | Catálogo            | No                | No                    | No                  | Backend, autorizado     | Backend, auditado      |
| `inventory`                | No              | No                  | No                | No                    | No                  | Backend transaccional   | Backend, auditado      |
| `inventory_movements`      | No              | No                  | No                | No                    | No                  | Backend; sólo insertar  | Backend; sólo insertar |
| `shipping_methods`         | No              | No                  | No                | No                    | No                  | Backend, autorizado     | Backend, auditado      |
| `carts`                    | No              | Propios             | Propio            | Propio                | Propio              | Backend, soporte        | Backend, auditado      |
| `cart_items`               | No              | De carrito propio   | De carrito propio | De carrito propio     | De carrito propio   | Backend, soporte        | Backend, auditado      |
| `orders`                   | No              | Propios             | No                | No                    | No                  | Backend, autorizado     | Backend, auditado      |
| `order_items`              | No              | De pedido propio    | No                | No                    | No                  | Backend, autorizado     | Backend, auditado      |
| `order_status_history`     | No              | De pedido propio    | No                | No                    | No                  | Backend; sólo insertar  | Backend; sólo insertar |
| `advisory_sessions`        | No              | No                  | No                | No                    | No                  | Backend, autorizado     | Backend, auditado      |
| `advisory_answers`         | No              | No                  | No                | No                    | No                  | Backend, autorizado     | Backend, auditado      |
| `advisory_recommendations` | No              | No                  | No                | No                    | No                  | Backend, autorizado     | Backend, auditado      |
| `advisory_requests`        | No              | No                  | No                | No                    | No                  | Backend, autorizado     | Backend, auditado      |
| `pages`                    | No              | No                  | No                | No                    | No                  | Backend, autorizado     | Backend, auditado      |
| `site_settings`            | No              | No                  | No                | No                    | No                  | Backend, sólo lectura   | Backend, auditado      |
| `audit_logs`               | No              | No                  | No                | No                    | No                  | Backend; sólo insertar  | Backend; sólo insertar |

## 5. Operaciones administrativas server-side

Los roles `operator` y `admin` están modelados en `roles` y `user_roles`, pero
no reciben políticas RLS elevadas. Esto evita que una sesión del navegador
obtenga privilegios administrativos sólo por consultar el JWT o manipular la
interfaz.

Un backend que realice una operación privilegiada debe:

1. validar sesión y autorización contra `user_roles`;
2. limitar la acción al permiso concreto del operador o administrador;
3. validar entradas y recalcular importes en servidor;
4. ejecutar cambios relacionados en una transacción;
5. escribir auditoría sin datos sensibles;
6. usar `service_role` sólo durante esa operación y sólo en servidor.

Requieren obligatoriamente este canal: asignación de roles, administración de
direcciones, catálogo, precios, costos, inventario, movimientos, métodos de
envío, creación/cambio de pedidos, asesorías, páginas, settings y audit logs.

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
