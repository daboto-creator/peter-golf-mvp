# Auditoría de rebranding Best Round Pro Shop

Fecha de corte: 2026-08-24.

## Identidad oficial

- Nombre comercial visible: **Best Round Pro Shop**.
- Abreviatura operativa: **BRPS**. Se usa en SKU y documentación técnica, no como sustituto innecesario del nombre comercial.
- Nombres anteriores: **Peter Golf** y **Peter Golf Pro Shop**.
- Logos oficiales: `public/logos/best-round-pro-shop-dark.png` sobre fondos claros y `public/logos/best-round-pro-shop-light.png` sobre fondos oscuros.

## Clasificación de ocurrencias

### A. Cambiar ahora

Se actualizan las superficies vigentes de `src/`: header, footer, autenticación,
Home, cuenta, catálogo, producto, carrito, checkout, confirmación, Stripe,
operación, catálogo administrativo, inventario, pedidos, notificaciones, Pricing,
mensajes, sender visible, títulos, OpenGraph y Organization JSON-LD. También se
actualizan README y documentación funcional vigente.

El logo anterior deja de cargarse. `BrandLogo` centraliza selección de asset,
dimensiones intrínsecas, `object-contain`, preload del header/auth y proporción.

### B. Cambiar para registros futuros

- Producto nuevo: SKU `BRPS-*`, reservado por secuencia PostgreSQL.
- Orden futura: objetivo `BRPS-W-*` y `BRPS-M-*`, pendiente de una migración
  exclusiva de órdenes.
- Sender externo futuro: nombre Best Round Pro Shop y dominio autenticado de la
  marca cuando exista; los dominios `.test` actuales no deben migrarse a tráfico
  real.

### C. Conservar legacy

- Todos los SKU existentes `PG-*`, `STR-*` u otros.
- Todos los `order_number` históricos `PG-*` y snapshots de SKU en órdenes.
- Fixtures y pruebas históricas que validan lectura de datos `PG-*`.
- Migraciones ya aplicadas y nombres internos `peter_golf.*`; renombrarlos no
  aporta valor visible y elevaría riesgo de despliegue.
- IDs/nombres actuales de infraestructura: repositorio, paquete
  `peter-golf-mvp`, proyecto local, `peter-golf-staging` y futuro nombre previsto
  en las instrucciones del repositorio.
- Cookie `pg-password-recovery`, dominios SMTP `.test` y rutas de contenedores
  locales mientras sigan siendo contratos técnicos vigentes.
- `public/logos/peter-golf-pro-shop.jpg` queda sin uso como asset legacy; no se
  elimina automáticamente.

### D. Requiere decisión

- `order_number`: cambiarlo exige ampliar `orders_number_format` y redefinir las
  funciones security-sensitive `create_manual_order` y
  `create_customer_checkout_order`. Ambas devuelven hoy una variable local con
  prefijo `PG`, por lo que un trigger cosmético produciría una respuesta distinta
  al valor persistido. Se difiere para una migración con pruebas de idempotencia,
  Stripe, webhooks, correo, búsqueda admin y replay.
- Favicon/app mark: `src/app/favicon.ico` es un símbolo genérico, no el monograma
  oficial “B + bandera”. No existen `icon`, `apple-icon` ni manifest. No se
  inventa un monograma a partir de los logos cuadrados.
- Renombrar repositorio, paquete, proyectos Supabase/Vercel, dominios y claves
  técnicas requiere coordinación externa y no forma parte de esta rama.

## App mark recomendado

Solicitar al diseñador el monograma oficial separado, con área segura y fondo
transparente, en SVG maestro y PNG de 16, 32, 48, 180, 192 y 512 px. Después se
podrán entregar `favicon.ico`, `icon.png`, `apple-icon.png` y los iconos del
manifest sin reconstruir ni recolorear la marca.
