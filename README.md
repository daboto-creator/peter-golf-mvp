# Peter Golf

Peter Golf será una tienda online de artículos de golf para México. La operación inicial estará en Querétaro y ofrecerá envíos a todo el país, con productos nuevos y seminuevos, tanto disponibles en stock como sobre pedido.

La propuesta de valor no se limita a vender productos: un equipo inicial de dos personas acompañará y asesorará al cliente durante su decisión de compra.

## Estado actual

El repositorio contiene una landing funcional de Peter Golf Pro Shop, la
documentación base del MVP, la integración tipada con Supabase de staging, la base de autenticación y
la primera base funcional del catálogo público, la gestión operativa del
catálogo, las imágenes de producto con Supabase Storage, una base auditable de
inventario operativo, la gestión transaccional de pedidos manuales, el primer
carrito/checkout autenticado, pagos por transferencia estrictamente simulados y
la administración segura del perfil y direcciones del cliente.
También incluye una outbox transaccional de notificaciones de pedidos/pagos y
entrega SMTP exclusivamente local mediante Inbucket.

Están implementados registro, confirmación, inicio/cierre de sesión, recuperación,
perfil con teléfono, direcciones guardadas, protección de `/cuenta`, listado público en `/productos`
y detalle público en `/productos/[slug]`. Los usuarios con rol `operator` o
`admin` pueden entrar a `/operacion` para crear, editar, publicar, despublicar,
archivar y restaurar productos base. El carrito y checkout autenticado generan
pedidos web pendientes de revisión, sin reservar inventario ni cobrar. Todavía
no están implementados la búsqueda avanzada, la gestión operativa de variantes o
reservas de inventario ni pagos reales o pasarelas. La CLI y los clientes tipados
apuntan al proyecto remoto de staging de Supabase; el acceso funcional usa RLS.
El MVP se validará primero sin pagos reales.
La aplicación sólo usa la llave pública `anon`/publishable y RLS; no existe un
cliente administrativo ni se usa `service_role`.

Las rutas y reglas de perfil/direcciones están documentadas en
[docs/CUSTOMER_PROFILE_AND_ADDRESSES.md](./docs/CUSTOMER_PROFILE_AND_ADDRESSES.md).

## Stack previsto

- Next.js 16 con App Router
- React 19
- TypeScript en modo estricto
- Tailwind CSS 4
- ESLint
- Supabase con base técnica local y staging vinculado; la persistencia, autenticación y almacenamiento funcionales quedan sujetos al diseño final
- Vercel como plataforma aprobada para un proyecto exclusivo de staging; el
  proyecto remoto todavía no se crea en esta preparación local

No se ha seleccionado ni integrado un proveedor de pagos.

El flujo actual de transferencia sólo registra evidencia de prueba y revisión
manual; no mueve dinero. Véase [Pagos de pedidos](./docs/ORDER_PAYMENTS.md).

## Desarrollo

El flujo esperado es:

1. Crear una rama dedicada para cada tarea.
2. Inspeccionar el repositorio y leer la documentación instalada de Next.js aplicable.
3. Implementar sólo el alcance acordado.
4. Ejecutar lint, typecheck, pruebas y build.
5. Reportar cambios, validaciones, supuestos y riesgos.
6. Abrir revisión antes de integrar; nunca hacer push directo a `main`.

Las reglas completas están en [AGENTS.md](./AGENTS.md).

## Ambientes

Staging y producción tendrán recursos, secretos y datos separados. El proyecto
Vercel de staging usará `main` como rama estable: feature branches generarán
previews y cada merge aprobado a `main` podrá desplegar el alias canónico
`vercel.app` mediante la integración GitHub–Vercel. Auth no depende de previews.

| Ambiente   | Hosting                                         | Supabase                                          |
| ---------- | ----------------------------------------------- | ------------------------------------------------- |
| Local      | Next.js y Supabase CLI en localhost             | Datos ficticios locales e Inbucket                |
| Preview    | Feature branch en el proyecto Vercel de staging | `peter-golf-staging`; sin dependencia de Auth     |
| Staging    | Alias estable `vercel.app` desde `main`         | `peter-golf-staging`, ref. `xdulakstgsgdujjylhox` |
| Producción | Proyecto Vercel futuro e independiente          | Proyecto Supabase futuro e independiente          |

Supabase staging ya está creado y vinculado mediante la CLI. Al 3 de agosto de
2026 tiene 14 de las 24 migraciones locales; las 10 pendientes se documentan en
`docs/SUPABASE_SETUP.md` y no se aplican sin respaldo lógico, dry run y
autorización separada. Se preservan sus datos actuales y no se aplica seed
remoto. El vínculo no agregó secretos al repositorio. Staging nunca debe usar
llaves live, secretos o datos de producción; pagos y notificaciones permanecen
deshabilitados.

