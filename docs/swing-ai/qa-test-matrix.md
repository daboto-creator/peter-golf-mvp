# Matriz de QA

## Estado de PR 1

| Escenario                    | Resultado esperado                | Cobertura    |
| ---------------------------- | --------------------------------- | ------------ |
| Driver mano opuesta          | `INCOMPATIBLE`                    | automatizada |
| Driver fuera de presupuesto  | `INCOMPATIBLE` comercial          | automatizada |
| Híbrido duplica distancia    | `INCOMPATIBLE`                    | automatizada |
| Wedge gap inapropiado        | `INCOMPATIBLE`                    | automatizada |
| Putter sin evidencia         | `NEEDS_MORE_DATA`                 | automatizada |
| Producto agotado             | excluido                          | automatizada |
| Marketplace no aprobado      | excluido                          | automatizada |
| Specs críticas faltantes     | `NEEDS_MORE_DATA`                 | automatizada |
| Perfil incompleto            | `NEEDS_MORE_DATA`                 | automatizada |
| Video baja confianza         | observación ignorada / needs data | automatizada |
| Equipo actual adecuado       | no forzar compra                  | automatizada |
| Sin producto compatible      | lista vacía, no inventar          | automatizada |
| Positivo por seis categorías | candidato elegible                | automatizada |
| Synthetic benchmark          | no cuenta como representativo     | automatizada |
| Clip fuera de 5–10 s         | rechazado por harness             | automatizada |

Pruebas: `experiments/swing-ai/fitting/prototype.test.ts` y
`experiments/swing-ai/benchmark/aggregate.test.mjs`.

## PR 2: visión

- 20 videos distintos y tres corridas por modelo/revisión;
- face-on, DTL, zurdo, niveles, iluminación y casos negativos;
- frame usability, jitter, gaps, p50/p95, memoria y error rate;
- consistencia al repetir y degradación a `INSUFFICIENT_QUALITY`;
- ningún resultado sintético mezclado con medido;
- revisión manual ciega de una muestra.

## PR 3: seguridad

- anónimo no sube/lista/lee;
- usuario A no accede a objetos, análisis ni resultados de B;
- MIME falso, polyglot, extensión, tamaño, duración y resolución inválidos;
- idempotency replay, doble worker, lease vencido y máximo de reintentos;
- cuota diaria/mensual y kill switch;
- eliminación de objeto y derivados; URL firmada corta;
- logs y errores no contienen rutas, tokens ni datos personales.

## PR 4/5: producto

- no repetir facts existentes;
- categoría y handicap conservan prioridad aprobada;
- máximo inicial de tres preguntas y continuación explícita si falta crítico;
- catálogo sólo devuelve productos reales, disponibles y publicables;
- precio/stock se revalidan y margen nunca aparece;
- explicación distingue declarado, observado, derivado y desconocido;
- snapshots conservan versiones y productos considerados;
- accesibilidad móvil, cancelación, retry y eliminación.

## Checks de repositorio

PR 1 debe terminar con `npm run lint`, `npm run typecheck`, `npm run test` y
`npm run build`. No se ejecutan migraciones ni pruebas remotas.
