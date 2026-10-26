# Propuesta Go/No-Go para PR3

## Decisión actual

**GO para ejecutar un benchmark controlado; NO-GO para integrar Swing AI al
producto o al motor de fitting.** El software es ejecutable, pero no existe aún
evidencia representativa con personas autorizadas.

## Gates para reconsiderar PR3

- mínimo 20 videos distintos y objetivo 20–30, balanceados entre FACE_ON y
  DOWN_THE_LINE;
- consentimiento/derechos verificables y cero archivos personales en Git;
- revisión humana de frames, no sólo usable ratio automático;
- al menos 80% de frames utilizables por vista como hipótesis previamente fijada;
- p95 compatible con procesar el clip en dispositivos objetivo;
- errores explícitos, sin observaciones inventadas por baja confianza;
- prueba en Chrome/Edge desktop y al menos un Android/iOS objetivo;
- decisión sobre métricas MediaPipe, assets same-origin y consentimiento;
- revisión de que cualquier señal propuesta sólo describe postura observable;
- evaluación de si ViTPose mejora casos difíciles dentro de privacidad/presupuesto.

Si falla calidad por una vista, PR3 debe limitar esa vista o declararla no
observable. Si falla costo/privacidad, se detiene la integración. Un PR3 futuro
requerirá aprobación humana independiente y no está iniciado por este trabajo.
