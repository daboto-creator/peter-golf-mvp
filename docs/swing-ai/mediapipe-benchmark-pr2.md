# PR2: MediaPipe Swing Video Benchmark

## Resultado técnico

Se implementó un prototipo Vite/TypeScript aislado. El navegador decodifica el
video local, crea `ImageBitmap` a 10 fps y los transfiere secuencialmente a un Web
Worker. El worker ejecuta MediaPipe Pose Landmarker Full en modo `VIDEO`, devuelve
hasta 33 landmarks normalizados y cierra cada bitmap. El hilo principal calcula
calidad, dibuja una revisión y exporta resultados.

No existen imports desde la aplicación productiva ni nuevas rutas, tablas,
buckets o servicios. El prototipo acepta sólo duración 5–10 s, `FACE_ON` o
`DOWN_THE_LINE`, y requiere confirmación de derechos.

## Evidencia y confianza

Un frame es utilizable sólo cuando existe una pose con exactamente 33 landmarks y
hombros, codos, muñecas, caderas, rodillas y tobillos superan confianza 0.5. La
confianza exportada es presencia/visibilidad del modelo, no probabilidad de que una
interpretación de golf sea correcta. Frames ausentes o débiles quedan explícitos
como `NO_POSE`, `LANDMARK_COUNT` o `LOW_REQUIRED_LANDMARK_CONFIDENCE`.

## Métricas

- latencia total y por frame, p50/p95;
- frames totales/utilizables y confianza;
- errores con código/timestamp;
- memoria JS cuando Chromium expone `performance.memory`, o `null`;
- versión, delegate, resolución, MIME, duración y perspectiva;
- SHA-256 local del video, nunca el nombre original.

El agregador de PR85 fue ampliado para aceptar memoria no disponible sin
convertirla falsamente en cero.

## Resultado medido

No se ejecutó inferencia sobre personas: no hay videos autorizados. Sólo se midió
el asset oficial Full (9,398,198 bytes, SHA-256
`5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1`).
El benchmark permanece **no validado** hasta reunir 20–30 clips autorizados.

Se ejecutó además un smoke test end-to-end con un WebM sintético negro de 6.32 s,
sin persona. Esto verifica decodificación, worker, inicialización del modelo,
inferencia sin pose, exportación y agregación; no mide calidad de detección.

## Rendimiento a comparar

| Variante            | Smoke sintético (Chrome 155, macOS)                      | Pendiente con videos autorizados        |
| ------------------- | -------------------------------------------------------- | --------------------------------------- |
| MediaPipe Full CPU  | 63 frames; p50 10.8–13.3 ms; p95 14.2–16.3 ms; 0 errores | calidad y memoria por dispositivo       |
| MediaPipe Full GPU  | 63 frames; p50 11.1 ms; p95 18.0 ms; 0 errores           | calidad, warm-up y soporte WebGL real   |
| ViTPose Base Simple | no ejecutado; protocolo offline                          | mejora en casos difíciles y costo total |

CPU es el baseline reproducible. GPU no se declara superior hasta medirlo en el
mismo clip/dispositivo. ViTPose no se instala ni recibe videos en este PR.
El tiempo total GPU del primer arranque fue 5.96 s frente a 1.13–1.24 s para CPU;
la muestra única no permite separar calentamiento, descarga o compilación.

## Limitaciones

- Un solo ángulo no reconstruye movimiento 3D real.
- MediaPipe no observa el palo, impacto, vuelo, fuerza, velocidad ni spin.
- Z normalizada no sustituye calibración física.
- Oclusión, fondo, ropa, iluminación, shutter y encuadre alteran landmarks.
- La perspectiva es declarada por la persona, no inferida.
- Tres PNG ayudan a revisión, pero no son ground truth.
