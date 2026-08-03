# Pagos simulados de pedidos

Este bloque registra evidencia declarativa de una transferencia de prueba. No
procesa dinero, no inicia transferencias y no integra una pasarela. En toda
instrucción visible debe aparecer: **No realizar una transferencia real**.

## Modos

El flujo requiere dos controles server-side simultáneos:

- `PAYMENTS_MODE=test` habilita la UI y las Server Actions simuladas;
- `site_settings['payments.mode'] = {"mode":"test"}` habilita el RPC en la
  base de datos;
- `disabled` en cualquiera de los dos bloquea el registro del cliente.

El setting es privado. No se expone como variable `NEXT_PUBLIC_*`. Después de un
reset local queda `disabled`; para una prueba manual local puede cambiarse a
`test` con SQL de propietario. No se deben cambiar staging ni producción sin una
decisión operativa separada.

## Modelo y estados

`order_payments` contiene una fila por pedido y deriva importe/moneda de
`orders`. `payment_submissions` conserva intentos inmutables,
`payment_status_history` es el ledger de estados y
`payment_idempotency_keys` evita dobles operaciones. Las columnas legacy de
`orders` permanecen sólo por compatibilidad y dejaron de ser la fuente de
verdad.

Transiciones válidas:

```text
pending -> submitted
submitted -> under_review | rejected
under_review -> paid | rejected
rejected -> submitted
paid -> refunded
```

Rechazo y reembolso exigen motivo. Un cliente sólo registra una transferencia
de su pedido web cuando el pedido está `preparing`. Operador o admin, validados
con `can_manage_orders()`, revisan. El pago, el pedido y el inventario tienen
versiones y transiciones separadas.

## Seguridad y privacidad

- RLS está activa en las cuatro tablas; `anon` no ejecuta ni lee nada.
- No hay escritura directa: los RPC `security invoker` usan marcadores locales,
  versiones, locks e idempotencia.
- El navegador sólo envía el ID del pedido, versión de pago, referencia, fecha y
  opcionalmente nombre/banco declarados. Nunca envía propietario, importe,
  moneda, total ni estado final arbitrario.
- Las proyecciones del cliente excluyen actores, motivos operativos y claves de
  idempotencia. No se solicita cuenta origen, CLABE, tarjeta ni CVV.
- No hay comprobantes ni Storage en este MVP. Si se agregan, requieren un bucket
  privado y un diseño independiente de autorización, MIME, tamaño, antivirus y
  retención.

## Relación con pedido e inventario

Confirmar el pedido descuenta inventario pero no cambia el pago. Aprobar,
rechazar o reembolsar el pago no cambia el pedido ni el inventario. Un pago
`paid` bloquea la cancelación; después de `refunded`, la cancelación normal del
pedido realiza exactamente una devolución de inventario.

## Prueba manual local

1. Iniciar y resetear Supabase local.
2. Configurar sólo localmente `PAYMENTS_MODE=test` y actualizar el setting
   privado con `update public.site_settings set value='{"mode":"test"}' where
key='payments.mode';`.
3. Crear un pedido web con transferencia y comprobar importe, moneda, referencia
   sugerida y ambos estados; el formulario debe seguir bloqueado.
4. Como operador, confirmar el pedido; comprobar descuento de inventario.
5. Como cliente, registrar referencia/fecha y revisar `submitted` en confirmación,
   lista y detalle.
6. Como operador, iniciar revisión y aprobar o rechazar. Tras rechazo, reenviar.
7. En `paid`, comprobar que cancelar está bloqueado; registrar `refunded` con
   motivo y cancelar. Comprobar una sola devolución.
8. Repetir con `PAYMENTS_MODE=disabled`; el formulario y el RPC deben quedar
   bloqueados. No usar datos bancarios reales.

La verificación automatizada principal está en
`supabase/tests/order_payments_foundation.sql`.
