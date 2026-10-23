# Best Round Swing AI — viabilidad técnica

Estado: discovery de PR 1, 23 de octubre de 2026. No implementa funciones comerciales.

## Dictamen

Es viable construir un fitting asistido, no un fitting biomecánico ni de launch
monitor, sobre la arquitectura actual. La ruta recomendada para el siguiente
experimento es MediaPipe Pose Landmarker Full en un Web Worker, con procesamiento
local cuando el dispositivo lo soporte y una cola asíncrona futura como fallback.
La recomendación debe seguir siendo `rules-first`: el video aporta observaciones
con procedencia y confianza, nunca especificaciones definitivas.

El go/no-go comercial queda condicionado a un benchmark de al menos 20 videos
autorizados, revisión legal del tratamiento de imagen, prueba en teléfonos objetivo
y cobertura suficiente de especificaciones reales del catálogo.

## Arquitectura realmente disponible

- Mi Golf ya persiste perfil, equipo, objetivos y snapshots privados. Las tablas
  `mi_golf_*` tienen RLS por `user_id`; `FUTURE_VIDEO` ya existe como procedencia,
  pero no existe una entidad de análisis de video.
- `nextBestQuestion` ya evita repetir algunos datos y conoce las seis categorías,
  aunque no limita formalmente a tres preguntas ni consume observaciones visuales.
- `matchEquipment()` es determinista, versionado y separa Match de Confidence.
  Sólo la mano opuesta es una incompatibilidad dura general.
- `loadInventoryUnits()` obtiene inventario propio vendible y, cuando el feature
  flag lo permite, catálogo Marketplace público ya aprobado. El DTO omite costes,
  márgenes, identidad del Partner y datos administrativos.
- El ranking vigente produce hasta tres resultados y no deja que la economía
  recalcule el Match técnico.
- No existen captura, bucket privado para swings, consentimiento específico,
  worker de visión, estados de proceso, cuotas ni eliminación automática.

PR83 ya está integrado en `main`, que es la base de esta rama. PR84 está abierto
y afecta ejecución de carga masiva Partner; este discovery no toca sus archivos.

## Señales visuales razonables

| Señal                           | Vista mínima                   | Uso permitido                    | Confianza esperable            | No concluir                             |
| ------------------------------- | ------------------------------ | -------------------------------- | ------------------------------ | --------------------------------------- |
| Postura de address              | face-on o DTL, cuerpo completo | observación descriptiva          | media con encuadre estable     | lie o longitud definitiva               |
| Flexión aparente de rodillas    | face-on                        | rango cualitativo                | media                          | ángulo clínico exacto                   |
| Orientación aparente del torso  | DTL preferida                  | cambio relativo                  | baja-media                     | plano 3D métrico                        |
| Desplazamiento lateral aparente | face-on, cámara fija           | tendencia relativa               | media                          | presión o transferencia de fuerza       |
| Posición relativa de brazos     | ambas                          | consistencia y simetría aparente | media                          | path o face angle del palo              |
| Consistencia entre frames       | cualquiera válida              | calidad del tracking             | alta como métrica del detector | consistencia de impacto                 |
| Cambio general de postura       | misma vista y escala           | observación de secuencia         | media                          | diagnóstico médico o técnico definitivo |

Requisitos: una persona, cámara fija, cuerpo completo, cabeza visible, iluminación
suficiente y 5–10 segundos. Perspectivas oblicuas reducen comparabilidad.

## Límites no negociables

Un video común no mide de forma válida club speed, ball speed, spin, launch angle,
angle of attack, face angle, lie dinámico ni shaft flex. La coordenada Z de
BlazePose no es profundidad métrica. No se deben inferir bounce/grind desde un
swing completo, ni toe hang/longitud de putter sin evidencia específica.

## Recomendación de modelos

1. **MediaPipe Pose Landmarker Full — candidato primario.** Apache-2.0, 33
   landmarks, modos imagen/video/live y ejecución web. El model card publica
   18 FPS CPU y 40 FPS GPU en Pixel 3 para Full, pero esas cifras no son un
   benchmark de golf ni resultados propios.
2. **ViTPose Base Simple — challenger de servidor.** Apache-2.0, peso publicado
   de ~344 MB y dependencia de un detector de persona. Es útil para comparar
   calidad offline; no es la primera opción para móvil ni Vercel Functions.
3. **SwingTrace — investigación solamente.** Detecta shaft/head/manos, pero sus
   pesos y código son AGPL-3.0, el acceso a pesos exige aceptar condiciones y la
   propia ficha reconoce límites y resultados auto-reportados. Requiere decisión
   legal y, posiblemente, licencia comercial de Ultralytics antes de cualquier uso.

## Fuentes primarias

- [MediaPipe Pose Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker)
- [MediaPipe web guide](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js)
- [BlazePose GHUM model card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20BlazePose%20GHUM%203D.pdf)
- [ViTPose model card](https://huggingface.co/usyd-community/vitpose-base-simple)
- [ViTPose paper](https://arxiv.org/abs/2204.12484)
- [SwingTrace model card](https://huggingface.co/nishsm/golf-club-detection-swingtrace)
