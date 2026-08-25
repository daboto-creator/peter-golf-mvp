# Marketplace Partner Listings

## Alcance de PR 3

PR 3 implementa el bounded context privado `Partner → Listing → Version →
Human Review`. Un Partner `VERIFIED` puede crear y reanudar borradores, declarar
condición, especificaciones, defectos y cantidad, gestionar fotografías privadas
y enviar una versión inmutable a Operations. `APPROVED` significa aprobado para
una activación comercial futura: no hace el listing público ni comprable.

Quedan fuera pricing Marketplace, comisiones, score, tiers, checkout, shipping,
ledger, payouts, disputas y cualquier ejecución de IA.

## Product vs Listing

`catalog_product_models` contiene únicamente identidad canónica: `brand_id +
category_id + model_name`. Referencia `brands`, `categories` y opcionalmente un
producto first-party; no contiene seller, condición ni especificaciones de una
unidad. La normalización evita duplicados case-insensitive por marca/categoría.

`marketplace_listings` pertenece a un Partner y mantiene el estado y punteros a
versiones. `marketplace_listing_versions` conserva el snapshot material: producto
canónico o propuesta, título, descripción, taxonomía, condición, specs, defectos,
serial privado, cantidad, custody y fulfillment. La condición nunca vive en el
modelo canónico. El catálogo y el inventario first-party no cambian.

Las especificaciones permanecen estructuradas en `jsonb`, pero sus campos y
validación se derivan de `category_spec_profiles` y las taxonomías existentes. No
se creó una segunda taxonomía.

## Versionado y workflow

Los estados principales de esta fase son:

```text
DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED | CHANGES_REQUESTED | REJECTED
CHANGES_REQUESTED → DRAFT → SUBMITTED
DRAFT | CHANGES_REQUESTED → ARCHIVED
```

`submit_marketplace_listing` valida readiness y cambia el snapshot actual a
`SUBMITTED`; un trigger impide reescribir su contenido material. Al solicitar
cambios se crea una nueva versión `DRAFT` que copia datos e imágenes, sin alterar
la versión revisada. `transition_marketplace_listing_status` exige versión
optimista, transición válida, capability y reason. Historial, comentarios y audit
permiten reconstruir actor, versión, decisión y fecha.

Operations puede resolver una propuesta contra un modelo existente o crear una
identidad canónica privada antes de aprobar. Los comentarios `PARTNER_VISIBLE`
son visibles al dueño; los `INTERNAL` permanecen exclusivamente en Operations.

## Readiness

`get_marketplace_listing_readiness` calcula de manera determinística:

- identidad canónica o propuesta;
- specs requeridas por el perfil de categoría;
- condición y grado cuando es usado;
- fotografías requeridas por categoría/condición;
- cantidad positiva;
- confirmación de defectos;
- título y descripción.

Sólo un Partner `VERIFIED` puede enviar. Suspensión o pérdida de elegibilidad no
elimina drafts ni historial.

## Fotografías y privacidad

El bucket `marketplace-listing-images` es privado, limita cada objeto a 10 MiB y
acepta JPEG, PNG y WebP. La aplicación valida extensión, MIME, tamaño y firma de
archivo server-side. Los paths usan UUID y quedan bajo
`partner_id/listing_id/version_id/image_id`; las lecturas usan signed URLs de
cinco minutos generadas en servidor.

Partner A no puede listar, descargar ni borrar imágenes de Partner B. Operations
requiere `can_manage_marketplace_listings`. No existe lectura pública, incluso
para `APPROVED`. Seriales y evidencia sensible no se incluyen en audit logs.

## Inventario Marketplace

`marketplace_listing_inventory` y su ledger de movimientos están separados del
inventario first-party. Admiten unidad única y multi-unidad con las invariantes:

```text
quantity_on_hand >= 0
quantity_reserved >= 0
quantity_reserved <= quantity_on_hand
quantity_available = quantity_on_hand - quantity_reserved
```

Ownership sólo puede ser `PARTNER_OWNED`. Custody admite `PARTNER_CUSTODY` y
`BEST_ROUND_CUSTODY`; fulfillment admite `PARTNER_FULFILLED` y
`BEST_ROUND_FULFILLED`. PR 3 no implementa reservas de checkout ni envío.

## Contrato futuro de Product Evaluator

La versión reserva campos estructurados para `evaluation_source` (`MANUAL`, `AI`,
`HYBRID`), status, confidence, summary y output. El futuro Product Evaluator podrá
consumir identidad, imágenes, specs, condición, defectos y descripción, y producir
identificación, condición, daños, autenticidad y recomendación. En MVP no hay
ejecución ni aprobación automática: Best Round decide.

Este contrato de producto es distinto del futuro Market/Pricing Intelligence de
PR 5. Las recomendaciones probabilísticas nunca calcularán ni persistirán dinero
sin pasar por el Pricing Engine determinístico.

## Pruebas locales

Después de `npm run supabase:reset`:

```bash
docker exec -i supabase_db_peter-golf-mvp psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 < supabase/tests/marketplace_partner_listings.sql
```

La suite usa transacción con `ROLLBACK` y prueba Partner A/B, Golfer, Partner no
verificado, Operations, anónimo, Storage, versiones, readiness e inventario.
