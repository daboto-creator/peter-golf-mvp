# Configuración local de Supabase

## Alcance

Esta base técnica permite ejecutar Supabase y comprobar migraciones únicamente
en la computadora de desarrollo. Se configuró:

- Supabase CLI `2.110.0` como dependencia de desarrollo del proyecto;
- `supabase/config.toml` con Postgres 17, migraciones y semilla habilitadas;
- API y Studio locales para inspección;
- Auth, Storage, Realtime, Edge Runtime y Analytics deshabilitados;
- una migración técnica que habilita `pgcrypto`;
- un archivo de semilla intencionalmente vacío.

No se creó ni vinculó un proyecto remoto, no se configuraron credenciales, no se
crearon tablas de negocio y no se implementaron autenticación ni RLS. Los
recursos previstos siguen siendo:

- organización: `daboto-creator's Org`;
- staging futuro: `peter-golf-staging`;
- producción futura: `peter-golf-production`.

## Instalar y ejecutar la CLI

La CLI no se instala globalmente y no requiere `sudo`. Se instala junto con las
demás dependencias:

```bash
npm ci
```

Los scripts npm usan automáticamente el binario local. Para consultar la versión
directamente:

```bash
npx --no-install supabase --version
```

`--no-install` evita que `npx` descargue una versión distinta de la fijada en
`package-lock.json`.

## Entorno local

Iniciar la pila local requiere que Docker ya esté instalado y en ejecución. Este
repositorio no instala ni configura Docker.

```bash
npm run supabase:start
npm run supabase:status
```

La configuración usa estos puertos locales:

| Servicio      | Dirección                |
| ------------- | ------------------------ |
| API           | `http://127.0.0.1:54321` |
| Base de datos | `127.0.0.1:54322`        |
| Studio        | `http://127.0.0.1:54323` |

Para detener únicamente la pila asociada con este proyecto:

```bash
npm run supabase:stop
```

Los archivos de estado generados en `supabase/.temp/` y
`supabase/.branches/` no se versionan.

## Migraciones locales

`npm run supabase:start` aplica las migraciones pendientes al crear la base
local. Para reconstruir únicamente la base local desde cero y ejecutar de nuevo
todas las migraciones y `supabase/seed.sql`:

```bash
npm run supabase:reset
```

Este script incluye `--local`; no reinicia staging ni producción. Aun así,
elimina todos los datos de la base local.

Para revisar errores de SQL y tipos contra la base local en ejecución:

```bash
npm run supabase:lint
```

La validación de base de datos necesita la pila local activa. La CLI no ofrece
en esta versión un lint estático de migraciones que funcione sin una base.

Para crear una nueva migración vacía:

```bash
npx --no-install supabase migration new nombre_descriptivo
```

Después se debe revisar el SQL generado, comprobar que es compatible hacia
adelante y documentar una estrategia de rollback. No se deben editar
migraciones que ya hayan sido aplicadas en un ambiente compartido.

La migración inicial sólo habilita `pgcrypto`. Su rollback manual es:

```sql
drop extension if exists pgcrypto;
```

Debe ejecutarse únicamente si se confirmó que ningún objeto depende de la
extensión. No existe un script automático de rollback porque eliminar una
extensión con dependencias puede ser destructivo.

## Vínculo futuro con staging

Este procedimiento es informativo. Requiere autorización explícita y no debe
ejecutarse durante la preparación local:

1. Confirmar en el Dashboard que el proyecto se llama `peter-golf-staging` y
   pertenece a `daboto-creator's Org`.
2. Copiar el `project ref` de staging; el nombre visible no sustituye esa
   verificación.
3. Autenticarse con un perfil dedicado.
4. Vincular usando explícitamente el `project ref` verificado.
5. Comprobar el vínculo antes de cualquier operación de base de datos.

```bash
npx --no-install supabase login --profile peter-golf-staging
npx --no-install supabase link \
  --profile peter-golf-staging \
  --project-ref <STAGING_PROJECT_REF>
npx --no-install supabase migration list \
  --profile peter-golf-staging \
  --linked
```

No se guarda ningún `project ref` remoto en scripts npm. Esto obliga a una
selección consciente y reduce el riesgo de apuntar por accidente a producción.
Si el vínculo es incorrecto, no se debe ejecutar otro comando de base; primero
se debe usar:

```bash
npx --no-install supabase unlink
```

## Aplicar migraciones a staging en el futuro

Con staging ya creado, autorizado y verificado, revisar primero un dry run:

```bash
npx --no-install supabase db push \
  --profile peter-golf-staging \
  --linked \
  --dry-run
```

Después de revisar el SQL, el plan de reversión y un respaldo apropiado, la
aplicación real requiere una aprobación separada:

```bash
npx --no-install supabase db push \
  --profile peter-golf-staging \
  --linked
```

`db push` ejecuta SQL remoto y puede contener cambios destructivos. Nunca se
debe asumir que `--linked` apunta a staging: hay que verificar el proyecto antes
de cada aplicación.

## Separación de ambientes

| Ambiente   | Propósito             | Datos y credenciales                                                 | Aplicación de migraciones                                              |
| ---------- | --------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Local      | Desarrollo individual | Valores locales y datos ficticios                                    | Scripts npm con `--local`                                              |
| Staging    | Integración futura    | Proyecto `peter-golf-staging`; secretos y datos ficticios exclusivos | Perfil y vínculo verificados, revisión y aprobación                    |
| Producción | Operación real futura | Proyecto `peter-golf-production`; secretos y datos exclusivos        | Proceso de release separado, respaldo, revisión y aprobación explícita |

Producción no debe vincularse desde una sesión o perfil de staging. No se deben
copiar archivos de vínculo, secretos ni datos entre ambientes. Para producción
se recomienda un contexto operativo separado y un checklist que muestre el
nombre y el `project ref` antes de cualquier cambio.

## Variables y secretos

La estructura local no modifica `.env.example` ni agrega secretos. Las variables
actuales permanecen vacías hasta que exista una integración aprobada:

- `NEXT_PUBLIC_SUPABASE_URL`;
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`;
- `SUPABASE_SERVICE_ROLE_KEY`.

Si más adelante se usan valores locales, deben ir en `.env.local`, nunca en Git.
Sólo la URL y la llave pública correspondiente pueden llegar al navegador. Una
llave `service_role` nunca debe incluirse en código cliente, documentación,
logs ni respuestas públicas; esta tarea no la usa.

Staging y producción deben tener variables administradas por separado en cada
plataforma. Nunca se deben usar endpoints, secretos o datos de producción en
staging.

## Comandos seguros y advertencias

- Usar los scripts `supabase:*` para operaciones locales.
- Mantener `--local` en `db reset` y `db lint`.
- Revisar rama, diff de migraciones y ambiente antes de aplicar cambios.
- No ejecutar `supabase db reset --linked`: borra y reconstruye una base remota.
- No ejecutar `supabase db push` sin `--dry-run`, revisión y aprobación.
- No ejecutar `supabase link` con un `project ref` no verificado.
- No usar `--db-url` con una URL que contenga credenciales en historial, logs o
  mensajes.
- No editar datos o esquema de producción desde Studio de forma improvisada.
