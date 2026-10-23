# Motor de preguntas adaptativas

## Prioridad

Se conserva el flujo aprobado: primero definir qué equipo quiere mejorar y luego
handicap/nivel cuando no esté resuelto. Después se selecciona la pregunta con
mayor reducción esperada de incertidumbre.

Algoritmo determinista:

1. Unir perfil Mi Golf, equipo activo, objetivos, respuestas de sesión y
   observaciones visuales sin sobrescribir fuentes más fuertes.
2. Marcar slots conocidos, desconocidos, rechazados y no observables.
3. Aplicar gates de categoría e inventario. No preguntar algo que no pueda cambiar
   la decisión con el inventario disponible.
4. Ordenar preguntas por `CRITICAL`, `MATERIAL`, `HELPFUL`, desempatar por cantidad
   de candidatos que permite discriminar.
5. Hacer una pregunta a la vez, máximo tres adicionales en la primera pasada.
6. Si persiste un crítico, continuar o devolver `NEEDS_MORE_DATA`; nunca rellenarlo.

La respuesta actual `nextBestQuestion` es reutilizable, pero PR 2 deberá aceptar
procedencia, inventario y preguntas ya formuladas, además de corregir el slot de
stroke de putter, hoy etiquetado como `WEDGE_CONTEXT`.

## Preguntas principales

| Categoría | Preguntas materiales, si faltan                                                   |
| --------- | --------------------------------------------------------------------------------- |
| Driver    | objetivo; tendencia; contacto; distancia/velocidad conocida; driver y loft actual |
| Fairway   | uso tee/fairway; facilidad de lanzamiento; distancia objetivo; vecinos del bag    |
| Hybrid    | hierro a reemplazar; distancia objetivo; distancias de hierros/híbridos vecinos   |
| Irons     | handicap/nivel; contacto; set/distancias actuales; objetivo de mejora             |
| Wedge     | loft de PW; wedges/distancias; golpes; césped/arena; entrada al suelo             |
| Putter    | error; alineación; cabeza; stroke declarado; longitud/comodidad                   |

Presupuesto y condición son Commercial Fit: se preguntan después de los críticos
técnicos, salvo intención inmediata de compra.

## Contrato de selección

Entrada: categoría, facts con procedencia/confianza, preguntas respondidas,
observaciones, requisitos no evaluables y resumen seguro del inventario. Salida:
`question | null`, razón, criticality y candidatos afectados. El LLM puede redactar
una variante natural, pero no elegir el slot ni aceptar un valor fuera del contrato.

## Ejemplos

**Driver, perfil parcial**

> Usuario: Quiero más control con el driver.
>
> Mi Golf: Ya sé que eres diestro y handicap 18. ¿Tu falla frecuente es slice,
> hook o dispersión sin patrón?
>
> Usuario: Slice.
>
> Mi Golf: ¿Conoces el loft de tu driver actual? Si no, puedo seguir con una
> recomendación preliminar y marcarlo como pendiente.

**Wedge, no comprar por comprar**

> Usuario: Quiero otro wedge.
>
> Mi Golf: Tienes 46°, 52° y 58° registrados. ¿Qué distancia o tipo de golpe no
> estás cubriendo?
>
> Usuario: Ninguno, sólo pensaba cambiar.
>
> Mi Golf: Tu gapping declarado ya es coherente; primero validaría desgaste y
> condición antes de recomendar una compra.

**Video insuficiente**

> Mi Golf: No pude seguir hombros y caderas con suficiente confianza. No usaré
> ese video para inferir tu fitting. Puedes grabar de nuevo con cámara fija o
> continuar respondiendo preguntas sobre tu juego.
