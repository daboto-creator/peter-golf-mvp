# MediaPipe Swing Video Benchmark

Prototipo browser-first aislado para evaluar Pose Landmarker Full. No se importa
desde `src/`, no agrega rutas Next.js y no persiste ni sube el video seleccionado.

## Versiones fijadas

- `@mediapipe/tasks-vision`: `1.1.1`, fijado en `package-lock.json`.
- Modelo: `pose_landmarker_full/float16/1`.
- Modelo oficial: 9,398,198 bytes.
- SHA-256 medido: `5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1`.
- Muestreo: 10 fps; umbrales de detección, presencia, tracking y usabilidad: 0.5.

El navegador obtiene WASM desde jsDelivr y el modelo desde el bucket público de
modelos de Google. Las URLs contienen versión; sólo los assets salen a red. Los
frames se transfieren como `ImageBitmap` a un Web Worker y nunca se envían a
esos orígenes. Para uso futuro se debe resolver hosting same-origin y el aviso
de métricas descrito por MediaPipe.

## Ejecutar

```bash
npm install
npm run swing-ai:dev
```

Abrir `http://127.0.0.1:4174`, elegir `FACE_ON` o `DOWN_THE_LINE`, CPU o GPU y un
clip autorizado de 5–10 segundos. Selecciona la clase de evidencia correcta; las
filas `SYNTHETIC` nunca cuentan como reales. La interfaz exige confirmación de
derechos.

Salidas descargables:

- JSON detallado con configuración, landmarks, confianza por frame, timestamps,
  errores, latencia y memoria cuando el navegador la expone;
- JSONL de una fila compatible con `../benchmark/aggregate.mjs`;
- hasta tres PNG anotados para revisión humana.

El nombre original del archivo no se exporta. `videoId` es SHA-256 calculado
localmente. Guarda exportaciones sólo en `results/`, ignorado por Git.

## Agregar videos autorizados

1. Verificar consentimiento/derechos y propósito de evaluación fuera de Git.
2. Quitar nombres, correos y otros identificadores del nombre y metadatos cuando
   sea posible; no versionar el archivo.
3. Seleccionar el archivo mediante el navegador. No es necesario copiarlo al repo.
4. Registrar perspectiva declarada, dispositivo/navegador y delegate.
5. Revisar los PNG; un landmark visible no valida una conclusión biomecánica.
6. Guardar JSON/JSONL localmente y agregar sólo filas autorizadas al análisis.
7. Repetir de forma balanceada para `FACE_ON` y `DOWN_THE_LINE`.

No se deben descargar videos de redes sociales ni reutilizar material con derechos
ambiguos. Los fixtures sintéticos sólo prueban el harness.

## Validación

```bash
npm run swing-ai:test
npm run swing-ai:build
node --test experiments/swing-ai/benchmark/aggregate.test.mjs
node experiments/swing-ai/benchmark/aggregate.mjs <archivo.jsonl>
```

## Estado de evidencia

No se recibió un conjunto autorizado. Por tanto, este PR no presenta métricas
reales ni afirma que el benchmark esté validado. El archivo `examples/` muestra
la forma de salida y está marcado `SYNTHETIC`/`EXAMPLE_ONLY_NO_INFERENCE`.

Un smoke end-to-end con un WebM negro sintético de 6.32 s verificó CPU en ambas
perspectivas y GPU en FACE_ON: 63 frames por corrida, cero poses utilizables y
cero errores. El agregador excluyó correctamente la fila `SYNTHETIC` de las
métricas representativas.

## Referencias oficiales

- [MediaPipe Tasks Vision en npm](https://www.npmjs.com/package/@mediapipe/tasks-vision)
- [Ejemplo oficial con Web Worker](https://github.com/google-ai-edge/mediapipe-samples-web/blob/main/src/workers/pose-landmarker.worker.ts)
- [Guía de Pose Landmarker para Web](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js)
