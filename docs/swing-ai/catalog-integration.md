# Integración futura con catálogo

## Ruta actual reutilizable

`src/lib/recommendations/inventory-candidates.ts` ya es el adaptador correcto:

- llama `get_best_round_first_party_inventory()` para variantes activas,
  publicadas, no archivadas, con precio y stock neto positivo;
- llama `get_public_marketplace_catalog()` sólo con Marketplace habilitado;
- la función Marketplace exige versión aprobada, quote aprobado, inventario y
  cero blockers de publicación;
- normaliza a `InventoryUnit` y omite coste, margen, comisión, identidad Partner,
  KYC, riesgo y prioridad interna.

PR 2 debe extender este DTO de lectura, no consultar tablas operativas desde UI ni
crear un segundo criterio de disponibilidad.

## Cobertura de datos

| Dato                                   | Fuente actual                             | Estado                                     |
| -------------------------------------- | ----------------------------------------- | ------------------------------------------ |
| marca/modelo/categoría                 | brands, canonical model, category profile | disponible                                 |
| loft, hand, shaft material/flex/weight | `product_club_specs`                      | disponible, nullable                       |
| grip                                   | brand/model/condition                     | disponible, no expuesto por adapter actual |
| lie y longitud                         | `product_club_specs`                      | disponible, nullable                       |
| bounce y grind                         | `product_club_specs`                      | disponible, nullable                       |
| putter head/neck                       | `product_club_specs`                      | disponible, nullable                       |
| condición/model year/precio            | products/specs/variant                    | disponible                                 |
| stock first-party                      | inventario neto                           | disponible                                 |
| Marketplace publicable                 | DTO público aprobado                      | disponible                                 |
| forgiveness/player profile             | sólo contrato TS; no columna autoritativa | gap                                        |
| launch/spin profile                    | sólo contrato TS                          | gap                                        |
| stroke fit/toe hang/face balance       | no autoritativo                           | gap                                        |
| carry por configuración                | no autoritativo                           | gap                                        |
| swing weight, torque, shaft profile    | no existe                                 | gap                                        |
| set makeup                             | atributos JSON de variante                | parcial/no normalizado                     |

La disponibilidad de columnas no garantiza cobertura por fila. Antes de beta se
requiere un reporte por categoría de completitud de specs críticas.

## Adaptador propuesto

`CatalogMatchingAdapter.listSellableCandidates(category, userId)` debe ser
server-only, autorizar al usuario, reutilizar las RPC actuales y devolver un DTO
mínimo con timestamp de verificación. No devuelve cantidades exactas al cliente,
salvo que la política comercial lo permita; el motor sí puede usar `stock > 0`.

Reglas:

- seleccionar columnas explícitas;
- validar el DTO con esquema versionado;
- mapear specs faltantes a `unknown`, no defaults comerciales;
- conservar `productId`, `unitId`, URL real y source;
- revalidar disponibilidad y precio antes de cualquier add-to-cart futuro;
- no escribir inventario, pricing, publicaciones ni recomendaciones desde el LLM.

## Gaps que bloquean precisión

Driver/irons necesitan taxonomía verificable de forgiveness/perfil. Putters
necesitan stroke-fit y propiedades de balance. Fairways/hybrids necesitan datos
de rol/carry verificados para gapping. Wedges tienen loft/bounce/grind, pero falta
cobertura y contexto de condiciones. Estos gaps deben resolverse en catálogo antes
de aumentar pesos; un nombre de modelo nunca se parsea como especificación.
