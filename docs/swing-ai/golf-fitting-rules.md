# Reglas de fitting por categoría

## Modelo de decisión

El sistema propuesto conserva cuatro capas independientes:

1. **Gates críticos:** categoría, mano, disponibilidad, aprobación comercial y
   especificaciones mínimas. Un fallo excluye al candidato.
2. **Match técnico:** reglas versionadas y explicables; datos desconocidos bajan
   Confidence, no crean penalizaciones inventadas.
3. **Personal Fit:** preferencias declaradas de marca, sensación o forma.
4. **Commercial Fit:** presupuesto, condición, valor y disponibilidad. No altera
   el Match técnico ni usa margen.

La puntuación futura debe reutilizar perfiles configurables del motor actual.
Cada regla tiene peso, razón y evidencia; el denominador sólo incluye reglas
evaluables. Reglas críticas nunca se compensan con puntuación. Los pesos actuales
son una base técnica, no una validación científica, y no deben mostrarse como
probabilidad de mejora.

Salidas: `RECOMMENDATIONS`, `NEEDS_MORE_DATA` o `NO_SUITABLE_MATCH`. Una opción
preliminar siempre muestra baja confianza y sus pendientes. Si el equipo actual
parece adecuado, se dice antes de sugerir una compra.

## Driver

- Gates: mano, stock, precio verificable y categoría.
- Contexto: handicap/nivel, objetivo, tendencia, distancia habitual, contacto,
  driver/loft actual, swing speed sólo si fue medido/declarado y presupuesto.
- Se puede favorecer tolerancia, bias o ajustabilidad sólo si el producto tiene
  atributos verificados. Loft se expresa como rango preliminar con evidencia.
- Nunca asignar flex definitivo por handicap, distancia estimada o postura.

## Fairway wood

- Preguntar uso tee/fairway, capacidad de lanzamiento, distancia objetivo y bag.
- Penalizar redundancia evidente y priorizar facilidad de lanzamiento sustentada.
- No inferir carry desde el número del palo ni desde landmarks corporales.

## Hybrid

- Identificar hierro a reemplazar, distancia objetivo y vecinos del bag.
- Excluir duplicación conservadora cuando la distancia declarada/medida cae en el
  mismo intervalo que un palo activo.
- Número o loft aislado no equivale a distancia.

## Irons

- Contexto: nivel, consistencia/contacto, distancias, set actual y objetivo.
- Clasificar game-improvement, players-distance u otro perfil sólo con atributos
  de catálogo verificados; hoy ese campo no existe de forma autoritativa.
- Longitud y lie quedan pendientes de fitting profesional salvo medición válida.

## Wedges

- Gates adicionales: loft de PW, wedges activos y loft candidato.
- Rango inicial de gapping para simulación: 3–6 grados entre lofts adyacentes.
  Es configurable y requiere validación profesional; no sustituye distancias.
- Bounce/grind requieren césped/arena, tipos de golpe y entrada al suelo declarada
  o medida. Un video de swing completo no basta.

## Putters

- Requiere error declarado, alineación, comodidad/longitud, forma preferida o
  stroke con evidencia suficiente.
- Cabeza, neck y longitud pueden filtrar productos; `strokeFit` no existe hoy en
  el esquema autoritativo.
- No imponer toe hang, face balance ni longitud desde pose genérica.

## Reglas transversales

- Mano opuesta: incompatibilidad dura.
- Sin stock, precio o publicación vigente: excluir.
- Marketplace: sólo DTO público aprobado y sin blockers; nunca drafts.
- Sobre presupuesto: no presentar como recomendación normal; sólo alternativa
  explícita si producto define una tolerancia autorizada.
- Specs críticas ausentes: `NEEDS_MORE_DATA` o exclusión, según categoría.
- Video de baja calidad: ignorar observaciones visuales; continuar con preguntas.

El prototipo ejecutable en `experiments/swing-ai/fitting/` cubre estos gates sin
alterar `src/lib/matching` ni calcular un score comercial.
