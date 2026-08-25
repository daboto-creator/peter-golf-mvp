# Runbook de despliegue de staging

## 1. Arquitectura aprobada

Vercel será la plataforma de staging. Se creará un proyecto Vercel exclusivo,
con `main` como Production Branch y una URL canónica gratuita `vercel.app`.
Supabase staging ya existe en `daboto-creator's Org` como
`peter-golf-staging` (`xdulakstgsgdujjylhox`).

Producción futura tendrá proyectos Vercel y Supabase independientes. No se
promueven credenciales, datos ni vínculos de staging a producción.

La integración GitHub–Vercel deberá crear previews para feature branches y
desplegar staging automáticamente después de merges aprobados a `main`. El
repositorio no agrega un workflow de despliegue ni `vercel.json`: la fase remota
usará la integración nativa.

## 2. Límites del primer staging

- Accesible mediante URL, pero no anunciado ni indexado como producción.
- Auth sólo con usuarios de prueba precreados y confirmados.
- Auth en Preview no es requisito; sus callbacks usan el origen canónico de
  staging.
- `PAYMENTS_MODE=disabled` y setting de base `payments.mode=disabled`.
- `NOTIFICATIONS_MODE=disabled` y ninguna variable SMTP en Vercel.
- Sin `SUPABASE_SERVICE_ROLE_KEY`, seed remoto, datos live ni pagos reales.
- El catálogo permanece dinámico; no se agrega caché persistente en esta fase.

## 3. Responsables, RPO y RTO

Una persona ejecuta o supervisa y otra revisa checklist y decisión go/no-go.
Los nombres y contactos se registran antes de la fase remota.

- RPO de staging: respaldo lógico inmediatamente anterior a migraciones
  relevantes.
- RTO objetivo: menos de cuatro horas.
- Frontend: rollback al último deployment saludable de Vercel.
- Base: restauración del respaldo o migración compensatoria revisada.
- Está prohibido `supabase db reset --linked`.

## 4. Preparación local

1. Confirmar rama, commit, diff y revisión aprobada.
2. Confirmar ausencia de secretos y archivos `.env`/`.vercel` versionados.
3. Ejecutar:

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
npm run format:check
npm run supabase:lint
npm run test:e2e -- e2e/home.spec.ts
git diff --check
```

4. Confirmar que los builds con `APP_ENV=preview` y `APP_ENV=staging` fallan sin
   la configuración HTTPS obligatoria y pasan con su matriz de pagos/Stripe,
   notificaciones deshabilitadas y sin variables prohibidas. Confirmar también
   que `NODE_ENV=production` sin `APP_ENV` falla.

## 5. Migraciones de Supabase staging

La consulta de sólo lectura del 3 de agosto de 2026 mostró 14 migraciones
remotas y 10 pendientes, desde
`20260731000100_inventory_management_foundation` hasta
`20260803000100_order_notifications_foundation`.

Antes de aplicar cualquier cambio remoto:

1. confirmar ref. `xdulakstgsgdujjylhox`;
2. preservar los datos existentes;
3. obtener y verificar un respaldo lógico inmediato;
4. ejecutar `npx --no-install supabase db push --dry-run`;
5. comprobar que aparezcan exactamente las 10 migraciones documentadas en
   `SUPABASE_SETUP.md`;
6. obtener autorización separada;
7. ejecutar `npx --no-install supabase db push`, sin `--include-seed`;
8. verificar historial, 32 tablas públicas, RLS, grants, Storage y kill switch;
9. registrar hora, responsable, respaldo y resultado.

No editar migraciones aplicadas ni usar reset remoto.

## 6. Configuración de Supabase Auth

Después de conocer el alias canónico de Vercel:

- Site URL: `https://<alias-canonico-staging>.vercel.app`;
- Redirect URL exacta:
  `https://<alias-canonico-staging>.vercel.app/auth/callback`;
- mantener el callback local sólo si sigue siendo necesario para desarrollo;
- revisar que plantillas de confirmación/recuperación utilicen `RedirectTo`.

No se configura SMTP. Se precrean y confirman cuentas ficticias autorizadas; el
registro y recuperación visibles no se declaran operativos para cualquier
correo. Las feature previews no amplían la allowlist de Auth.

## 7. Creación del proyecto Vercel

Esta fase requiere autorización remota posterior:

