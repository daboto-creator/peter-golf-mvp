# Roadmap de implementación

Cada etapa es un PR independiente, sin merge automático.

## PR 2 — benchmark y spike local de visión

Objetivo: validar MediaPipe Full en navegador, sin persistencia ni catálogo.

- conseguir consentimiento/licencia para 20–30 clips;
- fijar revisión de `@mediapipe/tasks-vision` y model bundle;
- decodificar en Web Worker, sin enviar frames a terceros;
- producir sólo landmarks/quality JSON efímero;
- ejecutar protocolo face-on/DTL y publicar resultados por dispositivo;
- comparar un subconjunto offline con ViTPose;
- decidir go/no-go, umbrales y dispositivos soportados;
- revisión legal separada de SwingTrace; no descargar pesos mientras esté bloqueado.

Criterio: benchmark representativo, p95, memoria, fallos y revisión manual; cero
rutas productivas y cero datos privados en Git.

## PR 3 — privacidad y persistencia privada

Sólo tras aprobar PR 2 y decisiones legales:

- migraciones locales para análisis/observaciones/consentimiento;
- bucket privado, RLS propietario, grants mínimos y políticas de eliminación;
- upload directo con validación servidor y cuotas;
- pruebas SQL de aislamiento, idempotencia y lifecycle;
- dry run documentado; aplicación remota requiere autorización posterior.

## PR 4 — preguntas y fitting v2

- adaptar contracts de discovery al dominio productivo;
- extender `nextBestQuestion` con inventario/procedencia y máximo inicial de tres;
- añadir outcomes separados `NEEDS_MORE_DATA` y `NO_SUITABLE_MATCH`;
- configurar reglas por categoría y validar con un profesional;
- nunca hacer de una observación visual un gate duro por sí sola.

## PR 5 — catálogo y beta autenticada

- completar atributos autoritativos priorizados;
- extender el adapter sellable-only y medir coverage;
- UI autenticada detrás de flag, no módulo público;
- snapshots, explicación de incertidumbre, feedback y handoff humano;
- kill switch y presupuesto mensual.

## PR 6 — operación controlada

Sólo si beta demuestra calidad/seguridad: worker fallback, monitoreo, soporte,
retención automática, revisión de sesgo y rollout gradual.

## Exclusiones hasta aprobación

Pagos, checkout, pricing, inventario, reglas financieras, operación Marketplace,
entrenamiento con videos de clientes, producción, SwingTrace comercial y cualquier
afirmación de fitting profesional.
