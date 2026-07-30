# Configuración de Supabase local y staging

## Alcance

Esta base técnica permite ejecutar Supabase y comprobar migraciones únicamente
en la computadora de desarrollo. También existe un vínculo verificado con el
proyecto remoto de staging. Se configuró:

- Supabase CLI `2.110.0` como dependencia de desarrollo del proyecto;
- `supabase/config.toml` con Postgres 17, migraciones y semilla habilitadas;
- API y Studio locales para inspección;
- Auth, Storage, Realtime, Edge Runtime y Analytics deshabilitados;
- una migración técnica que habilita `pgcrypto`;
- un archivo de semilla intencionalmente vacío;
- el vínculo de la CLI con `peter-golf-staging`.

El estado remoto verificado es:

- organización: `daboto-creator's Org`;
- staging: `peter-golf-staging`;
- project reference: `xdulakstgsgdujjylhox`;
- migración aplicada: `20260730000000_enable_pgcrypto.sql`;
- historial local y remoto con la misma versión.

No se agregaron secretos al repositorio, no se crearon tablas de negocio y no se
implementaron autenticación ni RLS. Los pagos continúan deshabilitados.
Producción todavía no existe y no debe crearse ni vincularse en esta etapa.

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

Los archivos internos generados en `supabase/.temp/` y `supabase/.branches/`
están ignorados y no deben versionarse. Pueden contener estado local del vínculo
que no forma parte de la configuración compartida del repositorio.

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

## Staging vinculado

La CLI ya inició sesión y el repositorio quedó vinculado correctamente con:

- organización: `daboto-creator's Org`;
- proyecto: `peter-golf-staging`;
- project reference: `xdulakstgsgdujjylhox`.

La migración `20260730000000_enable_pgcrypto.sql` ya fue aplicada correctamente.
La salida de este comando muestra la misma versión local y remota:

```bash
npx supabase migration list
```

## Aplicar migraciones a staging en el futuro

Antes de aplicar cualquier migración futura, revisar obligatoriamente el plan:

```bash
npx supabase db push --dry-run
```

Después de revisar el SQL, el plan de reversión y un respaldo apropiado, la
aplicación real requiere una aprobación separada:

```bash
npx supabase db push
```

Después se debe verificar que el historial local y remoto coincida:

```bash
npx supabase migration list
```

`db push` ejecuta SQL remoto y puede contener cambios destructivos. Antes de
cada aplicación se debe confirmar que el vínculo continúa apuntando al project
reference de staging `xdulakstgsgdujjylhox`.

## Separación de ambientes

| Ambiente   | Propósito             | Datos y credenciales                                                           | Aplicación de migraciones                                    |
| ---------- | --------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Local      | Desarrollo individual | Valores locales y datos ficticios                                              | Scripts npm con `--local`                                    |
| Staging    | Integración y pruebas | Proyecto existente `peter-golf-staging`; secretos y datos ficticios exclusivos | Vínculo activo, dry run, revisión, aprobación y verificación |
| Producción | Operación real futura | No existe todavía                                                              | No crear ni vincular en esta etapa                           |

Producción todavía no existe y no debe vincularse desde este repositorio en esta
etapa. Cuando sea autorizada deberá usar un contexto operativo separado. No se
deben copiar archivos de vínculo, secretos ni datos entre ambientes.

## Variables y secretos

El vínculo con staging no modificó `.env.example` ni agregó secretos al
repositorio. Las variables actuales permanecen vacías hasta que exista una
integración funcional aprobada:

- `NEXT_PUBLIC_SUPABASE_URL`;
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`;
- `SUPABASE_SERVICE_ROLE_KEY`.

Si más adelante se usan valores locales, deben ir en `.env.local`, nunca en Git.
Sólo la URL y la llave pública correspondiente pueden llegar al navegador. Una
llave `service_role` nunca debe incluirse en código cliente, documentación,
logs ni respuestas públicas; esta tarea no la usa.

Staging y producción deben tener variables administradas por separado en cada
plataforma. Nunca se deben usar endpoints, secretos o datos de producción en
staging. Los pagos siguen deshabilitados y no se configuraron credenciales de
ningún proveedor de pagos.

## Comandos seguros y advertencias

- Usar los scripts `supabase:*` para operaciones locales.
- Mantener `--local` en `db reset` y `db lint`.
- Revisar rama, diff de migraciones y ambiente antes de aplicar cambios.
- Ejecutar `npx supabase db push --dry-run` antes de futuras migraciones.
- Ejecutar `npx supabase migration list` después de aplicarlas.
- No versionar archivos de `supabase/.temp/` ni `supabase/.branches/`.
- No ejecutar `supabase db reset --linked`: borra y reconstruye una base remota.
- No ejecutar `supabase db push` sin `--dry-run`, revisión y aprobación.
- No vincular producción: todavía no existe y está fuera del alcance actual.
- No usar `--db-url` con una URL que contenga credenciales en historial, logs o
  mensajes.
- No editar datos o esquema de producción desde Studio de forma improvisada.
