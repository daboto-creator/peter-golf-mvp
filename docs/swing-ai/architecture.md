# Arquitectura propuesta

## Flujo

`captura → upload privado → análisis asíncrono → observaciones → perfil compuesto
→ preguntas → requisitos → catálogo vendible → match determinista → explicación`

Ninguna etapa de visión escribe perfil durable sin confirmación. La recomendación
usa un snapshot y referencias reales; un cambio de stock no reescribe la historia.

## Módulos

### A. Video Capture & Upload

Client Component aislado para cámara/archivo, consentimiento y preflight. Valida
duración, tamaño y tipo en cliente por UX; el servidor vuelve a validar. Upload
directo a bucket privado, nunca a través de Vercel Function (límite documentado de
payload 4.5 MB).

### B. Swing Analysis Service

Puerto provider-independent. MediaPipe puede correr en Web Worker; un fallback de
servidor futuro consume el objeto privado mediante credencial limitada. Genera
sólo `VisualObservation`, calidad y limitaciones. No genera fitting.

### C. Golfer Profile Adapter

DAL server-only que retorna DTO mínimo de Mi Golf, conserva procedencia y aplica
la precedencia: corrección manual > declaración > medición > inferencia.

### D. Adaptive Question Engine

Función determinista que selecciona un slot; el proveedor conversacional sólo
redacta/interpreta dentro del contrato validado.

### E. Golf Fitting Rules Engine

Extensión versionada del motor existente. Gates críticos separados de reglas
ponderadas; devuelve razones, tradeoffs, Confidence y datos faltantes.

### F. Catalog Matching Adapter

Reutiliza RPCs sellable-only. La interfaz no conoce costes, márgenes, Partner ni
tablas operativas.

### G. Mi Golf Conversation Adapter

Traduce códigos a lenguaje claro y distingue observado, declarado, derivado y
desconocido. No puede cambiar score, stock o precio.

### H. Recommendation History

Snapshot inmutable por usuario con engine/model version, candidatos y razones.
No debe almacenar el video dentro de JSON ni tratar inferencias como declaraciones.

## Estado asíncrono e idempotencia

Estados propuestos: `UPLOADED → QUEUED → PROCESSING → SUCCEEDED` con salidas
`INSUFFICIENT_QUALITY`, `FAILED_RETRYABLE` (máximo dos reintentos) y
`FAILED_FINAL`. Eliminación: `DELETION_PENDING → DELETED`.

`(user_id, idempotency_key)` es único. Un lease con expiración evita workers
duplicados; completar exige comparar versión/lease. Los reintentos reutilizan el
mismo objeto y revisión de modelo. El resultado previo es inmutable.

## Next.js y despliegue

La guía instalada de Next.js 16 recomienda DAL server-only, DTOs mínimos y
autorización en cada acción. Captura/MediaPipe necesitan Client Component; perfil,
catálogo y persistencia permanecen en servidor. Ningún secreto lleva prefijo
`NEXT_PUBLIC_`.

Vercel sirve UI y endpoints de control, no recibe binarios grandes ni se adopta
como worker CPU intensivo en PR 2. No se crea infraestructura pagada en PR 1.

## Cambios futuros, sujetos a aprobación

Nuevas tablas/bucket/RLS requieren migración separada, pruebas SQL locales y dry
run; no forman parte de este PR. No se alteran tablas Mi Golf actuales hasta
aprobar retención, consentimiento y modelo operativo.
