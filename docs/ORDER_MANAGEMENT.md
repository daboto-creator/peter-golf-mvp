# Gestión operativa de pedidos manuales

## Diagnóstico y reutilización

La implementación reutiliza `orders`, `order_items`, `order_status_history`,
`products`, `product_variants`, `inventory` e `inventory_movements`. El modelo ya
tenía moneda e importes en unidades menores, snapshots de artículo, dirección en
JSON, historial inmutable, saldo no negativo y ledger inmutable. No existían los
datos de cliente no registrado, canal manual, pago informativo, actores de cada
transición, motivos, versión optimista ni un registro común de idempotencia.

La migración `20260801000000_order_management_foundation.sql` agrega sólo esos
campos, tres enums controlados y `order_idempotency_keys`. `orders.user_id` pasa a
ser opcional porque una venta por teléfono o WhatsApp no debe crear un perfil
ficticio; los pedidos públicos futuros pueden seguir vinculándolo. No se agregó
una tabla paralela de pedidos ni una tabla de pagos.

## Rutas y alcance

- `/operacion/pedidos`: búsqueda y filtros, hasta 200 resultados recientes.
- `/operacion/pedidos/nuevo`: alta de un pedido preliminar manual.
- `/operacion/pedidos/[id]`: detalle, edición preliminar y acciones válidas.

Los canales son WhatsApp, Instagram, teléfono, presencial, transferencia y
`other` con descripción obligatoria. En esta fase sólo se admite envío. Las
reglas existentes no definen aún recolección, por lo que la UI y SQL la rechazan.

## Estados y transiciones

Se reutiliza `order_status`. En pedidos manuales:

- `pending_confirmation`: preliminar editable; no reserva ni descuenta stock;
- `preparing`: confirmado operativamente; el stock ya fue descontado;
- `cancelled`: terminal; no puede confirmarse ni editarse.

La matriz pura de TypeScript permite únicamente
`pending_confirmation → preparing`, `pending_confirmation → cancelled` y
`preparing → cancelled`. SQL vuelve a imponer la misma matriz. No se habilitan
los demás estados históricos del enum ni el completado en este bloque.

Cada inserción de pedido y cada cambio efectivo de `orders.status` genera su
entrada en `order_status_history` mediante el trigger existente
`orders_record_status_change`, que ejecuta `record_order_status_change()`. Los
replays idempotentes no cambian el estado y, por tanto, no agregan historial. El
trigger existente `order_status_history_is_immutable` impide modificar o borrar
las entradas históricas.

## Precio y totales

El navegador envía sólo `product_id`, `variant_id` y cantidad. SQL valida la
relación exacta, que producto y variante estén activos, publicados y no
archivados, y toma `coalesce(product_variants.price, products.price)`. Ese precio,
SKU, nombres, condición y moneda se congelan en `order_items`.

Por partida, `line_total = unit_price_snapshot × quantity`. El subtotal es la
suma de partidas y `total = subtotal - discount_total + shipping_total`; el
impuesto permanece en cero. Descuento y envío son enteros no negativos en
centavos MXN, el descuento no puede superar el subtotal y exige motivo. No se
usan floats como autoridad ni se acepta un precio o total del cliente.

## Inventario, atomicidad y concurrencia

Crear o editar un preliminar no toca `inventory`. `confirm_manual_order` bloquea
primero el pedido y después todas las filas de inventario en orden de UUID,
revalida saldo disponible y registra un movimiento `sale` por variante dentro de
la misma transacción. Si una partida falla, no cambia ninguna.

`cancel_manual_order` no toca inventario si el pedido era preliminar. Si estaba
confirmado, bloquea las mismas filas, suma exactamente las cantidades del
snapshot y registra movimientos `return`. No hay reservas temporales ni edición
directa del saldo.

Cada edición y transición recibe `expected_version`; el bloqueo `FOR UPDATE` y
la comparación producen conflicto de serialización si otro actor cambió el
pedido. Después de confirmar no se pueden editar artículos, cantidades, precios
o importes.

## Idempotencia, autorización y auditoría

Crear, confirmar y cancelar requieren UUID de idempotencia.
`order_idempotency_keys` conserva actor, operación, pedido y SHA-256 del payload
normalizado. Un replay idéntico devuelve el resultado previo; cambiar actor,
objetivo, payload o transición causa conflicto. Los movimientos derivados usan
UUID deterministas por clave y variante, evitando ventas o devoluciones dobles.

Cada página está bajo el layout protegido y cada Server Action ejecuta
`requireOrdersManager()`, que consulta `can_manage_orders()`. La función sólo
autoriza roles `operator` y `admin` desde `user_roles`; no confía en metadata.
Las RPC son `security invoker`, con `search_path = ''`. RLS es la autoridad final,
las escrituras requieren un contexto transaccional interno y triggers bloquean
escrituras directas. No hay `DELETE` de pedidos. Se guardan `created_by`,
`updated_by`, `confirmed_by`, `cancelled_by`, timestamps, versión y motivos.

El estado de pago es exclusivamente informativo: pendiente, transferencia
pendiente/verificada, efectivo o terminal externa. No crea filas de pago, no
marca automáticamente pagado y no almacena tarjeta, CVV, cuenta o token.

## Límites pendientes

No existen todavía carrito o checkout público, pagos integrados, cálculo o
integración automática de envíos, facturación, devoluciones, reembolsos,
reservas temporales, apartados, compras a proveedores ni integraciones externas.
Tampoco se implementa completado, recolección o edición de un confirmado.

Creación, confirmación y cancelación alimentan la outbox local desde
`order_status_history`. SMTP es posterior e independiente. Véase
[ORDER_NOTIFICATIONS.md](./ORDER_NOTIFICATIONS.md).
