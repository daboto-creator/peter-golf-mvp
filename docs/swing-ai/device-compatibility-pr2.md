# Matriz de compatibilidad de dispositivo

Esta matriz distingue un smoke sintético de validación real. Sin videos autorizados
la calidad de inferencia de cada plataforma permanece pendiente.

| Plataforma              | Worker módulo                  | `ImageBitmap` desde canvas | CPU                 | GPU            | Memoria JS                            | Estado             |
| ----------------------- | ------------------------------ | -------------------------- | ------------------- | -------------- | ------------------------------------- | ------------------ |
| Chrome 155 / macOS      | verificado                     | verificado                 | smoke aprobado      | smoke aprobado | 8.2–8.6 MB en fixture sintético       | candidato primario |
| Edge desktop actual     | esperada                       | esperada                   | pendiente con video | pendiente      | no estándar disponible frecuentemente | candidato primario |
| Safari macOS/iOS        | esperada en versiones actuales | requiere prueba por codec  | pendiente           | pendiente      | no expuesta                           | manual pendiente   |
| Firefox desktop/Android | esperada                       | requiere prueba por codec  | pendiente           | pendiente      | no expuesta                           | manual pendiente   |
| Chrome Android          | esperada                       | esperada según dispositivo | pendiente           | pendiente      | variable                              | prioridad móvil    |

## Prueba mínima por dispositivo

1. Abrir el servidor local y confirmar que el modelo inicializa.
2. Procesar el mismo clip autorizado en CPU dos veces; separar warm-up.
3. Repetir en GPU si inicializa, sin sustituir silenciosamente resultados.
4. Comparar conteo de frames, usable ratio, p50/p95 y errores.
5. Revisar PNG en FACE_ON y DOWN_THE_LINE.
6. Registrar navegador/OS fuera de campos personales.

Los codecs aceptados dependen del navegador; `accept="video/*"` no garantiza que
pueda decodificar todos los contenedores. Un error de codec debe registrarse antes
de inicializar el modelo.

El smoke verificado usó un WebM negro de 6.32 s sin persona y produjo 63 frames,
cero poses utilizables y cero errores en FACE_ON/CPU, DOWN_THE_LINE/CPU y
FACE_ON/GPU. Confirma el flujo técnico, no compatibilidad con todos los codecs ni
utilidad para fitting.
