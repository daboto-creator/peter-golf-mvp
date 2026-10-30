# Costo y privacidad de PR2

## Costo actual

El prototipo no contrata infraestructura: Vite se ejecuta localmente y la
inferencia ocurre en el dispositivo. Costo incremental de cómputo/almacenamiento
del proyecto: US$0. La descarga fría incluye el modelo Full de 9.4 MB y WASM; el
ancho de banda depende de caché y del proveedor público de assets.

Para el futuro MVP, servir assets same-origin y mantener inferencia browser-first
evita GPU permanente y conserva el presupuesto objetivo US$50–150/mes. El costo
real exige medir cache hit, sesiones, dispositivos y fallback servidor; este PR
no proyecta cifras falsas sin ese tráfico.

## Privacidad

- selección con `<input type="file">`; no upload ni endpoint;
- frames sólo en memoria, transferidos al Worker y liberados;
- URL `blob:` revocada al reemplazar/cerrar;
- no LocalStorage, IndexedDB, cookies, analytics ni entrenamiento;
- exportación iniciada manualmente y sin nombre original;
- carpetas de videos/resultados ignoradas por Git.

MediaPipe declara procesamiento on-device, pero su aviso vigente menciona métricas
de uso/rendimiento. Antes de producto se necesita decisión legal y técnica sobre
consentimiento, bloqueo de telemetría y hosting same-origin de WASM/modelo. Este
PR sólo garantiza que nuestro código no envía frames.
