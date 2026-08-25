# Plan de pruebas

## 1. Objetivo

Verificar que Best Round Pro Shop cumpla requisitos funcionales futuros, proteja datos y comunique correctamente que el MVP no realiza pagos. Este plan crecerá junto con la implementación.

## 2. Estado actual

El repositorio dispone de:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:watch`
- `npm run test:e2e`
- `npm run build`

Las pruebas unitarias usan Vitest y Testing Library. Playwright se ejecuta
localmente y permite un smoke remoto manual; todavía no forma parte del workflow
de CI. La configuración incluye Desktop Chrome, Mobile Chrome, Mobile Safari y
Tablet.

Sin `PLAYWRIGHT_BASE_URL`, Playwright inicia el servidor local. Con esa variable
usa la URL proporcionada y no levanta `webServer`. En remoto excluye pruebas cuyo
título incluya `@mutating`, salvo `PLAYWRIGHT_ALLOW_MUTATIONS=1`. Ese flag no se
usa contra staging en esta fase.

### Marketplace Foundation

`supabase/tests/marketplace_foundation.sql` es una suite adversarial transaccional
con `ROLLBACK`. Valida registro detrás del kill switch, Partner A contra Partner
B, Golfer sin Partner, capacidades Operations/Admin, bucket KYC privado,
transiciones con versión, auditoría inmutable y configuración versionada. Se
ejecuta manualmente después de `npm run supabase:reset`; su incorporación al CI
completo queda para el hardening de PR 9.

`supabase/tests/marketplace_partner_onboarding.sql` agrega guardado progresivo,
mass assignment, readiness, envío, revisión, concurrencia, audit sin KYC,
Partner A/B, Golfer, anonymous, Operations y Admin. El E2E opt-in
`marketplace-partner-onboarding.spec.ts` cubre Golfer → Partner → Operations →
VERIFIED, selector de modo, rutas prohibidas y overflow móvil. Véase
`docs/MARKETPLACE_PARTNER_ONBOARDING.md` para ejecutarlos.

### Marketplace Partner Listings

`supabase/tests/marketplace_partner_listings.sql` valida aislamiento Partner A/B,
Partner no verificado, Golfer, anónimo, capability Operations, configuración
financiera restringida, readiness, snapshots, cambios solicitados, aprobación,
Storage privado, unidad única/multi-unidad e invariantes de inventario. La suite
termina en `ROLLBACK`.

`src/lib/marketplace/listing-rules.test.ts` cubre reglas determinísticas de UI y
server validation. El E2E opt-in cubre el wizard desktop, revisión humana,
corrección/reenvío, aprobación y checks responsive sin habilitar compra.

### Marketplace Partner Score y Tiers

`supabase/tests/marketplace_partner_score_tiers.sql` valida con `ROLLBACK` la
configuración versionada, prior neutral, status provisional/establecido, siete
componentes, idempotencia, rolling de días elegibles, promoción, downgrade,
penalty decay, riesgo crítico, overrides, snapshots inmutables y RLS Partner A/B.
`supabase/tests/marketplace_partner_score_tier_promotion_candidate.sql` cubre la
estabilidad ligada a un candidate específico, cambios Par/Birdie/Hole in One,
pérdida del candidate, idempotencia, downgrade y cap provisional.
`supabase/tests/marketplace_score_job_hosted_portability.sql` reproduce una
identidad de infraestructura distinta de `postgres`, comprueba que bootstrap y
cron usan el executor privado, y valida autorización pública, ACL internas,
baseline neutral, schedule único e idempotencia.

`src/lib/marketplace/score-tier-rules.test.ts` cubre smoothing y matemática en
bps, bounds, status, elegibilidad simultánea, fallback Bogey, cap provisional,
timers inclusivos y tracking por candidate. El E2E opt-in
`marketplace-partner-score-tiers.spec.ts` valida
la vista explicable del Partner, acciones autorizadas de Operations y overflow
en Desktop, Pixel 7 e iPhone 15.

`e2e/staging-smoke.spec.ts` es de sólo lectura y valida home, catálogo, health,
redirects anónimos, ausencia del scaffold, errores visibles y patrones de
secretos. Se ejecutará después de crear el alias de staging.

El catálogo incorpora pruebas unitarias deterministas para formateo de importes
en unidades menores, condición, mensajes de disponibilidad y validación de rutas
de imagen. La gestión operativa agrega pruebas de validación de producto,
conversión exacta de precio, generación/validación de slug, reglas de
publicación y resolución reutilizable de autorización. No dependen de Supabase
remoto.

La base de imágenes agrega pruebas unitarias para MIME, extensión, tamaño,
firma binaria básica, cantidad, rutas seguras, texto alternativo, evidencia de
condición, orden, promoción de principal y compensación de borrado.

La gestión de taxonomías agrega pruebas deterministas para nombre, slug, estados,
orden, UUID de padre, autorreferencia, ciclos, selección de referencias activas,
conservación de relaciones archivadas actuales y mensajes de conflicto. No usa
staging ni servicios remotos.

La gestión de inventario agrega pruebas unitarias de cantidades enteras,
movimientos permitidos, notas, cálculo de saldo, prevención de disponible
negativo, niveles de stock y transformación del historial. La prueba SQL local
`supabase/tests/inventory_management_foundation.sql` cubre inicialización,
incremento, decremento, idempotencia, inmutabilidad y RLS para customer,
operator y admin dentro de una transacción con `ROLLBACK`.
`supabase/tests/inventory_variant_management.sql` agrega productos de una y dos
variantes, inicialización y ajustes independientes, búsqueda normalizada por SKU
de variante, validación del par producto-variante y rechazo de variantes
inactivas o archivadas.

La gestión de pedidos agrega pruebas unitarias de dinero, normalización,
dirección, relación producto-variante y transiciones. La prueba SQL
`supabase/tests/order_management_foundation.sql` cubre autorización,
snapshots, totales, confirmación/cancelación atómicas, falta de stock,
inmutabilidad e idempotencia dentro de una transacción con `ROLLBACK`. También
comprueba que el trigger existente `orders_record_status_change` genere una sola
entrada por transición efectiva, que los replays no dupliquen el historial y
que `order_status_history_is_immutable` rechace actualización y borrado físico.

El checkout autenticado agrega pruebas unitarias para cantidad, cálculo de
carrito/checkout y dirección mexicana. La prueba SQL local
`supabase/tests/customer_checkout_foundation.sql` cubre RLS entre clientes,
carrito único, mutaciones idempotentes, precios vigentes, disponibilidad,
checkout atómico, snapshots, envío servidor, pedido web, no descuento al crear,
confirmación/cancelación operativa e historial, siempre con `ROLLBACK`.

Perfil y direcciones agregan pruebas unitarias de normalización, nombre,
teléfono, etiqueta, opcionales, CP mexicano y transformación. La prueba SQL
`supabase/tests/customer_profile_addresses.sql` cubre sesión, propiedad,
privilegios directos, roles, CRUD, versión, predeterminada única y ausencia de
reasignación al eliminar. La prueba de checkout comprueba además que una
dirección guardada se resuelva en SQL e ignore campos manipulados del navegador.

`supabase/tests/customer_order_read_privacy.sql` prueba con `ROLLBACK` que cada
cliente lista y consulta sólo su proyección, que un pedido ajeno devuelve nulo,
que las lecturas directas no revelan notas, actores, historial ni idempotencia,
y que operator/admin conservan el detalle completo. También ejecuta confirmar y
cancelar para detectar regresiones en las rutas operativas.

La suite `supabase/tests/order_payments_foundation.sql` cubre kill switch,
backfill compatible, RLS, propiedad, permisos operador/admin, denegación anónima,
creación atómica, importe/moneda derivados, idempotencia, versión, matriz de
transiciones, reenvío, auditoría inmutable y separación pedido/pago/inventario.
También verifica el bloqueo de cancelación pagada, reembolso y una sola devolución
de inventario. Las reglas y presentación tienen pruebas unitarias en
`src/lib/payments/payment-rules.test.ts`.

La outbox agrega pruebas unitarias de eventos, plantillas, escape, banner,
allowlist, reintentos, errores y `Message-ID`. La prueba SQL
`supabase/tests/order_notifications_foundation.sql` cubre pedidos web/manuales,
ausencia de correo, unicidad, RLS, inmutabilidad, leases, reclamaciones
concurrentes, `dead_letter` y separación de pedido/pago.

La prueba SQL local
`supabase/tests/catalog_base_variant_foundation.sql` verifica que la creación
operativa produzca exactamente una variante base en la misma transacción, que
normalice y respete la unicidad del SKU, que un conflicto revierta también el
producto y que reintentos o ediciones no creen duplicados. También cubre la
reparación explícita de huérfanos, el rechazo de archivados y la matriz
customer/operator/admin, siempre con `ROLLBACK` y sin staging.

`supabase/tests/catalog_base_variant_updates.sql` añade cambios sincronizados de
nombre/SKU, atomicidad ante colisiones, edición sin duplicados, bloqueo de
escritura directa, rechazo de huérfanos/archivados/variantes no canónicas o
múltiples, snapshot de estado concurrente y autorización customer/operator/admin.

## 3. Pirámide de pruebas

### Estáticas

- ESLint sin errores.
- TypeScript estricto sin errores.
- Build de producción exitoso.
- Revisión de secretos y configuración por ambiente.

### Unitarias

- Reglas de condición y disponibilidad.
- Cálculo server-side de subtotales y totales.
- Conversión y redondeo de centavos.
- Validadores de formularios y transiciones de estado.
- Jerarquía acíclica de categorías y selección segura de taxonomías.
- Plazos y mensajes para productos sobre pedido.
- Validación y consistencia de imágenes de producto.
- Creación atómica y reparación idempotente de variantes base.

### Integración

- Persistencia y restricciones del modelo.
- Autorización por rol y propiedad.
- RLS con casos permitidos y denegados cuando exista Supabase.
- Concurrencia de inventario y prevención de cantidades negativas.
- Creación de solicitud de asesoría e intención sin pago.

### End-to-end

- Verificar que la portada muestre Best Round Pro Shop y enlace al catálogo.
- Navegar listado y detalle publicado.
- Distinguir nuevo/seminuevo y stock/sobre pedido.
- Enviar una solicitud válida y manejar errores.
- Registrar intención de compra sin solicitar pago.
- Intentar manipular precio, producto, cantidad o estado desde el cliente.
- Confirmar que borradores y recursos ajenos no sean accesibles.
- Confirmar que un cliente reciba 403 en `/operacion` y que un operador pueda
  crear, editar, publicar, despublicar, archivar y restaurar.
- Confirmar que sólo operator/admin puede gestionar imágenes y que IDs de otro
  producto son rechazados.
- Confirmar que `/cuenta` y `/operacion` redirijan sin sesión.
- Confirmar que el health check use `no-store` y no revele configuración o PII.
- Ejecutar el smoke remoto sin habilitar mutaciones.

### Manuales

- Desktop Chrome en 1440×900.
- Mobile Chrome con perfil Pixel 7.
- Mobile Safari con perfil iPhone 15.
- Tablet con perfil iPad Pro 11, portrait y landscape.
- Ausencia de scroll horizontal y navegación móvil utilizable.
- Navegación por teclado, foco visible, etiquetas, contraste y lector de pantalla en rutas críticas.
- Contenido, fotografías y descripción de seminuevos.
- Mensajes de error, vacío, espera y ausencia de red.
- Revisión operativa por las dos personas del equipo.

## 4. Matriz mínima de datos

| Dimensión      | Casos                                                                           |
| -------------- | ------------------------------------------------------------------------------- |
| Condición      | nuevo, seminuevo con desgaste                                                   |
| Disponibilidad | en stock, agotado, sobre pedido                                                 |
| Estado         | borrador, publicado, pausado, archivado                                         |
| Precio         | válido, cero no permitido según regla, límite, manipulado                       |
| Cantidad       | 1, máximo permitido, 0, negativa, no entera, superior a stock                   |
| Contacto       | válido, campos vacíos, formato inválido, longitud excesiva, contenido malicioso |
| Acceso         | público, cliente propietario, otro cliente, staff, admin                        |
| Envío          | Querétaro, otra entidad con cobertura, código postal inválido/no cubierto       |

## 5. Seguridad

- Intentos de XSS, inyección, acceso directo a objetos y escalamiento de rol.
- Rate limiting o mitigación de spam en formularios.
- Ausencia de secretos y datos personales en HTML, bundles, logs y errores.
- Aislamiento de staging/producción.
- Pruebas por operación de cada política RLS.
- Confirmación de que no existe captura ni transmisión de datos de pago.

## 6. Ambientes y datos

- Pruebas automatizadas deterministas y aisladas.
- Staging con datos ficticios claramente identificados.
- Nunca copiar datos reales de producción a staging.
- Semillas futuras sin teléfonos, correos o direcciones de personas reales.
- Limpiar o anonimizar artefactos de prueba según política.
- Preview y staging comparten exclusivamente datos ficticios del Supabase de
  staging; las pruebas de escritura remotas requieren autorización explícita.
- Staging conserva datos existentes y no recibe `supabase/seed.sql`.
- Auth remoto usa cuentas ficticias precreadas y confirmadas.
- Inbucket y las pruebas SMTP existen sólo localmente.

## 7. Ejecución por tarea

Cuando existan todos los scripts:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run format
npm run format:check
npm run supabase:lint
npm run test:e2e -- e2e/home.spec.ts
git diff --check
```

