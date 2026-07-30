# Variables de entorno

## Uso actual

Copiar `.env.example` a `.env.local` para desarrollo. El archivo de ejemplo no
contiene secretos y las credenciales de Supabase son opcionales mientras no
exista una integración.

- `src/env/public.ts` valida exclusivamente variables `NEXT_PUBLIC_*`, que Next.js
  puede incluir en el bundle del navegador.
- `src/env/server.ts` está protegido con `server-only` y es el único módulo que
  expone `SUPABASE_SERVICE_ROLE_KEY`.
- `APP_ENV` acepta `development`, `test`, `staging` o `production`.
- `PAYMENTS_MODE` acepta únicamente `disabled` o `test`; el MVP no permite pagos
  reales.

Los módulos usan referencias estáticas a cada variable pública porque Next.js no
incluye accesos dinámicos como `process.env[nombre]` en el bundle cliente.

## Endurecimiento al conectar Supabase

Antes de crear clientes de Supabase:

1. Hacer obligatorias `NEXT_PUBLIC_SUPABASE_URL` y
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` cuando el flujo las necesite.
2. Hacer obligatoria `SUPABASE_SERVICE_ROLE_KEY` sólo para procesos concretos del
   servidor que realmente la requieran; nunca importarla desde componentes
   cliente.
3. Añadir una validación cruzada que exija credenciales en `staging` y
   `production`, manteniendo proyectos y secretos separados.
4. Mantener RLS y políticas explícitas de mínimo privilegio en toda tabla
   expuesta antes de usarla desde la aplicación.
5. Configurar secretos en la plataforma de cada ambiente; no guardarlos en Git,
   documentación, logs ni archivos públicos.
