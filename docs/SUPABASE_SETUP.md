# Configuración de Supabase local y staging

## 1. Estado

El repositorio usa Supabase CLI `2.110.0`, Postgres 17, migraciones versionadas y
una semilla local. API, Studio, Auth e Inbucket (captura local compatible con
Mailpit) están habilitados para probar
registro, confirmación y recuperación. Storage está habilitado para imágenes de
producto; Realtime, Edge Runtime y Analytics continúan deshabilitados.

El esquema local actual incluye 32 tablas públicas descritas en
`docs/DATABASE_MODEL.md`, y todas tienen RLS. La referencia a `auth.users` en
`profiles` se integra con Supabase Auth mediante una migración que crea
automáticamente el perfil y el rol `customer`.

La CLI sigue vinculada con:

- organización: `daboto-creator's Org`;
- proyecto: `peter-golf-staging`;
- project reference: `xdulakstgsgdujjylhox`.

La consulta remota de sólo lectura del 3 de agosto de 2026 confirmó que staging
tiene 14 de las 24 migraciones locales: termina en
`20260731000000_catalog_taxonomy_management.sql`. Las 10 restantes no se han
aplicado. Producción no existe y no debe crearse ni vincularse en esta fase.

## 2. Migraciones

| Archivo                                                 | Contenido                                                   |
| ------------------------------------------------------- | ----------------------------------------------------------- |
| `20260730000000_enable_pgcrypto.sql`                    | Extensión técnica ya aplicada; no modificar.                |
| `20260730000100_types_functions_and_utilities.sql`      | Dominios, enums y trigger de `updated_at`.                  |
| `20260730000200_users_and_roles.sql`                    | Perfiles, roles, asignaciones y direcciones.                |
| `20260730000300_catalog.sql`                            | Marcas, categorías, productos, variantes e imágenes.        |
| `20260730000400_inventory.sql`                          | Inventario y movimientos inmutables.                        |
| `20260730000500_carts_and_orders.sql`                   | Métodos de envío, carritos y pedidos de prueba.             |
| `20260730000600_advisory_and_configuration.sql`         | Asesoría, páginas, settings y audit logs.                   |
| `20260730000700_rls_and_policies.sql`                   | RLS, políticas mínimas y permisos de funciones.             |
| `20260730000800_authentication_foundation.sql`          | Perfil automático y rol `customer` para Auth.               |
| `20260730000900_public_catalog_column_grants.sql`       | Columnas públicas mínimas del catálogo.                     |
| `20260730001000_catalog_operator_access.sql`            | Gestión base de productos para operator/admin.              |
| `20260730001100_product_images_foundation.sql`          | Bucket, políticas y funciones para imágenes.                |
| `20260730001200_fix_product_image_storage_policies.sql` | Calificación inequívoca de la ruta en políticas de Storage. |
| `20260731000000_catalog_taxonomy_management.sql`        | Gestión segura de marcas, categorías y jerarquía.           |
| `20260731000100_inventory_management_foundation.sql`    | Ajustes de inventario transaccionales, RLS e idempotencia.  |
| `20260731000200_catalog_base_variant_foundation.sql`    | Alta atómica y reparación explícita de variante base.       |
| `20260731000300_catalog_base_variant_updates.sql`       | Sincronización atómica de producto y variante base.         |
| `20260801000000_order_management_foundation.sql`        | Pedidos manuales, transiciones, RLS e inventario.           |
| `20260801000100_inventory_variant_management.sql`       | Inventario independiente por variante operativa.            |
| `20260801000200_customer_checkout_foundation.sql`       | Carrito y checkout autenticado sin pago real.               |
| `20260801000300_customer_order_read_privacy.sql`        | Proyecciones privadas de pedidos del cliente.               |
| `20260801000400_customer_profile_addresses.sql`         | Perfil, direcciones y checkout con dirección guardada.      |
| `20260803000000_order_payments_foundation.sql`          | Pagos simulados, doble kill switch, RLS e idempotencia.     |
| `20260803000100_order_notifications_foundation.sql`     | Outbox transaccional y cola de entrega local.               |

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

