# Variables de entorno

## Uso actual

Copiar `.env.example` a `.env.local` para desarrollo. El archivo de ejemplo no
contiene secretos. Los valores reales nunca se versionan.

- `src/env/public.ts` valida exclusivamente variables `NEXT_PUBLIC_*`, que Next.js
  puede incluir en el bundle del navegador.
- `src/env/server.ts` está protegido con `server-only` y es el único módulo que
  expone `SUPABASE_SERVICE_ROLE_KEY`.
- `APP_ENV` acepta `development`, `test`, `staging` o `production`.
- `PAYMENTS_MODE` acepta únicamente `disabled` o `test`; el MVP no permite pagos
  reales.

Los módulos usan referencias estáticas a cada variable pública porque Next.js no
incluye accesos dinámicos como `process.env[nombre]` en el bundle cliente.

## Variables de Supabase

| Variable                        | Alcance     | Uso en esta fase                                         |
| ------------------------------- | ----------- | -------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Público     | URL del proyecto usada por ambos clientes.               |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Público     | Llave `anon`/publishable sujeta a RLS.                   |
| `NEXT_PUBLIC_APP_URL`           | Público     | Origen canónico para callbacks de Auth.                  |
| `SUPABASE_SERVICE_ROLE_KEY`     | Sólo server | Debe permanecer vacía; no existe cliente administrativo. |

La URL y la llave pública son obligatorias al crear cualquiera de los clientes
de `src/lib/supabase/`. Permanecen opcionales durante lint, pruebas unitarias y
build para que esos procesos no dependan de credenciales ni de red. Una llamada
sin configuración al endpoint de health responde `503` sin revelar detalles.

La llave pública no sustituye controles de acceso: todas las consultas siguen
sujetas a RLS y políticas explícitas. Aunque su exposición en el navegador es
intencional, no debe registrarse ni devolverse desde endpoints.

`SUPABASE_SERVICE_ROLE_KEY` omite RLS y por eso no se carga en ningún cliente de
esta integración. La gestión operativa de catálogo usa la llave pública, la
sesión autenticada y políticas RLS específicas para `operator`/`admin`.

## Separación y despliegue

1. Configurar URL y llave pública en el ambiente correspondiente; no reutilizar
   staging en producción.
2. Mantener `APP_ENV=development` y `PAYMENTS_MODE=disabled` localmente.
3. Mantener RLS y mínimo privilegio en cada tabla expuesta.
4. No guardar valores en Git, documentación, logs, bundles no previstos ni
   respuestas públicas.
5. Recordar que Next.js inserta las variables `NEXT_PUBLIC_*` en el bundle
   durante el build; deben corresponder al destino final del artefacto.
6. Configurar `NEXT_PUBLIC_APP_URL=http://localhost:3000` en desarrollo. Cada
   ambiente desplegado debe usar su propio origen HTTPS.
