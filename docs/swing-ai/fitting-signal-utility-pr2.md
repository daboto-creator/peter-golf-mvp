# Utilidad visual para Mi Golf Fitting Agent

## Regla de separación

MediaPipe aporta coordenadas, presencia y visibilidad. Una transformación sólo
puede describir relaciones visibles: alineación aparente, flexión 2D, posición
relativa o consistencia de tracking. No puede diagnosticar técnica, anatomía,
causa del golpe ni especificación correcta del bastón. Toda decisión requiere
perfil declarado, datos de bola/palo cuando apliquen y catálogo verificable.

## Matriz por categoría

| Categoría    | Observación candidata                                                     | Vista                                    | Datos adicionales imprescindibles                                        | Atributos que podría ayudar a evaluar                              | No justificable desde video                              |
| ------------ | ------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------ | -------------------------------------------------------- |
| Driver       | encuadre completo, postura de address y desplazamiento lateral aparente   | ambas; lateral principalmente FACE_ON    | velocidad medida, strike, miss, launch/spin, loft actual                 | rango de loft/flex/forgiveness como hipótesis de conversación      | shaft/flex/loft óptimo, causa de slice, velocidad o spin |
| Fairway wood | postura relativa y consistencia visible entre intentos                    | ambas                                    | carry, uso tee/suelo, lie, miss y gapping                                | facilidad de lanzamiento/loft como requisito sujeto a confirmación | turf interaction, launch o carry                         |
| Hybrid       | postura aparente y altura relativa de manos                               | ambas                                    | carry, distancia respecto a hierro/madera, lie y preferencia             | loft/gapping y tolerancia como preguntas                           | que un híbrido “corrija” postura o impacto               |
| Iron         | flexión aparente, estabilidad de tracking y cambio general de postura     | ambas                                    | carry por hierro, patrón de strike, lie/length medidos, handicap         | forgiveness/perfil de lanzamiento como filtro conversacional       | lie/length/shaft correctos o diagnóstico biomecánico     |
| Wedge        | postura observable en golpe completo/parcial cuando el clip lo identifica | ambas                                    | yardages, lofts actuales, bounce/turf/sand, desgaste                     | gapping y bounce sólo combinados con respuestas                    | bounce óptimo, contacto o distancia desde pose           |
| Putter       | alineación aparente de hombros/codos si el cuerpo está visible            | preferentemente FACE_ON; DTL complementa | tipo de stroke declarado, miss, longitud/lie medidos, preferencia visual | preguntas sobre length/toe-hang/shape                              | path, face angle, impact, lectura o fitting final        |

## Contrato para futuras observaciones

Una observación derivada deberá guardar perspectiva, rango de frames, landmarks
usados, umbral, usable-frame ratio, limitaciones y `VIDEO_OBSERVED`. Si la vista
no es válida, el cuerpo está ocluido o la confianza es baja, el valor debe ser
`NOT_OBSERVABLE`. El prototipo PR2 deliberadamente no genera estas observaciones
ni modifica el motor productivo.