| Servicio            | Dirección                |
| ------------------- | ------------------------ |
| API                 | `http://127.0.0.1:54321` |
| Base de datos       | `127.0.0.1:54322`        |
| Studio              | `http://127.0.0.1:54323` |
| Inbucket/Mailpit UI | `http://127.0.0.1:54324` |
| Inbucket SMTP       | `127.0.0.1:54325`        |

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
- cuatro productos ficticios y tres variantes de presentación;
- dos métodos de envío ficticios;
- settings no secretos para staging, pagos deshabilitados y MXN.

No crea usuarios, correos, teléfonos, direcciones ni productos comerciales
reales.

El reset crea también el bucket público `product-images`, limitado a 5 MiB por
objeto y MIME JPEG/PNG/WebP. La semilla no agrega binarios ni filas de imágenes.
Para probar el flujo, asigna un operador local, inicia la aplicación y abre
`/operacion/catalogo/{uuid}/editar`. La migración queda sólo local hasta revisión
y no debe aplicarse con `db push`.

Después del reset, esta consulta local permite inspeccionar las expresiones que
PostgreSQL almacenó para las dos políticas de escritura de Storage:

```sql
select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname in (
    'catalog staff can upload valid product image objects',
    'catalog staff can delete valid product image objects'
  )
order by policyname;
```

La expresión de `foldername` debe referirse a la columna `objects.name`; no debe
contener `products.name`. La política de subida debe mostrar el predicado en
`with_check` y la de eliminación en `qual`.

Para crear una migración futura:

```bash
npx --no-install supabase migration new nombre_descriptivo
```

Se debe revisar el SQL, probar una reconstrucción completa y documentar
compatibilidad y reversión antes de enviarla a un ambiente compartido.

## 5. Asignar un operador local

El seed no fuerza registros en `auth.users` ni guarda contraseñas. Para probar
el flujo de forma segura:

1. iniciar la pila y reconstruirla con `npm run supabase:reset`;
2. crear una cuenta ficticia desde `/registro` y confirmarla en Inbucket;
3. abrir SQL Editor en Studio local (`http://127.0.0.1:54323`);
4. reemplazar el correo de ejemplo y ejecutar únicamente contra la base local:

```sql
insert into public.user_roles (user_id, role_id)
select auth_user.id, role.id
from auth.users as auth_user
cross join public.roles as role
where lower(auth_user.email) = lower('operador.local@example.test')
  and role.name = 'operator'
on conflict (user_id, role_id) do nothing;
```

Cerrar sesión y volver a iniciarla antes de abrir `/operacion`. Para retirar el
permiso local:

```sql
delete from public.user_roles as assignment
using public.roles as role, auth.users as auth_user
where assignment.role_id = role.id
  and assignment.user_id = auth_user.id
  and role.name = 'operator'
  and lower(auth_user.email) = lower('operador.local@example.test');
```

Este procedimiento es de bootstrap local, no una interfaz de administración de
roles. No debe ejecutarse contra staging o producción. La migración operativa
queda sólo local hasta revisión explícita.

Con el operador autenticado, `/operacion/taxonomias` reemplaza el uso del SQL
Editor para altas, ediciones y cambios de estado de marcas y categorías. El SQL
Editor continúa usándose sólo para el bootstrap local del rol, fuera del alcance
de esta interfaz. La migración de taxonomías queda local hasta revisión y no debe
aplicarse a staging con `db push` en esta tarea.

### Probar inventario local

Después de aplicar las migraciones a la pila local, ejecutar:

```bash
docker exec -i supabase_db_peter-golf-mvp psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 < supabase/tests/inventory_management_foundation.sql
```

La prueba crea usuarios ficticios customer/operator/admin, inicializa saldo,
prueba incremento, decremento, idempotencia, saldo negativo, escritura directa,
inmutabilidad y autorización. Todo ocurre en una transacción que finaliza con
`ROLLBACK`. La migración `20260731000100_inventory_management_foundation.sql`
permanece local hasta revisión y no debe aplicarse a staging en esta tarea.

Para validar productos con una o varias variantes y saldos independientes:

```bash
docker exec -i supabase_db_peter-golf-mvp psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 < supabase/tests/inventory_variant_management.sql
```

