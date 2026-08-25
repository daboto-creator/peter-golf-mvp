# Variables de entorno

## Principios

Los valores reales se configuran fuera de Git. Desarrollo usa `.env.local`;
Vercel usará variables separadas para Development, Preview y el ambiente
Production del proyecto exclusivo de staging. Ese último ambiente sigue usando
`APP_ENV=staging`: no representa la producción comercial futura.

Next.js inserta las variables `NEXT_PUBLIC_*` en el bundle durante el build. Un
cambio de valor requiere un deployment nuevo. Sólo esas variables pueden llegar
al navegador:

- `NEXT_PUBLIC_SUPABASE_URL`: URL pública del proyecto Supabase correspondiente;
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: llave publishable sujeta a RLS;
- `NEXT_PUBLIC_APP_URL`: origen canónico para callbacks de Auth.

`SUPABASE_SERVICE_ROLE_KEY` sólo se configura en staging cuando Stripe Checkout
test está habilitado y queda aislada al webhook/RPC transaccional. Preview y la
producción futura no la reciben.

## Matriz aprobada

| Variable                        | Development local                                 | Preview Vercel                    | Staging estable                         |
| ------------------------------- | ------------------------------------------------- | --------------------------------- | --------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | `http://127.0.0.1:54321`                          | URL HTTPS de `peter-golf-staging` | URL HTTPS de `peter-golf-staging`       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publishable local                                 | publishable de staging            | publishable de staging                  |
| `NEXT_PUBLIC_APP_URL`           | `http://localhost:3000`                           | URL canónica estable de staging   | URL canónica estable de staging         |
| `APP_ENV`                       | `development`                                     | `preview`                         | `staging`                               |
| `MARKETPLACE_ENABLED`           | `false`                                           | `false`                           | `false`                                 |
| `PAYMENTS_MODE`                 | `disabled`; `test` sólo en prueba local explícita | `disabled`                        | `disabled`; `test` sólo con Stripe test |
| `NOTIFICATIONS_MODE`            | `disabled`; `test` sólo con Inbucket local        | `disabled`                        | `disabled`                              |
| `SUPABASE_SERVICE_ROLE_KEY`     | ausente; requerida sólo con Stripe test local     | prohibida                         | sólo con Stripe test habilitado         |
| variables SMTP/`EMAIL_*`        | sólo prueba local                                 | prohibidas                        | prohibidas                              |

La URL Preview cambia por deployment, pero Auth no depende de ella. Mientras se
use la URL gratuita inicial, Preview y staging reciben como
`NEXT_PUBLIC_APP_URL` el alias canónico estable `vercel.app` del proyecto de
staging. Los callbacks terminan allí.

`MARKETPLACE_ENABLED` es exclusivamente server-side y falla cerrado a `false`.
PR 2 incluye rutas autenticadas de onboarding y revisión, pero permanecen
inaccesibles mientras el flag está apagado. El kill switch privado
`site_settings['marketplace.enabled']` también inicia apagado; desarrollo o
staging deben habilitar explícitamente ambos controles para probar el flujo.

## Validación fail-closed

`src/env/public.ts` valida con referencias estáticas cada variable pública.
`src/env/server.ts`, protegido con `server-only`, aplica invariantes adicionales.
En cualquier ambiente alojado (`preview`, `staging`, `production`), el proceso
falla antes de publicar si:

- las URLs de Supabase o aplicación faltan, no usan HTTPS o apuntan a localhost;
- falta la llave publishable;
- notificaciones no están en `disabled`;
- se configuró `EMAIL_TRANSPORT`, cualquier `SMTP_*`, `EMAIL_FROM_*` o la
  allowlist de destinatarios.

Preview exige pagos y Stripe `disabled`, sin secretos Stripe ni service role.
Staging permite Stripe `disabled` con pagos `disabled`, o Stripe `test` con
pagos `test`, `sk_test_`, `whsec_` y service role. La producción futura exige
pagos y Stripe `disabled`, sin esos tres secretos; live mode no está soportado.

`APP_ENV` es obligatorio y se configura explícitamente por scope en Vercel.
Si falta durante un build con `NODE_ENV=production`, el build falla mencionando
`APP_ENV`; no se infiere Preview, staging ni producción desde `NODE_ENV`.
GitHub Actions es un ambiente de validación aislado y usa explícitamente
`APP_ENV=test`, incluso cuando `next build` establece `NODE_ENV=production`.

Los errores enumeran únicamente nombres de campos inválidos; nunca incluyen
valores, URLs, llaves o secretos. Desarrollo conserva sus defaults locales.

## Pagos y correo

`PAYMENTS_MODE=disabled` bloquea la aplicación y el setting privado
`site_settings.payments.mode=disabled` bloquea los RPC. Stripe añade un segundo
kill switch, `stripe.checkout.mode`; ambos deben estar en `test` para preparar
una sesión.

`NOTIFICATIONS_MODE=disabled` impide reclamar entregas de la outbox. Inbucket o
Mailpit sólo existe dentro de Supabase local en `127.0.0.1:54324/54325`; no se
despliega ni es accesible desde Vercel. Staging no configura SMTP. Los correos
de Supabase Auth son un canal independiente y el primer staging usa únicamente
cuentas de prueba precreadas y confirmadas; registro y recuperación no se
consideran abiertos a correos arbitrarios.

## Manejo en Vercel

### Matriz de Stripe Checkout test

| Ambiente          | `PAYMENTS_MODE`            | `STRIPE_CHECKOUT_MODE` | Secretos Stripe/service role                             |
| ----------------- | -------------------------- | ---------------------- | -------------------------------------------------------- |
| Development       | `disabled` o `test`        | `disabled` o `test`    | Requeridos sólo con Stripe `test`; clave `sk_test_`      |
| Preview           | `disabled`                 | `disabled`             | Prohibidos                                               |
| Staging           | `test` al habilitar Stripe | `test`                 | `sk_test_`, `whsec_` y service role del Supabase staging |
| Producción futura | `disabled`                 | `disabled`             | Prohibidos; Stripe live no está implementado             |

Variables server-only: `STRIPE_CHECKOUT_MODE`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`. Preview debe declarar
`APP_ENV=preview`; staging usa `APP_ENV=staging`. Cuando Stripe está disabled,
los tres secretos deben estar ausentes. Los errores de arranque enumeran sólo
nombres de variables.

Configuración local de ejemplo (valores reales sólo en `.env.local`):

```dotenv
APP_ENV=development
PAYMENTS_MODE=test
STRIPE_CHECKOUT_MODE=test
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
SUPABASE_SERVICE_ROLE_KEY=...
```

Además, habilita sólo la base local:

```sql
update public.site_settings set value='{"mode":"test"}'
where key in ('payments.mode', 'stripe.checkout.mode');
```

### Asignación en Vercel

El proyecto Vercel de staging tendrá `main` como Production Branch. La
integración GitHub–Vercel creará:

- Preview Deployments para feature branches;
- un deployment estable de staging después de cada merge aprobado a `main`.

Las variables se cargan en el dashboard de Vercel y se asignan por ambiente.
No se versionan `.vercel`, `.env.local`, tokens de Vercel ni valores de
Supabase. Cambiar una variable no modifica deployments anteriores: se debe
generar uno nuevo.

En el scope **Preview** se configura `APP_ENV=preview`. En el scope
**Production** del proyecto Vercel dedicado a staging se configura
`APP_ENV=staging`. Un futuro proyecto comercial separado configurará
`APP_ENV=production`; ninguno depende de una detección automática.
