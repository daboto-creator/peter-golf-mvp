# Auditoría de pendientes del MVP

Fecha de corte: 2026-08-24. Esta auditoría no autoriza producción ni crea
recursos externos.

## Resumen

| Bloque            | Estado   | Hallazgo principal                                                                                      |
| ----------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| Stripe edge cases | PARTIAL  | Dos fixtures SQL no reflejan el flujo checkout-first vigente; su corrección queda en una rama Stripe.   |
| Notificaciones    | PARTIAL  | Outbox, retry y correo cliente existen; falta alerta interna de pedido y transporte productivo.         |
| Infra / staging   | PARTIAL  | Local reproducible; falta reconciliar staging, backups, rollback y observabilidad.                      |
| Legal             | BLOCKER  | No existen páginas ni textos aprobados.                                                                 |
| Shipping          | PARTIAL  | Dirección, CP y tarifa temporal existen; no hay reglas dimensionales ni tracking.                       |
| SEO               | PARTIAL  | Branding, metadata, robots, canonical filtrado y Organization existen; faltan sitemap y Product schema. |
| Analytics         | BLOCKER  | No hay SDK, eventos ni gestión de consentimiento.                                                       |
| Responsive        | READY    | Tests actuales se conservan; no se abre rediseño.                                                       |
| Producción        | POST-MVP | Depende de cerrar legal, shipping, analytics/consent, staging y decisiones de producto.                 |

## A. Stripe edge cases — PARTIAL

`stripe_test_checkout_foundation.sql`, `stripe_abandoned_checkout_recovery.sql` y
`confirm_operational_order_payment_guard.sql` cubren doble ejecución, replay de
webhook, expiración, abandono, `payment_intent.payment_failed`, amount/currency
incorrectos, IDs únicos, transiciones monótonas, rechazo previo a side effects y
confirmación idempotente sin doble decremento. La arquitectura deriva amount y
currency del agregado de pago en servidor.

Los dos primeros fixtures todavía crean órdenes en estados anteriores al flujo
checkout-first incorporado por `allow_stripe_checkout_before_confirmation`. Al
ejecutarlos contra el esquema vigente fallan respectivamente con `Order is not
ready for payment` y `Expected operational confirmation guard`. Actualizar sus
estados y expectativas de devolución de inventario no es necesario para el
rebranding/SKU, por lo que esa corrección se excluye deliberadamente de esta rama
y debe tratarse en una rama Stripe aislada.

Pendiente antes de producción: repetir E2E contra Stripe test para tarjeta
declinada/expirada/abandonada, interrupción de red y replay desde Dashboard; fijar
runbook y alertas. No se rediseña Stripe aquí.

## B. Notificaciones — PARTIAL

Existen eventos de creación/confirmación, pago, rechazo, reembolso y cancelación;
outbox transaccional, leases, `SKIP LOCKED`, Message-ID determinista, retry
1/5/15/60 minutos, `dead_letter`, allowlist y fallo aislado del pedido. El sender
visible ya es Best Round Pro Shop y staging debe mantenerse en `disabled` o test
con destinatarios ficticios.

Falta una notificación separada al equipo interno por pedido nuevo, proveedor y
dominio productivos, secretos por ambiente, monitoreo de cola/dead letters y
política de retención aprobada. La entrega es at-least-once; debe aceptarse o
añadirse deduplicación del proveedor.

## C. Infra / staging — PARTIAL

Las migraciones locales reinician desde cero y RLS/lint tienen gates. SerpApi se
configura server-side y degrada a unavailable. No se auditó ni modificó un recurso
externo en esta rama.

Antes de la próxima etapa: comparar `supabase migration list` local/remoto,
inventariar env vars de preview/staging, comprobar health, SerpApi y webhook,
definir backup/restore probado, rollback por migración, retención de logs y
limpieza reproducible de datos ficticios. La advertencia `[inbucket]` →
`[local_smtp]` de Supabase CLI es deuda local.

## D. Legal — BLOCKER

No existen rutas para Aviso de Privacidad, Términos, cambios, devoluciones,
garantías, seminuevos, trade-in o envíos. Se requieren textos revisados por
asesoría legal, versionado/fecha, enlaces en footer y aceptación/consentimiento
donde corresponda. No se redacta contenido legal definitivo en código.

## E. Shipping — PARTIAL

Existen direcciones propias con RLS, CP mexicano de cinco dígitos, snapshot de
dirección, método temporal nacional y cálculo server-side del `shipping_total`.
Pricing interno contempla subsidio, pero no es una tarifa al cliente.

MVP seguro propuesto: tabla server-side por clase `club/bag/set`, zona de CP y
recargo; clasificación obligatoria y monto persistido en el snapshot del pedido;
operación manual registra carrier, tracking y fecha. Bloquear checkout si no hay
clase/tarifa. Integración automática con carrier queda POST-MVP.

## F. SEO — PARTIAL

Hay titles/descriptions rebrandeados, `metadataBase`, OpenGraph de organización,
Organization JSON-LD sanitizado, robots por ambiente, canonical de catálogo,
noindex para filtros y 404 de producto. Slug y SKU siguen independientes.

Faltan sitemap, canonical/OG dinámicos por producto, Product JSON-LD con Offer e
inventory, imágenes OG 1200×630, revisión de URLs filtradas y cobertura de 404.
No se considera SEO avanzado cerrado.

## G. Analytics — BLOCKER

No existen GA4, GTM, Meta Pixel, SDK, consentimiento ni eventos. Propuesta
posterior: capa server/client tipada y consent-aware para `view_item`,
`add_to_cart`, `begin_checkout` y `purchase`; `purchase` sólo desde confirmación
idempotente con `order_id`, currency y value server-derived. Nunca enviar PII ni
duplicar purchase en refresh/webhook replay.

## H–I. Responsive y producción

Responsive conserva Playwright en breakpoints públicos/administrativos y checks
de overflow. Producción es POST-MVP: requiere proyectos y secretos separados,
legal, shipping, analytics/consent, correo, monitoreo, backup/restore, dominio,
app marks oficiales y una decisión explícita de go-live.
