# Criterios de aceptación del MVP

## 1. Experiencia pública

- [x] La experiencia principal está en español de México.
- [x] La portada identifica Best Round Pro Shop, presenta asesoría profesional y
      enlaza al catálogo sin contenido del scaffold técnico.
- [x] El catálogo permite consultar únicamente productos publicados, activos y
      no archivados.
- [x] El detalle muestra condición, imágenes, precio, disponibilidad y variantes.
- [ ] Contenido, fotografías y descripción comercial finales están aprobados.
- [ ] La landing y rutas críticas pasan la revisión manual móvil, tablet y
      escritorio de staging.
- [ ] Estados de carga, vacío, error y contenido inexistente fueron verificados
      en el deployment remoto.

## 2. Cuenta y acceso

- [x] Registro, confirmación, login, logout y recuperación existen en código.
- [x] Rutas privadas revalidan sesión y autorización en servidor; Proxy es sólo
      una comprobación optimista.
- [x] La aplicación no usa `service_role`.
- [ ] El primer staging tiene cuentas ficticias precreadas y confirmadas.
- [ ] Site URL y callback exacto de Supabase Auth apuntan al alias canónico de
      staging.
- [ ] Registro y recuperación no se anuncian como disponibles para correos
      arbitrarios mientras no exista un SMTP aprobado.

## 3. Carrito, pedidos y pagos

- [x] El cliente autenticado puede operar un carrito y generar un pedido web
      pendiente de revisión.
- [x] Precios, envío y totales se resuelven en servidor/SQL.
- [x] No se solicitan tarjeta, CVV, CLABE ni credenciales financieras.
- [x] Operador/admin puede gestionar pedidos; inventario se descuenta y devuelve
      transaccionalmente según las reglas documentadas.
- [ ] Preview tiene `PAYMENTS_MODE=disabled`, Stripe disabled y ningún secreto
      de pagos ni service role.
- [ ] Staging permanece disabled hasta habilitar explícitamente Stripe test en
      ambiente y `site_settings`; nunca acepta credenciales live.
- [ ] Con Stripe disabled, la interfaz y los RPC bloquean operaciones de pago en
      staging.

## 4. Notificaciones

- [x] La outbox de pedidos/pagos es transaccional e independiente de las
      operaciones principales.
- [x] El transporte implementado sólo acepta SMTP local.
- [ ] Preview y staging tienen `NOTIFICATIONS_MODE=disabled`.
- [ ] Vercel no contiene variables SMTP ni `EMAIL_*`.
- [ ] La cola no reclama entregas en staging.
- [ ] Inbucket permanece exclusivamente local y no está expuesto públicamente.

## 5. Datos y Supabase staging

- [x] El esquema local tiene 24 migraciones, 32 tablas públicas y RLS en las 32.
- [ ] Existe un respaldo lógico inmediatamente anterior a migrar staging.
- [ ] El dry run remoto enumera exactamente las 10 migraciones pendientes.
- [ ] Existe autorización separada para ejecutar `db push`.
- [ ] Local y remoto quedan alineados en 24 migraciones sin aplicar seed.
- [ ] Se preservan los datos actuales y se verifican RLS, grants y Storage.
- [ ] Nunca se usa `db reset --linked`.

## 6. Vercel staging

- [ ] Existe un proyecto Vercel exclusivo de staging y producción futura queda
      separada.
- [ ] Node.js está configurado en 24.x y `main` es Production Branch.
- [ ] Un merge aprobado a `main` despliega automáticamente mediante la
      integración GitHub–Vercel.
- [ ] Feature branches generan previews sin depender de Auth.
- [ ] Preview y staging usan el mismo `NEXT_PUBLIC_APP_URL` canónico temporal.
- [ ] El alias `vercel.app` es público por URL, no anunciado y sirve `noindex`.
- [ ] `/api/health/supabase` devuelve sólo estado, ambiente, timestamp y servicio.

## 7. Calidad y seguridad

- [ ] `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`,
      `npm run format:check` y `npm run supabase:lint` terminan correctamente.
- [ ] Playwright pasa en Desktop Chrome, Mobile Chrome, Mobile Safari y Tablet.
- [ ] El smoke remoto de sólo lectura pasa sin habilitar mutaciones.
- [ ] No hay secretos, PII, stack traces, URLs internas o llaves en HTML, logs o
      health checks.
- [ ] No existe service worker ni caché persistente nueva del catálogo.
- [ ] No hay defectos críticos o altos abiertos.

## 8. Rollback y operación

- [ ] Se registraron responsables de despliegue, revisión y rollback.
- [ ] RPO: respaldo lógico inmediatamente anterior a migraciones relevantes.
- [ ] RTO objetivo: menos de cuatro horas.
- [ ] Rollback frontend probado con el último deployment saludable de Vercel.
- [ ] Rollback de datos usa restauración o migración compensatoria revisada.

## 9. Éxito comercial

Antes de una prueba con usuarios se deben fijar duración, muestra y metas para
solicitudes, intenciones, tiempo de respuesta y retroalimentación. Cumplir el
checklist técnico no equivale por sí solo a validar comercialmente el MVP.
