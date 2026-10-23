# Benchmark de modelos de visión

## Comparación de discovery

| Criterio            | MediaPipe Pose Landmarker              | ViTPose Base Simple              | SwingTrace                               |
| ------------------- | -------------------------------------- | -------------------------------- | ---------------------------------------- |
| Propósito           | pose humana, 33 landmarks              | pose humana COCO                 | shaft, head y manos del palo             |
| Licencia declarada  | Apache-2.0                             | Apache-2.0                       | AGPL-3.0                                 |
| Artefacto           | Lite 3 MB, Full 6 MB, Heavy 26 MB      | safetensors ~344 MB más detector | pesos ~40 MB, YOLO11m                    |
| Browser             | sí, paquete `@mediapipe/tasks-vision`  | no es ruta práctica MVP          | roadmap; no disponible hoy               |
| CPU                 | optimizado on-device                   | posible, más pesado              | posible según autor                      |
| GPU                 | opcional                               | recomendable para throughput     | recomendable para throughput             |
| Privacidad          | permite mantener frames en dispositivo | normalmente servidor             | normalmente servidor/Colab               |
| Integración         | baja complejidad                       | Python/Transformers + detector   | Python/Ultralytics + condiciones legales |
| Evidencia publicada | fitness genérico, no golf              | COCO, no golf                    | 7 videos no vistos; auto-reportada       |
| Decisión            | benchmark primario                     | challenger offline               | bloqueado para producto                  |

Las métricas publicadas no se comparan directamente: usan datasets, landmarks,
hardware y objetivos distintos. Ninguna valida recomendaciones de equipo.

## Protocolo reproducible

Conjunto mínimo: 20 clips autorizados de 5–10 s, sin nombres en archivos, balanceados:

- 5 face-on y 5 down-the-line con buena luz;
- 4 con luz difícil o fondo complejo;
- 3 zurdos y al menos 3 niveles de jugador;
- 3 casos negativos: cuerpo incompleto, cámara móvil o más de una persona.

Cada clip se decodifica una vez a la misma resolución y timestamps. Cada modelo
usa una revisión fijada y se ejecuta tres veces: warm-up separado, misma máquina,
modo CPU y GPU cuando aplique. Se registran:

- frames totales y utilizables;
- presencia/visibilidad de hombros, caderas, rodillas, tobillos, codos y muñecas;
- jitter normalizado y gaps consecutivos;
- latencia end-to-end y por frame;
- memoria pico, errores y perspectiva;
- falsos positivos revisados manualmente, sin convertirlos en verdad biomecánica.

Un frame es utilizable sólo si los landmarks requeridos para la observación están
presentes sobre el umbral previamente fijado. Los umbrales no se calibran con el
conjunto de evaluación.

## Harness incluido

`experiments/swing-ai/benchmark/aggregate.mjs` valida registros JSONL y calcula
por revisión de modelo: videos, porcentaje ponderado de frames utilizables,
latencia p50/p95, memoria máxima y errores. Los registros `SYNTHETIC` se excluyen
de todas las métricas representativas y el resultado sólo es `representative`
con 20 videos distintos.

```bash
node experiments/swing-ai/benchmark/aggregate.mjs \
  experiments/swing-ai/benchmark/fixtures/synthetic-runs.jsonl
```

## Resultado actual

- Harness y validación: ejecutables.
- Inferencia real: **no ejecutada**. No se entregaron videos autorizados y no se
  descargaron clips de licencia ambigua.
- Resultados de precisión, latencia y memoria propios: **pendientes**.
- Las dos filas versionadas son sintéticas, prueban el agregador y reportan
  explícitamente `HARNESS_ONLY_NO_INFERENCE`.

## Criterio de avance

MediaPipe Full avanza si logra al menos 80% de frames utilizables en ambas vistas,
p95 menor a la duración del clip en teléfonos objetivo, cero mezcla de usuarios y
degradación explícita a `INSUFFICIENT_QUALITY`. Estos umbrales son hipótesis de
producto que requieren aprobación, no precisión biomecánica validada.

ViTPose sólo desplaza a MediaPipe si mejora materialmente calidad en los casos
difíciles y el costo/privacidad del servidor sigue dentro del presupuesto. No se
evalúa SwingTrace comercialmente hasta resolver AGPL y términos de acceso.