Playwright requiere instalar los navegadores locales una vez con:

```bash
npx playwright install
```

Cuando exista el alias canónico, el smoke remoto manual será:

```bash
PLAYWRIGHT_BASE_URL=https://<alias-canonico-staging>.vercel.app \
  npm run test:e2e -- e2e/staging-smoke.spec.ts
```

## 8. Evidencia y salida

Cada entrega debe registrar comandos, resultado, ambiente, pruebas manuales y
defectos conocidos. Un release no avanza con fallas de build, defectos
críticos/altos, controles de acceso sin comprobar o ambigüedad sobre pagos
reales.

## 9. Stripe Checkout test

`supabase/tests/stripe_test_checkout_foundation.sql` cubre proveedor manual y
Stripe, ownership/anon/otro usuario, unidades menores, doble clic,
idempotencia, IDs duplicados, orden de eventos, monto/moneda manipulados,
`livemode`, refunds, aislamiento de inventario, cancelación, RLS, grants y
`search_path`. Debe ejecutarse junto con todas las pruebas SQL históricas.

Las pruebas unitarias cubren reglas de claves/eventos, normalización del webhook
y matriz de ambiente. El E2E `e2e/stripe-test-checkout.spec.ts` es opt-in:

```bash
RUN_STRIPE_E2E=1 npm run test:e2e -- e2e/stripe-test-checkout.spec.ts
```