## Comandos actuales

Requisitos: Node.js 24.x y npm.

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
npm run start
```

`npm run dev` inicia el servidor de desarrollo en [http://localhost:3000](http://localhost:3000). `npm run start` requiere haber ejecutado antes `npm run build`.

Las pruebas unitarias usan Vitest y Testing Library. Playwright cubre Desktop
Chrome, Mobile Chrome, Mobile Safari y Tablet. Para la suite local se instalan
los navegadores una vez con `npx playwright install`. El smoke remoto es manual:

```bash
PLAYWRIGHT_BASE_URL=https://<alias-canonico-staging>.vercel.app \
  npm run test:e2e -- e2e/staging-smoke.spec.ts
```

Una URL remota excluye pruebas `@mutating` salvo que se proporcione
`PLAYWRIGHT_ALLOW_MUTATIONS=1`; ese flag no se habilita contra staging en esta
fase.

Las variables disponibles y el proceso para endurecer su validación al conectar Supabase están documentados en [docs/ENVIRONMENT.md](./docs/ENVIRONMENT.md). Para desarrollo local, copiar `.env.example` a `.env.local` y mantener cualquier valor real fuera de Git.

## Clientes de Supabase

- `src/lib/supabase/client.ts` crea el cliente singleton del navegador. Sólo
  puede usar variables `NEXT_PUBLIC_*` y queda limitado por RLS.
- `src/lib/supabase/server.ts` crea un cliente nuevo por solicitud, integra las
  cookies asíncronas de Next.js 16 y usa la misma llave pública.
- `src/proxy.ts` renueva las cookies de Supabase y protege las rutas iniciales de
  cuenta; páginas y acciones vuelven a validar la sesión en servidor.
- `src/types/database.types.ts` contiene los tipos generados desde el esquema
  remoto de staging.

La configuración se valida al crear un cliente, de modo que los comandos de
calidad pueden ejecutarse sin credenciales; cualquier flujo que use Supabase
requiere `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
`SUPABASE_SERVICE_ROLE_KEY` debe permanecer ausente. En `APP_ENV=staging`, el
build también exige URLs HTTPS no locales, llave publishable, pagos y
notificaciones deshabilitados y ausencia total de variables SMTP.

## Preparación de Vercel staging

No se versionan `.vercel`, tokens ni variables reales. El proyecto remoto se
creará en una fase autorizada posterior con Next.js, Node.js 24.x y `main` como
Production Branch. Preview y staging apuntarán temporalmente al mismo
`NEXT_PUBLIC_APP_URL` canónico.

El alias de staging será accesible por URL, pero la metadata y `robots.txt`
impiden indexarlo mientras `APP_ENV` no sea `production`. Los assets generados
por Next.js usan nombres con hash y los deployments de Vercel son inmutables;
no existe service worker ni caché persistente del catálogo. El rollback de
frontend selecciona el último deployment saludable.

Inbucket y SMTP funcionan sólo en la pila local. Vercel no recibe variables
SMTP. El primer staging usa cuentas de Auth precreadas y confirmadas; registro y
recuperación no se consideran habilitados para usuarios arbitrarios.

## Catálogo público

- `/productos` lista hasta 48 productos activos, publicados y no archivados.
- `/productos/[slug]` muestra descripción, condición, precio, disponibilidad
  comercial, variantes e imágenes accesibles del producto.
- Las consultas se ejecutan en Server Components con el cliente público de
  Supabase y columnas seleccionadas explícitamente. RLS sigue siendo la barrera
  de acceso, complementada por privilegios SQL de columna; no se consulta
  inventario ni se usa `service_role`.
- Un slug inexistente, en borrador o archivado responde con la página 404 del
  catálogo. Las fallas temporales muestran un mensaje seguro sin detalles
  internos.
- La disponibilidad expuesta describe la modalidad de entrega y el plazo. Las
  cantidades exactas de inventario no son públicas y quedan sujetas a
  confirmación.
- `product_images.storage_path` guarda sólo
  `products/{product_id}/{uuid}.{jpg|png|webp}`. La aplicación resuelve la ruta
  contra el bucket público `product-images`; no guarda URLs externas.
- `ProductCard` usa la imagen principal y el detalle muestra la galería ordenada.
  Ambos mantienen fallback si no hay imágenes.

Para probar el catálogo con datos demostrativos locales:

```bash
npm run supabase:start
npm run supabase:reset
npm run dev
```