### Probar pedidos manuales localmente

```bash
docker exec -i supabase_db_peter-golf-mvp psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 < supabase/tests/order_management_foundation.sql
```

La prueba usa datos ficticios dentro de una transacción con `ROLLBACK`, cubre
customer/operator/admin y no depende de staging ni conserva pedidos o saldos.

### Probar carrito y checkout localmente

```bash
docker exec -i supabase_db_peter-golf-mvp psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 < supabase/tests/customer_checkout_foundation.sql
```

La prueba no depende de staging, usa sólo datos ficticios y termina con
`ROLLBACK`.

### Probar variantes base locales

Después del reset, ejecutar:

```bash
docker exec -i supabase_db_peter-golf-mvp psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 < supabase/tests/catalog_base_variant_foundation.sql
```

La prueba cubre alta atómica de producto y variante, SKU canónico, rollback por
colisión, reintento sin duplicado, edición sin variantes nuevas, reparación
explícita e idempotente de un huérfano, rechazo de archivados y autorización de
customer/operator/admin. Finaliza con `ROLLBACK`. La migración no repara datos
existentes silenciosamente y permanece sólo local hasta revisión.

Para verificar la edición sincronizada:

```bash
docker exec -i supabase_db_peter-golf-mvp psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 < supabase/tests/catalog_base_variant_updates.sql
```

Esta prueba cubre cambios de nombre y SKU, conservación de una sola variante,
rollback por colisión global, snapshot concurrente, huérfanos, archivados,
variantes múltiples/no canónicas, escrituras directas y autorización de
customer/operator/admin. También finaliza con `ROLLBACK`.

## 6. Comprobaciones RLS pendientes

Las migraciones activan RLS y crean las políticas descritas en
`docs/SECURITY_REQUIREMENTS.md`. El reset y lint validan estructura local; la
matriz completa todavía requiere pruebas positivas y negativas automatizadas
con:

- `anon`;
- usuario autenticado propietario;
- otro usuario autenticado;
- operator;
- admin.

Auth está habilitado localmente con confirmación de correo. La aplicación usa
`proxy.ts` como comprobación optimista y vuelve a validar al usuario y
`public.can_manage_catalog()` en páginas y acciones privadas. La matriz completa
de RLS sigue pendiente.

## 7. Staging vinculado

Se preservan los datos remotos actuales y no se aplica `supabase/seed.sql`.
Antes de cualquier cambio remoto, confirmar rama, diff, estrategia de reversión,
que la referencia continúa siendo `xdulakstgsgdujjylhox` y obtener un respaldo
lógico inmediatamente anterior. El RPO aprobado es ese respaldo y el RTO
objetivo es menor a cuatro horas.

Las 10 migraciones pendientes son, exactamente:

1. `20260731000100_inventory_management_foundation.sql`;
2. `20260731000200_catalog_base_variant_foundation.sql`;
3. `20260731000300_catalog_base_variant_updates.sql`;
4. `20260801000000_order_management_foundation.sql`;
5. `20260801000100_inventory_variant_management.sql`;
6. `20260801000200_customer_checkout_foundation.sql`;
7. `20260801000300_customer_order_read_privacy.sql`;
8. `20260801000400_customer_profile_addresses.sql`;
9. `20260803000000_order_payments_foundation.sql`;
10. `20260803000100_order_notifications_foundation.sql`.

El plan remoto se inspecciona con:

```bash
npx --no-install supabase db push --dry-run
```

El dry run debe enumerar sólo esa lista. Después del respaldo, revisión y una
autorización separada, la fase remota podrá ejecutar:

```bash
npx --no-install supabase db push
npx --no-install supabase migration list --linked
```

No agregar `--include-seed`. Esta preparación local no ejecuta esos comandos.
Nunca usar `supabase db reset --linked`, ya que elimina y reconstruye una base
remota.

Después de aplicar, comprobar 24 migraciones alineadas, 32 tablas públicas con
RLS, grants y funciones esperadas, bucket `product-images` y
`site_settings.payments.mode=disabled`.

## 8. Separación de ambientes

