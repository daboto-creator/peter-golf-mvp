# Contratos de datos

La definición tipada de discovery vive en
`experiments/swing-ai/contracts.ts` y usa `swing-ai-discovery-v1`.

## Principios

- Toda afirmación incluye `provenance`, confianza, fecha y referencias.
- Una observación visual nunca se serializa como declaración del usuario.
- Modelo y regla guardan identificador y versión inmutables.
- `UNKNOWN` es un valor válido; no se sustituye por promedios.
- Timestamps son ISO-8601 UTC; importes son minor units MXN.
- IDs públicos son opacos; rutas de Storage nunca se entregan al modelo o UI.

## Entidades propuestas

- `SwingAnalysis`: propietario, consentimiento, objeto, captura, revisión del
  modelo, estado asíncrono, intentos, expiración y error seguro.
- `VisualObservation`: señal cualitativa, perspectiva, rango de frames,
  usable-frame ratio, confianza y limitaciones.
- `GolferFittingProfile`: vista compuesta; no es una tabla que reemplace Mi Golf.
- `FittingQuestion` / `FittingAnswer`: slot tipado, prioridad y autorización
  separada para guardar una respuesta durable.
- `EquipmentRequirement`: gate/preferencia derivada con evidencia enlazada.
- `RecommendationCandidate`: sólo producto/unidad real, gates y reglas evaluadas.
- `FittingRecommendation`: snapshot con outcome, motor, candidatos, selección,
  explicaciones y preguntas pendientes.

## Procedencias

| Valor              | Uso                                            |
| ------------------ | ---------------------------------------------- |
| `VIDEO_OBSERVED`   | salida visible del modelo, nunca verdad física |
| `USER_DECLARED`    | respuesta explícita de la sesión               |
| `PROFILE_EXISTING` | memoria Mi Golf ya autorizada                  |
| `CATALOG_VERIFIED` | atributo de producto desde adaptador seguro    |
| `DERIVED`          | regla reproducible con referencias de entrada  |
| `UNKNOWN`          | dato ausente/no observable                     |

## Persistencia futura

Las tablas deben separar análisis, observaciones, preguntas/respuestas y snapshot
de recomendación. Todas llevarían `user_id`, RLS, grants mínimos e índices por
propietario/estado. Las observaciones y recomendaciones serían append-only; sólo
estado operativo y eliminación cambiarían. El bucket sería privado y la ruta
`{user_id}/{analysis_id}/{object_id}.ext`.

No se incluye SQL en PR 1. Antes de una migración se debe decidir retención,
responsable legal, si el video/landmarks se consideran sensibles, región y flujo
ARCO/eliminación.

## Compatibilidad con contratos actuales

`Evidence` se mapea a `MatchEvidence`; `GolferFittingProfile` se adapta a
`MiGolfProfile` sin sobreescribirlo; `RecommendationCandidate` se construye desde
`InventoryUnit`; y `FittingRecommendation` puede alimentar un futuro snapshot.
El nuevo outcome `NO_SUITABLE_MATCH` debe mapearse deliberadamente desde el actual
`NO_CURRENT_MATCH`, mientras `NEEDS_MORE_DATA` permanece distinto.
