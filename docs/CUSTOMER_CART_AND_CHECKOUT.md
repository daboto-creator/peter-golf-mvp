# Carrito y checkout autenticado

## Alcance y rutas

Esta base conecta catálogo, carrito, checkout, pedidos del cliente, inventario
y operación sin cobrar. Usa `/productos/[slug]`, `/carrito`, `/checkout`,
`/pedido-confirmado/[id]`, `/cuenta/pedidos`, `/cuenta/pedidos/[id]` y las rutas
operativas existentes. Navegar y seleccionar es público; persistir un carrito,
checkout y pedidos requieren sesión. `next` sólo admite rutas internas. No hay
carrito anónimo ni checkout invitado.

## Modelo reutilizado

Se reutilizan `carts`, `cart_items`, `orders`, `order_items`,
`order_status_history`, `profiles`, `addresses`, `shipping_methods`, catálogo e
inventario existentes. No se creó un modelo paralelo. La migración
`20260801000200_customer_checkout_foundation.sql` agrega `carts.version`, los
campos informativos `price_seen`/`currency_seen`, `cart_idempotency_keys`, el
enum `order_origin` y RPC/políticas mínimas.
La migración `20260801000300_customer_order_read_privacy.sql` reemplaza la
lectura directa de pedidos del cliente por `list_customer_orders()` y
`get_customer_order(uuid)`.

Un pedido manual usa `origin = manual` y `created_by` con el operador. Un pedido
de tienda usa `origin = web`, `user_id` con el cliente y `created_by = null`.

## Carrito, precios y disponibilidad

Existe como máximo un carrito `active` por usuario. Agregar una variante
existente incrementa su cantidad bajo bloqueo; actualizar exige un entero entre
1 y 99; eliminar es explícito y cero nunca elimina. Vaciar conserva el carrito;
checkout lo convierte. El carrito no reserva ni descuenta inventario.

Cada lectura resuelve `coalesce(product_variants.price, products.price)` en SQL.
`price_seen` sólo permite avisar cambios y no es precio contractual. Un cambio
bloquea checkout hasta actualizar la partida. Nunca se aceptan precios, nombres,
SKU, subtotales o totales del navegador.

Agregar, actualizar y checkout verifican producto activo, publicado y no
archivado; variante activa y no archivada; inventario inicializado; y
`quantity_on_hand - quantity_reserved >= cantidad`. El cliente sólo recibe
`available`, `low`, `insufficient` o `unavailable`, nunca el saldo exacto.

## Envío, dirección y pago informativo

La dirección incluye destinatario, teléfono, calle, números, colonia, ciudad,
estado, CP, referencias y país fijo `MX`. Se puede usar una dirección propia y
sólo se guarda una nueva mediante opción explícita. No se recopilan datos
fiscales.

Cuando se elige una guardada, el navegador envía sólo su UUID y la firma nueva
de `create_customer_checkout_order` vuelve a resolver en SQL una fila activa
propiedad de `auth.uid()`. Los campos visibles del navegador se ignoran y el
snapshot se construye desde la versión vigente. Una captura nueva y su guardado
opcional permanecen dentro de la transacción e idempotencia del pedido.

El método único es `envio_nacional_temporal`, configurado en
`shipping_methods` con `14900` centavos MXN ($149.00). SQL lo resuelve nuevamente
y Peter Golf confirma después la logística. El pago es sólo `bank_transfer` con
estado `transfer_pending`: no se cobra, no se marca pagado y no se guardan ni
muestran credenciales financieras.

## Pedido, inventario y totales

`create_customer_checkout_order` bloquea carrito, partidas, productos e
inventario, revalida versión, precios, moneda y saldo, crea snapshots y convierte
el carrito atómicamente. El pedido inicia `pending_confirmation` con número
`PG-W-{12 hex}`.

- `line_total = unit_price_snapshot * quantity`;
- `subtotal = sum(line_total)`;
- `shipping_total = 14900` desde el método vigente;
- `discount_total = 0` y `tax_total = 0`;
- `total = subtotal + shipping_total`.

Crear no reserva ni descuenta. `confirm_operational_order` realiza
`pending_confirmation → preparing`, descuenta y registra `sale`. Cancelar un
preliminar no toca stock; cancelar `preparing` devuelve exactamente las unidades
con `return`. El trigger existente registra el historial.

## Seguridad, concurrencia y privacidad

Páginas y acciones validan `auth.getUser()`; operación además consulta
`can_manage_orders()` sobre roles reales. RLS limita carrito, direcciones y
pedidos por `auth.uid()`. El cliente no escribe directamente carrito, pedidos,
snapshots, totales, pago o inventario. Las RPC son `security invoker`, fijan
`search_path = ''` y combinan grants mínimos, políticas, marcadores locales y
triggers.

Cada mutación crítica recibe UUID y conserva actor, operación, objetivo y hash
del payload normalizado. Un replay idéntico devuelve el resultado; una
reutilización distinta es conflicto. `FOR UPDATE`, orden de bloqueos y versiones
de carrito/pedido protegen pestañas, doble clic, cambios y carritos convertidos.

El cliente sólo ve sus pedidos mediante dos RPC `security invoker`. Las
políticas de propiedad exigen además un contexto local que la RPC activa y
desactiva en la misma transacción; una consulta PostgREST directa a `orders`,
`order_items`, `order_status_history` u `order_idempotency_keys` no devuelve
filas del cliente. Operator/admin conservan sus políticas operativas completas.

La proyección permite identificador y número, fechas, estados de pedido y pago,
método informativo, importes, moneda, snapshot de envío, snapshots comerciales
de partidas y transiciones `from_status`/`to_status` con fecha. Excluye
`customer_note`, `internal_note`, `discount_reason`, motivos de cancelación,
actores de creación/edición/confirmación/cancelación, `changed_by`, notas e IDs
del historial y llaves de idempotencia. Dirección, teléfono y payload no se
ponen en URLs, consola o errores.

## Pruebas y límites

`src/lib/cart/cart-rules.test.ts` cubre cantidades, dinero y dirección.
`supabase/tests/customer_checkout_foundation.sql` cubre RLS, carrito,
idempotencia, precios, stock, checkout, snapshots, totales, propiedad y
operación dentro de una transacción con `ROLLBACK`.
`supabase/tests/customer_order_read_privacy.sql` verifica por separado las
proyecciones, propiedad, bloqueo de campos internos y compatibilidad completa de
operator/admin y sus transiciones.

Todavía no existen pagos reales, checkout invitado, cupones, puntos,
facturación, cotización de paqueterías, recolección, devoluciones, reembolsos,
reservas temporales, correos transaccionales, WhatsApp automático ni
integraciones externas.
