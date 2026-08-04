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

`SUPABASE_SERVICE_ROLE_KEY` nunca se configura. No existe un cliente
administrativo y todas las operaciones usan sesión, RLS y permisos mínimos.

## Matriz aprobada

| Variable                        | Development local                                 | Preview Vercel                    | Staging estable                   |
| ------------------------------- | ------------------------------------------------- | --------------------------------- | --------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | `http://127.0.0.1:54321`                          | URL HTTPS de `peter-golf-staging` | URL HTTPS de `peter-golf-staging` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publishable local                                 | publishable de staging            | publishable de staging            |
| `NEXT_PUBLIC_APP_URL`           | `http://localhost:3000`                           | URL canónica estable de staging   | URL canónica estable de staging   |
| `APP_ENV`                       | `development`                                     | `staging`                         | `staging`                         |
| `PAYMENTS_MODE`                 | `disabled`; `test` sólo en prueba local explícita | `disabled`                        | `disabled`                        |
| `NOTIFICATIONS_MODE`            | `disabled`; `test` sólo con Inbucket local        | `disabled`                        | `disabled`                        |
| `SUPABASE_SERVICE_ROLE_KEY`     | ausente/vacía                                     | prohibida                         | prohibida                         |
| variables SMTP/`EMAIL_*`        | sólo prueba local                                 | prohibidas                        | prohibidas                        |

La URL Preview cambia por deployment, pero Auth no depende de ella. Mientras se
use la URL gratuita inicial, Preview y staging reciben como
`NEXT_PUBLIC_APP_URL` el alias canónico estable `vercel.app` del proyecto de
staging. Los callbacks terminan allí.

## Validación fail-closed

`src/env/public.ts` valida con referencias estáticas cada variable pública.
`src/env/server.ts`, protegido con `server-only`, aplica invariantes adicionales.
Cuando `APP_ENV=staging`, el proceso falla antes de publicar si:

- las URLs de Supabase o aplicación faltan, no usan HTTPS o apuntan a localhost;
- falta la llave publishable;
- pagos o notificaciones no están en `disabled`;
- existe `SUPABASE_SERVICE_ROLE_KEY`;
- se configuró `EMAIL_TRANSPORT`, cualquier `SMTP_*`, `EMAIL_FROM_*` o la
  allowlist de destinatarios.

Los errores enumeran únicamente nombres de campos inválidos; nunca incluyen
valores, URLs, llaves o secretos. Desarrollo conserva sus defaults locales.

## Pagos y correo

`PAYMENTS_MODE=disabled` bloquea la aplicación y el setting privado
`site_settings.payments.mode=disabled` bloquea el RPC. No existe proveedor de
pagos.

`NOTIFICATIONS_MODE=disabled` impide reclamar entregas de la outbox. Inbucket o
Mailpit sólo existe dentro de Supabase local en `127.0.0.1:54324/54325`; no se
despliega ni es accesible desde Vercel. Staging no configura SMTP. Los correos
de Supabase Auth son un canal independiente y el primer staging usa únicamente
cuentas de prueba precreadas y confirmadas; registro y recuperación no se
consideran abiertos a correos arbitrarios.

## Manejo en Vercel

El proyecto Vercel de staging tendrá `main` como Production Branch. La
integración GitHub–Vercel creará:

- Preview Deployments para feature branches;
- un deployment estable de staging después de cada merge aprobado a `main`.

Las variables se cargan en el dashboard de Vercel y se asignan por ambiente.
No se versionan `.vercel`, `.env.local`, tokens de Vercel ni valores de
Supabase. Cambiar una variable no modifica deployments anteriores: se debe
generar uno nuevo.
