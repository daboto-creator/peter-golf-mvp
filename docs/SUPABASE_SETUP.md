# Configuración de Supabase local y staging

## 1. Estado

El repositorio usa Supabase CLI `2.110.0`, Postgres 17, migraciones versionadas y
una semilla local. API y Studio están habilitados para inspección; Auth,
Storage, Realtime, Edge Runtime y Analytics continúan deshabilitados como
servicios locales.

El esquema v1 incluye las 24 tablas públicas descritas en
`docs/DATABASE_MODEL.md`, y todas tienen RLS. La referencia a `auth.users` en
`profiles` prepara el modelo para habilitar Auth más adelante; todavía no existe
un flujo de autenticación en la aplicación.

La CLI sigue vinculada con:

- organización: `daboto-creator's Org`;
- proyecto: `peter-golf-staging`;
- project reference: `xdulakstgsgdujjylhox`.

Sólo `20260730000000_enable_pgcrypto.sql` está confirmada como aplicada
remotamente. Las migraciones v1 nuevas se validaron de forma local y no se han
enviado a staging. Producción no existe y no debe crearse ni vincularse en esta
fase.

## 2. Migraciones

| Archivo                                            | Contenido                                            |
| -------------------------------------------------- | ---------------------------------------------------- |
| `20260730000000_enable_pgcrypto.sql`               | Extensión técnica ya aplicada; no modificar.         |
| `20260730000100_types_functions_and_utilities.sql` | Dominios, enums y trigger de `updated_at`.           |
| `20260730000200_users_and_roles.sql`               | Perfiles, roles, asignaciones y direcciones.         |
| `20260730000300_catalog.sql`                       | Marcas, categorías, productos, variantes e imágenes. |
| `20260730000400_inventory.sql`                     | Inventario y movimientos inmutables.                 |
| `20260730000500_carts_and_orders.sql`              | Métodos de envío, carritos y pedidos de prueba.      |
| `20260730000600_advisory_and_configuration.sql`    | Asesoría, páginas, settings y audit logs.            |
| `20260730000700_rls_and_policies.sql`              | RLS, políticas mínimas y permisos de funciones.      |

No se deben editar migraciones aplicadas en un ambiente compartido. Cualquier
corrección posterior debe ser una migración nueva y compatible hacia adelante.

## 3. Instalar y ejecutar

La CLI se instala como dependencia del proyecto, nunca con `sudo`:

```bash
npm ci
npx --no-install supabase --version
```

Docker debe estar instalado y en ejecución. Iniciar la pila:

```bash
npm run supabase:start
npm run supabase:status
```

Servicios locales:

| Servicio      | Dirección                |
| ------------- | ------------------------ |
| API           | `http://127.0.0.1:54321` |
| Base de datos | `127.0.0.1:54322`        |
| Studio        | `http://127.0.0.1:54323` |

Para detener únicamente esta pila:

```bash
npm run supabase:stop
```

`supabase/.temp/` y `supabase/.branches/` están ignorados y no deben
versionarse.

## 4. Reconstrucción y validación local

Reconstruir la base local desde cero aplica todas las migraciones y después
`supabase/seed.sql`:

```bash
npm run supabase:reset
npm run supabase:lint
```

`supabase:reset` incluye `--local`: elimina sólo los datos de la base local y no
reinicia staging o producción. `supabase:lint` necesita la pila activa y falla
ante errores SQL o de tipos.

La semilla es idempotente y contiene únicamente:

- roles `customer`, `operator` y `admin`;
- tres marcas ficticias;
- tres categorías ficticias;
- dos métodos de envío ficticios;
- settings no secretos para staging, pagos deshabilitados y MXN.

No crea usuarios, correos, teléfonos, direcciones ni productos comerciales.

Para crear una migración futura:

```bash
npx --no-install supabase migration new nombre_descriptivo
```

Se debe revisar el SQL, probar una reconstrucción completa y documentar
compatibilidad y reversión antes de enviarla a un ambiente compartido.

## 5. Comprobaciones RLS pendientes

La migración activa RLS y crea las políticas descritas en
`docs/SECURITY_REQUIREMENTS.md`. Antes de integrar un cliente de Supabase se
deben agregar pruebas positivas y negativas con:

- `anon`;
- usuario autenticado propietario;
- otro usuario autenticado;
- operator;
- admin.

Auth está deshabilitado localmente, por lo que esta tarea valida creación del
esquema y lint SQL, no un flujo de sesión real. Al habilitar Auth se deberá
definir el alta controlada de `profiles` y ejecutar la matriz completa.

## 6. Staging vinculado

Antes de cualquier cambio remoto, confirmar rama, diff, respaldo, estrategia de
reversión y que la referencia continúa siendo `xdulakstgsgdujjylhox`.

El plan remoto se inspecciona con:

```bash
npx --no-install supabase db push --dry-run
```

La aplicación real requiere revisión y autorización separada:

```bash
npx --no-install supabase db push
npx --no-install supabase migration list
```

Esta fase no ejecuta esos comandos. Nunca usar `supabase db reset --linked`, ya
que elimina y reconstruye una base remota.

## 7. Separación de ambientes

| Ambiente   | Propósito             | Datos y credenciales                            | Migraciones                    |
| ---------- | --------------------- | ----------------------------------------------- | ------------------------------ |
| Local      | Desarrollo individual | Datos ficticios y valores locales               | Scripts npm con `--local`      |
| Staging    | Integración y pruebas | Recursos exclusivos de `peter-golf-staging`     | Dry run, revisión y aprobación |
| Producción | Operación futura      | No existe; deberá tener recursos independientes | Fuera del alcance de esta fase |

No copiar datos, secretos ni archivos internos de vínculo entre ambientes.

## 8. Variables y secretos

Las variables siguen vacías hasta que exista una integración funcional:

- `NEXT_PUBLIC_SUPABASE_URL`;
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`;
- `SUPABASE_SERVICE_ROLE_KEY`.

Los valores locales deben ir en `.env.local`, nunca en Git. Sólo URL y llave
pública pueden llegar al navegador. `service_role` se reserva para operaciones
server-side concretas, con validación de rol, mínimo privilegio y auditoría.

Staging nunca debe usar valores live ni datos de producción. Los pagos reales
permanecen deshabilitados y no se configuró proveedor alguno.

## 9. Reversión

No existe rollback destructivo automático. Antes de aplicar a staging se debe
preparar una migración compensatoria o una estrategia de restauración probada.
Eliminar tablas, tipos o `pgcrypto` puede perder datos o romper dependencias y
requiere aprobación explícita. La alternativa segura durante desarrollo es
corregir con una migración nueva y reconstruir exclusivamente la base local.
