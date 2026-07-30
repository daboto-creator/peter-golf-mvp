# Modelo de datos

## 1. Estado y alcance

Este documento propone un modelo conceptual para una fase posterior. Existe una
estructura local de Supabase para probar migraciones, pero no hay tablas de
negocio ni se ha creado o vinculado un proyecto remoto.

Recursos previstos:

- Organización: `daboto-creator's Org`
- Staging: `peter-golf-staging`
- Producción futura: `peter-golf-production`

Los ambientes deberán ser proyectos separados, sin compartir secretos ni datos operativos.

## 2. Convenciones

- Identificadores UUID.
- Fechas en `timestamptz`, almacenadas en UTC.
- Importes en centavos enteros y moneda ISO 4217 (`MXN` inicialmente).
- Nombres técnicos en `snake_case`; textos visibles en español.
- `created_at` y `updated_at` en entidades mutables.
- Borrado lógico o archivado donde exista obligación de conservar trazabilidad.
- Restricciones y enums controlados para estados; no depender sólo de validación de interfaz.

## 3. Entidades propuestas

### `profiles`

Extensión mínima del usuario autenticado futuro.

| Campo                      | Tipo conceptual | Notas                                  |
| -------------------------- | --------------- | -------------------------------------- |
| `id`                       | uuid            | Referencia al usuario de autenticación |
| `display_name`             | text            | Opcional                               |
| `role`                     | enum            | `customer`, `staff`, `admin`           |
| `created_at`, `updated_at` | timestamptz     | Auditoría                              |

### `categories`

| Campo          | Tipo conceptual | Notas                |
| -------------- | --------------- | -------------------- |
| `id`           | uuid            | PK                   |
| `name`, `slug` | text            | `slug` único         |
| `status`       | enum            | `active`, `archived` |
| `sort_order`   | integer         | No negativo          |

### `products`

| Campo                                      | Tipo conceptual | Notas                                      |
| ------------------------------------------ | --------------- | ------------------------------------------ |
| `id`                                       | uuid            | PK                                         |
| `category_id`                              | uuid            | FK                                         |
| `name`, `slug`, `description`              | text            | `slug` único                               |
| `condition`                                | enum            | `new`, `used`                              |
| `availability_mode`                        | enum            | `in_stock`, `special_order`                |
| `status`                                   | enum            | `draft`, `published`, `paused`, `archived` |
| `price_amount`                             | bigint          | Centavos; no negativo                      |
| `currency`                                 | char(3)         | `MXN`                                      |
| `price_is_estimate`                        | boolean         | Relevante para sobre pedido                |
| `condition_notes`                          | text            | Obligatorio para seminuevos                |
| `lead_time_min_days`, `lead_time_max_days` | integer         | Para sobre pedido                          |
| `created_at`, `updated_at`                 | timestamptz     | Auditoría                                  |

Restricciones: seminuevos requieren notas de condición; productos sobre pedido requieren rango de plazo o una nota explícita; sólo `published` es público.

### `product_images`

| Campo                   | Tipo conceptual | Notas                           |
| ----------------------- | --------------- | ------------------------------- |
| `id`, `product_id`      | uuid            | PK y FK                         |
| `storage_path`          | text            | No URL privilegiada persistente |
| `alt_text`              | text            | Accesibilidad                   |
| `sort_order`            | integer         | Orden estable                   |
| `is_condition_evidence` | boolean         | Evidencia para seminuevos       |

### `inventory`

| Campo        | Tipo conceptual | Notas                                |
| ------------ | --------------- | ------------------------------------ |
| `product_id` | uuid            | PK/FK                                |
| `on_hand`    | integer         | No negativo                          |
| `reserved`   | integer         | No negativo y no mayor que `on_hand` |
| `updated_at` | timestamptz     | Última actualización                 |

Aplica principalmente a `in_stock`. La disponibilidad calculada es `on_hand - reserved`.

### `inventory_movements`

Registro inmutable de ajustes, reservas y liberaciones con cantidad, motivo, referencia, actor y fecha. Será la fuente de auditoría; las mutaciones deberán ser transaccionales.

### `advice_requests`

| Campo                       | Tipo conceptual | Notas                       |
| --------------------------- | --------------- | --------------------------- |
| `id`                        | uuid            | PK                          |
| `product_id`, `customer_id` | uuid            | Opcionales                  |
| `name`, `email`, `phone`    | text            | Recopilación mínima         |
| `preferred_channel`         | enum            | Canales aprobados           |
| `message`                   | text            | Contexto del cliente        |
| `consent_at`                | timestamptz     | Evidencia de consentimiento |
| `status`, `assigned_to`     | enum, uuid      | Seguimiento                 |
| `created_at`, `updated_at`  | timestamptz     | Auditoría                   |

### `test_orders` y `test_order_items`

Representan intención de compra sin pago.

`test_orders` conserva contacto o referencia al cliente, dirección necesaria sólo cuando corresponda a la prueba, estado, moneda y totales calculados por servidor. `test_order_items` guarda producto, cantidad y una instantánea del nombre, condición y precio de referencia.

No habrá campos para tarjeta, CVV, token de pago ni estado de transacción real.

### `audit_events`

Eventos relevantes con actor, acción, entidad, identificador, metadatos no sensibles y fecha. No debe almacenar secretos ni copias innecesarias de datos personales.

## 4. Relaciones

- Una categoría tiene muchos productos.
- Un producto tiene imágenes, inventario y movimientos.
- Un producto puede originar solicitudes de asesoría y partidas de pedidos de prueba.
- Un perfil puede crear solicitudes; miembros del equipo pueden atenderlas.
- Un pedido de prueba contiene una o más partidas.

## 5. Acceso y RLS

RLS será obligatoria en toda tabla expuesta por Supabase:

- público: lectura exclusiva de productos publicados y sus datos públicos;
- cliente: acceso sólo a sus propios registros, cuando exista autenticación;
- staff: acceso operativo mínimo según responsabilidad;
- admin: acciones privilegiadas explícitas;
- service role: sólo en servidor seguro, nunca en el navegador.

Las políticas se probarán con casos positivos y negativos antes de desplegar. Las vistas, funciones y buckets también requieren revisión de exposición.

## 6. Decisiones pendientes

- Autenticación requerida o flujo invitado para solicitudes.
- Variantes/SKU y compatibilidad de equipo.
- Reservas de inventario y concurrencia.
- Dirección, cobertura y cotización de envío.
- IVA, facturación y retención de documentos.
- Políticas de conservación y anonimización.
- Búsqueda, analítica y alcance del panel operativo.