| Ambiente   | Propósito             | Datos y credenciales                            | Migraciones                    |
| ---------- | --------------------- | ----------------------------------------------- | ------------------------------ |
| Local      | Desarrollo individual | Datos ficticios y valores locales               | Scripts npm con `--local`      |
| Staging    | Integración y pruebas | Recursos exclusivos de `peter-golf-staging`     | Dry run, revisión y aprobación |
| Producción | Operación futura      | No existe; deberá tener recursos independientes | Fuera del alcance de esta fase |

No copiar datos, secretos ni archivos internos de vínculo entre ambientes.

## 9. Clientes, tipos y health check

La integración usa:

- `src/lib/supabase/client.ts`: cliente del navegador, singleton y sujeto a RLS;
- `src/lib/supabase/server.ts`: cliente nuevo por solicitud con cookies SSR de
  Next.js 16;
- `src/types/database.types.ts`: tipos TypeScript generados desde staging;
- `src/lib/supabase/health.ts`: lectura mínima y reutilizable de `brands`.

Ambos clientes usan exclusivamente `NEXT_PUBLIC_SUPABASE_URL` y
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. Los valores locales deben ir en `.env.local`,
nunca en Git. `SUPABASE_SERVICE_ROLE_KEY` permanece ausente en Preview y cuando
Stripe está deshabilitado. Sólo se admite en staging con Stripe Checkout test,
aislada al webhook y al RPC transaccional; la gestión operativa ordinaria usa la
sesión autenticada, RLS y privilegios de columna.

Staging nunca debe usar valores live ni datos de producción. Stripe Checkout se
admite exclusivamente en modo test; los pagos reales permanecen deshabilitados.

El primer staging usa cuentas de prueba precreadas y confirmadas. Registro y
recuperación no se consideran disponibles para correos arbitrarios y no se
configura SMTP. Después de conocer el alias estable `vercel.app`, configurar
manualmente en Supabase Auth:

- **Site URL:** el valor HTTPS de `NEXT_PUBLIC_APP_URL` del despliegue de staging;
- **Redirect URLs:** ese mismo origen seguido de `/auth/callback`.

Preview usa el mismo `NEXT_PUBLIC_APP_URL` canónico y no depende de Auth; no se
agregan comodines para URLs efímeras.

Esta tarea no modifica el proyecto remoto. Producción deberá usar URLs, secretos
y proyecto separados.

Para regenerar los tipos mediante una lectura del proyecto ya vinculado:

```bash
npx --no-install supabase gen types typescript \
  --project-id xdulakstgsgdujjylhox \
  --schema public
```

Revisar el diff generado antes de reemplazar
`src/types/database.types.ts`. El comando no debe combinarse con `db push`,
`link`, migraciones ni cambios remotos.

Con la aplicación activa:

```bash
curl --fail-with-body http://127.0.0.1:3000/api/health/supabase
```

`GET /api/health/supabase` consulta únicamente `id` de como máximo una marca
visible por las políticas públicas. Devuelve `200` cuando la lectura está
disponible o `503` en caso contrario. Nunca devuelve llaves, URLs, tokens,
filas, detalles de base de datos, mensajes internos ni stack traces.

Los correos locales de confirmación y recuperación se consultan en Inbucket. La
aplicación construye sus callbacks desde `NEXT_PUBLIC_APP_URL`; no acepta
destinos externos proporcionados por el usuario.

Los correos de pedidos usan el mismo buzón local mediante SMTP en `54325`,
allowlist y processor manual. Inbucket no existe en Vercel; Preview y staging
usan `NOTIFICATIONS_MODE=disabled` y no configuran variables SMTP. Véase
[ORDER_NOTIFICATIONS.md](./ORDER_NOTIFICATIONS.md).

## 10. Reversión

No existe rollback destructivo automático. Antes de aplicar a staging se debe
preparar una migración compensatoria o comprobar la restauración del respaldo.
Eliminar tablas, tipos o `pgcrypto` puede perder datos o romper dependencias y
requiere aprobación explícita. La alternativa segura durante desarrollo es
corregir con una migración nueva y reconstruir exclusivamente la base local.
Para staging se restaura el respaldo o se aplica una migración compensatoria;
nunca se usa `db reset --linked`.
