# Best Round Pro: inventario y ranking comercial

## Alcance

PR77 agrega dos capas separadas: la resolución de unidades realmente vendibles y un ranking comercial determinista. No implementa conversación, no investiga precios y no modifica el motor técnico de PR76.

El flujo es:

`inventario validado → matchEquipment() de PR76 → Personal Fit → Commercial Fit → máximo 3 recomendaciones`

## Match técnico inmutable

El ranking consume `status`, `matchScore`, `confidence`, razones, compromisos, datos faltantes y `ruleVersion` tal como los entrega PR76. Nunca recalcula ni modifica esos campos. Precio, condición, marca preferida, costo, margen, promoción, antigüedad e intención de compra no entran al Equipment Match.

## Inventory Candidate

Una unidad contiene identidad de producto y variante/listado, modelo canónico cuando existe, categoría, marca, modelo, condición, precio vigente, existencias disponibles y especificaciones reales. La disponibilidad se calcula del lado servidor:

- primera parte: producto publicado y activo, variante activa, precio vigente y `quantity_on_hand - quantity_reserved > 0`;
- Marketplace: se reutiliza el catálogo público aprobado, sus bloqueadores de publicación, Partner elegible, cotización aprobada y stock disponible;
- `UNAVAILABLE` y `UNKNOWN` no entran a recomendaciones confirmadas.

La carga es acotada y en lote: un RPC para primera parte y el RPC Marketplace existente. No hace consultas por candidato.

## Personal Fit

Es un resultado separado e inspeccionable. Solo considera preferencias explícitas de marca y condición. No tener una marca preferida no penaliza el Match; usado tampoco se considera peor por defecto.

## Commercial Fit

Contiene únicamente información segura para el consumidor:

- `budgetFit`: `WITHIN_BUDGET`, `SLIGHTLY_ABOVE` (hasta 10%), `MATERIALLY_ABOVE` o `UNKNOWN`;
- `valueClass`: valor relativo determinista entre alternativas técnicamente responsables;
- disponibilidad confirmada;
- elegibilidad para desempate comercial, sin revelar el motivo financiero.

## Jerarquía determinista

Solo participan unidades `AVAILABLE`, con precio y stock positivo, estado técnico `MATCH` y Match mínimo 60. La selección procede por bandas técnicas: una alternativa a más de 3 puntos del líder técnico no puede superarlo. Dentro de una banda de hasta 3 puntos se ordena por:

1. Confidence;
2. ajuste al presupuesto;
3. preferencias explícitas;
4. valor;
5. señal comercial interna;
6. Match y clave estable como desempates finales.

Así, una unidad Match 94 siempre precede a una Match 86 aunque la segunda tenga mejor margen. Una 92 y una 90 pueden desempatar comercialmente solo si coinciden en los factores previos. La señal interna es un entero derivado en servidor; costo, margen, comisión y prioridad comercial nunca aparecen en el DTO seguro ni llegan al futuro LLM.

## Roles y valor

- `BEST_OPTION`: primera unidad responsable en el orden combinado, dominado por compatibilidad técnica.
- `BEST_VALUE`: alternativa al menos 15% más barata que Best Option y con Match mínimo 70.
- `ALTERNATIVE`: siguiente opción responsable y distinta.

Se devuelven como máximo tres productos únicos. No se rellenan posiciones con productos débiles ni se duplica un producto por tener varias variantes idénticas.

## Sin candidato actual

Inventario vacío, ninguna unidad disponible, todo incompatible o todo debajo de 60 produce `NO_CURRENT_MATCH` y una lista vacía. El contrato conserva el umbral 85 para una futura alerta de Target Profile/saved search, sin implementar persistencia ni alertas en PR77.

## Límites y seguridad

El ranking es una función pura, sin red, base de datos, IA ni aleatoriedad. El adaptador de inventario usa consultas server-only y DTOs mínimos. Marketplace mantiene su modelo de propiedad y revisión; la identidad del Partner no se expone ni se usa como preferencia encubierta. La disponibilidad debe volver a validarse en checkout para resolver carreras posteriores al ranking.