Requiere Supabase local, configuración Stripe test completa y un listener
Stripe CLI activo. Nunca se ejecuta contra staging sin autorización explícita.

Para webhook local:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copiar el `whsec_...` emitido a `.env.local`; usar tarjetas de prueba de la
documentación de Stripe, nunca datos reales.

## Marketplace pricing PR 5

Run after `npm run supabase:reset`:

```bash
docker exec -i supabase_db_peter-golf-mvp psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 < supabase/tests/marketplace_partner_pricing.sql
```

The suite covers financial snapshots, tier commission, VAT, processing split,
admin fees, inverse pricing, idempotency, listing-version binding, quote
approval without publication, RLS A/B/Golfer/anonymous and tamper resistance.
Optional browser coverage uses `RUN_MARKETPLACE_PRICING_E2E=1` together with
`MARKETPLACE_ENABLED=true`.

## Marketplace checkout PR 6

`supabase/tests/marketplace_checkout_orders_fulfillment.sql` covers a mixed
first-party/Partner A/Partner B order, last-unit contention, checkout and
fulfillment idempotency, immutable quote snapshots, payment replay, expiry
release and Partner/anonymous isolation. Unit tests cover readiness, grouping
and transition rules. Existing payment, order, inventory and Marketplace suites
remain mandatory regressions.