Después, abrir [http://localhost:3000/productos](http://localhost:3000/productos).
El seed crea tres productos públicos, variantes y un borrador que no debe ser
visible. No agrega imágenes binarias ni depende de una base remota.

Con el servidor local activo, la conexión de solo lectura se comprueba con:

```bash
curl --fail-with-body http://127.0.0.1:3000/api/health/supabase
```

El endpoint devuelve `200` cuando puede leer el catálogo público y `503` cuando
Supabase o la configuración no están disponibles. Su respuesta se limita a
estado, ambiente, timestamp y nombre lógico del servicio.

## Catálogo operativo

Las rutas protegidas son:

- `/operacion`: entrada al área operativa;
- `/operacion/catalogo`: listado de productos activos, borradores y archivados;
- `/operacion/catalogo/nuevo`: creación del producto base;
- `/operacion/catalogo/[id]/editar`: edición y cambios de estado.
- `/operacion/inventario`: búsqueda, filtros y saldos de inventario;
- `/operacion/inventario/[productId]`: compatibilidad y selección de variante;
- `/operacion/inventario/[productId]/[variantId]`: inicialización, ajuste e
  historial de una variante explícita.
- `/operacion/pedidos`: listado y filtros de pedidos manuales y web;
- `/operacion/pedidos/nuevo`: creación de un preliminar;
- `/operacion/pedidos/[id]`: detalle, edición preliminar, confirmación,
  cancelación y revisión separada del pago simulado.
- `/operacion/notificaciones`: cola local, reintentos y trazabilidad de correo.

Cada página y cada Server Action vuelve a comprobar la sesión y el permiso
mediante `public.can_manage_catalog()`. La función consulta `user_roles` y
`roles` con `auth.uid()`, devuelve únicamente un booleano y no confía en
`user_metadata`. Las escrituras usan el cliente público autenticado y RLS; no
usan `service_role`. Los privilegios SQL excluyen `cost` y no existe permiso de
eliminación.

El alta actual representa productos sin variantes configurables.
`create_product_with_base_variant` crea el producto y exactamente una variante
base en la misma transacción. La variante queda activa, no archivada, sin
atributos ni importes propios, y usa el SKU normalizado y el nombre del producto.
Una colisión del SKU global de variantes revierte también el producto. Editar un
producto base sincroniza atómicamente el nombre y SKU de su única variante; no
crea variantes ni altera atributos, orden, estado operativo o importes propios.
Huérfanos, variantes no canónicas, múltiples variantes y archivados se rechazan
sin cambios parciales.

Los productos históricos sin ninguna variante muestran en el detalle de
inventario la acción explícita **Crear variante base**.
`repair_product_base_variant` bloquea el producto, rechaza archivados o productos
con variantes no canónicas y devuelve la variante existente ante un reintento
canónico. No existe backfill masivo y el inventario nunca crea variantes.

### Taxonomías

La sección `/operacion/taxonomias` permite administrar marcas y categorías. Sus
listados, altas y ediciones viven bajo `/operacion/taxonomias/marcas` y
`/operacion/taxonomias/categorias`. Las categorías admiten padre y `sort_order`
numérico; no existe drag-and-drop.

Rutas disponibles:

- `/operacion/taxonomias`;
- `/operacion/taxonomias/marcas` y
  `/operacion/taxonomias/marcas/nueva`;
- `/operacion/taxonomias/marcas/[id]/editar`;
- `/operacion/taxonomias/categorias` y
  `/operacion/taxonomias/categorias/nueva`;
- `/operacion/taxonomias/categorias/[id]/editar`.

Los registros usan exclusivamente `catalog_record_status` (`active` o
`archived`) y no se eliminan físicamente. Archivar conserva productos y
relaciones históricas, pero se rechaza si existen productos activos/publicados;
una categoría tampoco puede archivarse mientras tenga hijas activas. Los padres
nuevos deben estar activos y la base impide autorreferencias y ciclos.

Los formularios de producto ofrecen sólo referencias activas para asignaciones
nuevas. Durante una edición muestran y permiten conservar la relación histórica
actual aunque esté archivada, sin ofrecer otras referencias archivadas.

Quedan fuera de esta base el borrado físico, drag-and-drop, traducciones, SEO
avanzado de taxonomías y administración o importación masiva.

Para probar un operador local:

1. iniciar Supabase y ejecutar `npm run supabase:reset`;
2. configurar `.env.local` con los valores públicos locales;
3. crear y confirmar una cuenta ficticia desde `/registro`;
4. en Studio local (`http://127.0.0.1:54323`), ejecutar el SQL de asignación
   documentado en [docs/SUPABASE_SETUP.md](./docs/SUPABASE_SETUP.md);
5. cerrar sesión, iniciar nuevamente y abrir `/operacion`.

Las migraciones operativas `20260730001000_catalog_operator_access.sql`,
`20260730001100_product_images_foundation.sql` y
`20260731000000_catalog_taxonomy_management.sql`, junto con
`20260731000100_inventory_management_foundation.sql` y
`20260731000200_catalog_base_variant_foundation.sql`, junto con
`20260731000300_catalog_base_variant_updates.sql`, permanecen únicamente
locales hasta revisión y autorización explícita. Esta base sólo crea o repara la
variante canónica; no administra variantes configurables, costos, carrito,
checkout ni pagos. Esta tarea no ejecuta `db push`
ni modifica staging.

### Imágenes de producto

En `/operacion/catalogo/[id]/editar`, operator/admin puede subir hasta 4 imágenes
por operación y 24 por producto. Cada archivo admite máximo 5 MiB y debe ser
JPEG, PNG o WebP; el servidor valida MIME, extensión, firma binaria básica,
tamaño y ruta. SVG no está permitido.

Cada Server Action revalida la sesión con `public.can_manage_catalog()` y RLS
vuelve a aplicarse sobre `product_images` y `storage.objects`. Las mutaciones de
principal, orden y metadatos usan funciones SQL que bloquean el producto para
serializar concurrencia. No se usa `service_role`.

Para probar localmente, ejecuta `npm run supabase:start`,
`npm run supabase:reset` y `npm run dev`; asigna un operador ficticio con el
procedimiento de `docs/SUPABASE_SETUP.md` y abre la edición de un producto. El
reset crea el bucket, pero no agrega binarios ni filas ficticias de imágenes.
No se implementan transformación, recorte, compresión, moderación ni
optimización avanzada de imágenes.

### Inventario operativo

El inventario reutiliza `inventory` e `inventory_movements`, ambas ligadas a
`product_variants`; no existe un modelo paralelo por producto. El listado
muestra una fila por variante activa y no archivada, y cada ajuste identifica
explícitamente `productId` y `variantId`. Los productos de una sola variante
conservan el mismo flujo; los de varias variantes administran saldos separados.
La creación y edición de variantes configurables sigue fuera de este módulo.

El flujo nuevo de catálogo evita el caso sin variante. La reparación sólo se
ofrece cuando el producto no está archivado y no tiene ninguna variante; después
de crearla, el operador todavía inicializa inventario de forma explícita.

`quantity_on_hand` es el saldo físico. La interfaz también muestra disponible
como `quantity_on_hand - quantity_reserved`, pero no implementa reservas ni
permite modificarlas. La inicialización explícita crea saldo cero sin inventar
un movimiento de cantidad cero. Los cambios posteriores admiten recepciones
positivas y ajustes/correcciones enteros positivos o negativos, siempre con
motivo. El saldo nunca puede quedar por debajo de cero ni de la cantidad
reservada ya existente.

Las RPC `initialize_inventory` y `adjust_inventory` son `security invoker`,
validan `can_manage_catalog()`, fijan `search_path` vacío y trabajan bajo RLS.
El ajuste bloquea el producto y la fila de inventario de la variante elegida,
recalcula ese saldo dentro de la transacción, lo actualiza e inserta un movimiento atómicamente. Una
llave UUID de idempotencia evita duplicados; triggers adicionales bloquean
escrituras directas fuera de las RPC. Los movimientos no pueden actualizarse ni
eliminarse.

Los productos archivados conservan saldo e historial, pero no admiten nuevos
ajustes. Ningún movimiento publica, despublica, archiva, restaura o elimina un
producto, y el catálogo público continúa sin consultar ni exponer cantidades.

Prueba local reproducible:

```bash
npm run supabase:start
npm run supabase:reset
docker exec -i supabase_db_peter-golf-mvp psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 < supabase/tests/inventory_management_foundation.sql
docker exec -i supabase_db_peter-golf-mvp psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 < supabase/tests/catalog_base_variant_foundation.sql
docker exec -i supabase_db_peter-golf-mvp psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 < supabase/tests/catalog_base_variant_updates.sql
```

La prueba usa datos ficticios dentro de una transacción y finaliza con
`ROLLBACK`. No prueba ni modifica staging.

## Documentación

- [Requisitos de producto](./docs/PRODUCT_REQUIREMENTS.md)
- [Reglas de negocio](./docs/BUSINESS_RULES.md)
- [Guía de marca](./docs/BRAND_GUIDE.md)
- [Modelo de datos](./docs/DATABASE_MODEL.md)
- [Requisitos de seguridad](./docs/SECURITY_REQUIREMENTS.md)
- [Criterios de aceptación](./docs/MVP_ACCEPTANCE_CRITERIA.md)
- [Plan de pruebas](./docs/TESTING_PLAN.md)
- [Carrito y checkout](./docs/CUSTOMER_CART_AND_CHECKOUT.md)
- [Pagos de pedidos](./docs/ORDER_PAYMENTS.md)
- [Notificaciones de pedidos y pagos](./docs/ORDER_NOTIFICATIONS.md)
- [Variables de entorno](./docs/ENVIRONMENT.md)
- [Configuración local de Supabase](./docs/SUPABASE_SETUP.md)
- [Runbook de despliegue](./docs/DEPLOYMENT_RUNBOOK.md)
