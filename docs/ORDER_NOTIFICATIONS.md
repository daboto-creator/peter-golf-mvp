# Notificaciones transaccionales de pedidos y pagos

## Alcance

Este bloque entrega correos exclusivamente en ambiente local y de prueba. No
integra proveedores externos, no usa `service_role`, Edge Functions, `pg_cron`
ni `pg_net`, y nunca debe producir tráfico SMTP externo.

Los eventos soportados son `order_created`, `order_confirmed`,
`transfer_submitted`, `payment_under_review`, `payment_paid`,
`payment_rejected`, `payment_refunded` y `order_cancelled`.

## Arquitectura

`order_status_history` y `payment_status_history` son las fuentes inmutables de
hechos. Triggers diferidos crean `notification_events` y, cuando el pedido tiene
correo, una `notification_delivery` en la misma transacción. No se hace backfill
de hechos anteriores a la migración.

SMTP ocurre después del commit, al procesar manualmente la cola desde
`/operacion/notificaciones`. Un fallo SMTP cambia únicamente la entrega; nunca
revierte pedido, pago o inventario. Una falla de escritura de la outbox sí
aborta la operación para evitar perder eventos silenciosamente.

`notification_events` es inmutable y conserva sólo número comercial, origen,
importe y moneda. Un pedido manual sin correo crea evento, pero no entrega.

## Estados, leases e idempotencia

Las entregas usan `pending`, `processing`, `sent`, `failed` y `dead_letter`.
El processor reclama con `FOR UPDATE SKIP LOCKED`, asigna un lease UUID e
incrementa el intento. El lease vence después de cinco minutos.

Después de fallar se reintenta a +1 minuto, +5 minutos, +15 minutos y +1 hora.
El quinto fallo termina en `dead_letter`. Errores permanentes como destinatario
o dominio no permitido terminan inmediatamente en `dead_letter`.

La unicidad `(notification_event_id, channel)` evita dos entregas para el mismo
evento. Cada mensaje usa un `Message-ID` determinista basado en la entrega. SMTP
no confirma atómicamente con PostgreSQL: la garantía es **at-least-once** y
existe una ventana pequeña de duplicado si SMTP acepta el mensaje pero el
proceso termina antes de marcarlo enviado.

## Seguridad, privacidad y retención

Ambas tablas tienen RLS y carecen de políticas cliente. Las funciones
operativas son `security definer`, fijan `search_path = ''`, comprueban
`can_manage_orders()` y sólo se conceden a `authenticated`.

El listado operativo expone correo enmascarado, estado, intentos, fechas y un
código de error controlado. No expone cuerpos, stack traces ni respuestas SMTP.

Las plantillas excluyen dirección, teléfono, referencias, actores, notas,
motivos internos, idempotencia, banco, remitente/referencia de transferencia,
inventario y costos. Todo HTML se escapa. Pedidos manuales no incluyen enlace de
cuenta.

La retención inicial de `recipient_email`, metadata de entrega y errores
sanitizados es de 90 días. Este bloque documenta pero no automatiza el purgado;
la política de privacidad y anonimización debe aprobarse antes de producción.
Los eventos se conservan mientras exista el pedido.

## Configuración local

Inbucket publica UI en `http://127.0.0.1:54324` y SMTP en
`127.0.0.1:54325`. Supabase CLI 2.110 muestra una advertencia deprecatoria para
`[inbucket]`, pero el reinicio de esta pila aplica ambos puertos.

```dotenv
NOTIFICATIONS_MODE=test
EMAIL_TRANSPORT=smtp
SMTP_HOST=127.0.0.1
SMTP_PORT=54325
SMTP_SECURE=false
EMAIL_FROM_ADDRESS=no-reply@peter-golf.test
EMAIL_FROM_NAME=Peter Golf Pruebas
EMAIL_ALLOWED_RECIPIENT_DOMAINS=example.test,peter-golf.test
```

`disabled` impide que la aplicación reclame entregas, pero conserva eventos.
`test` exige host local, aplica allowlist y agrega: **Mensaje de prueba. No
realizar una transferencia real**.

## Prueba local

1. Ejecutar `npm run supabase:reset` y `npm run dev`.
2. Usar sólo usuarios ficticios bajo un dominio permitido.
3. Crear o transicionar un pedido/pago.
4. Entrar como operator/admin a `/operacion/notificaciones`.
5. Procesar pendientes y revisar `http://127.0.0.1:54324`.
6. Para validar fallos, detener sólo Inbucket, procesar, restaurarlo y usar
   **Reintentar fallidas**.

La prueba SQL `supabase/tests/order_notifications_foundation.sql` finaliza con
`ROLLBACK`.

La prueba E2E local es opt-in porque reconstruye Supabase local y detiene
temporalmente Inbucket para comprobar la recuperación:

```bash
RUN_NOTIFICATION_E2E=1 npm run test:e2e -- e2e/order-notifications.spec.ts
```

Para el caso deshabilitado, anteponer `NOTIFICATIONS_MODE=disabled`. Nunca debe
ejecutarse contra staging.