1. importar el repositorio en un proyecto exclusivo de staging;
2. seleccionar Next.js, raíz del repositorio y Node.js 24.x;
3. configurar `main` como Production Branch;
4. cargar variables por scope según `ENVIRONMENT.md`: `APP_ENV=preview` en
   Preview y `APP_ENV=staging` en Production del proyecto de staging;
5. no configurar variables SMTP ni `SUPABASE_SERVICE_ROLE_KEY`;
6. desplegar primero una feature branch como Preview;
7. verificar y fusionar por revisión a `main`;
8. comprobar que la integración GitHub–Vercel despliegue el alias estable.

Los assets de Next.js usan nombres con hash y cada deployment de Vercel es
inmutable. No existe service worker ni PWA que conserve una versión previa. Un
rollback reasigna el tráfico al deployment saludable anterior; no se intenta
sobrescribir el artefacto publicado.

## 8. Smoke test y checklist multidispositivo

El smoke remoto es inicialmente manual y de sólo lectura:

```bash
PLAYWRIGHT_BASE_URL=https://<alias-canonico-staging>.vercel.app \
  npm run test:e2e -- e2e/staging-smoke.spec.ts
```

Sin `PLAYWRIGHT_ALLOW_MUTATIONS=1`, cualquier prueba marcada `@mutating` queda
excluida de una URL remota. No habilitar ese flag contra staging en esta fase.

Validar al menos:

- Desktop Chrome, 1440×900;
- Mobile Chrome, Pixel 7;
- Mobile Safari equivalente, iPhone 15;
- tablet, iPad Pro 11 en portrait y landscape;
- home, catálogo, health, redirects anónimos y ausencia de secretos/errores;
- navegación sin scroll horizontal, foco visible, contraste y targets táctiles;
- pagos y notificaciones deshabilitados;
- cliente sin rol bloqueado de operación y RLS sin exposición cruzada.

## 9. Go/no-go y monitoreo

No abrir el alias hasta que migraciones, variables, Auth, health y smoke test
pasen. Registrar deployment, commit, responsable, hora y defectos. Revisar logs
sin copiar PII, cookies, tokens ni payloads completos.

Revertir ante indisponibilidad, exposición de datos, falla de autorización,
cálculos incorrectos o cualquier defecto crítico/alto.

## 10. Habilitación futura de Stripe test en staging

Esta tarea no configura recursos remotos. Cuando exista autorización:

1. Aplicar y validar migraciones en `peter-golf-staging`; nunca usar producción.
2. Crear/seleccionar una cuenta Stripe en test mode y registrar el endpoint
   `https://<dominio-staging>/api/webhooks/stripe` con los seis eventos
   documentados.
3. En Vercel Staging (no Preview) configurar `APP_ENV=staging`,
   `PAYMENTS_MODE=test`, `STRIPE_CHECKOUT_MODE=test`, la `sk_test_`, el
   `whsec_`, la service role exclusiva de `peter-golf-staging` y
   `NOTIFICATIONS_MODE=disabled`.
4. Activar `payments.mode=test` y `stripe.checkout.mode=test` en la base de
   staging, desplegar, verificar firma/reintentos y ejecutar el E2E autorizado.
5. Confirmar que Preview conserva Stripe disabled y sin los tres secretos.

Rollback funcional: poner primero `STRIPE_CHECKOUT_MODE=disabled` y
`stripe.checkout.mode=disabled`, redesplegar y conservar tablas/eventos para
auditoría. Esto impide nuevos intentos sin alterar pedidos, inventario, pagos ya
confirmados o transferencia bancaria. El rollback de esquema sólo se evaluará
después de retención/exportación; no se borran auditorías como respuesta rápida.

## 11. Rollback

Frontend:

1. detener promociones y cambios;
2. seleccionar el último deployment saludable de Vercel;
3. reasignar el alias/ejecutar rollback;
4. repetir health y smoke test.

Base:

1. detener escrituras afectadas;
2. determinar si basta una migración compensatoria compatible;
3. si hay corrupción o incompatibilidad, restaurar el respaldo previo;
4. verificar historial, RLS, integridad y aplicación;
5. documentar impacto y recuperación dentro del RTO objetivo.

## Marketplace pricing staging note

Marketplace stays off by default. Private staging validation requires the
existing Marketplace flag plus server-only `MARKET_PRICE_PROVIDER` and
`SERPAPI_API_KEY`. Confirm the published Marketplace pricing rule references an
active payment fee config. Never expose provider keys or enable public selling
as part of PR 5.
