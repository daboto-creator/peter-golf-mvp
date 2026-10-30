# Comparación offline opcional con ViTPose

ViTPose Base Simple queda como challenger y no forma parte del runtime de este PR.
Requiere Python, detector de persona y pesos sustancialmente mayores. Cualquier
comparación deberá ejecutarse offline con clips autorizados, sin subirlos a un
notebook o API de terceros.

## Protocolo

- mismo archivo decodificado, resolución y timestamps que MediaPipe;
- versiones y hashes fijados para detector y pose;
- una sola persona, misma política de errores y sin interpolación oculta;
- mapeo documentado COCO ↔ subconjunto MediaPipe, sin comparar landmarks ausentes;
- tres ejecuciones después de warm-up en hardware identificado;
- revisión ciega de frames difíciles y oclusiones;
- reporte de tiempo, memoria, tamaño de pesos y costo operativo;
- outputs sólo locales y filas JSONL marcadas con su modelo/revisión.

ViTPose sólo avanzaría si aporta mejora material revisable en frames relevantes y
su procesamiento sigue siendo privado y compatible con US$50–150/mes. No se
puede concluir nada hasta tener el conjunto autorizado.
