# Seguridad y privacidad

## Clasificación y consentimiento

Un video identificable es dato personal. Landmarks, inferencias de movimiento y
posibles señales físicas pueden elevar el riesgo; la clasificación como dato
sensible/biométrico depende del uso, especialmente si permite identificación o
revela salud. Requiere revisión jurídica mexicana antes de beta.

El consentimiento debe ser explícito, autenticado, versionado y separado para:
análisis, retención, soporte humano y cualquier uso futuro de entrenamiento. La
opción de entrenamiento viene desactivada y no se agrupa con el servicio.

La LFPDPPP vigente exige finalidad, proporcionalidad, información, medidas de
seguridad y mecanismos ARCO; para datos sensibles exige consentimiento expreso y
por escrito. Esto es identificación de riesgo, no asesoría legal.

Fuente: [LFPDPPP vigente, Cámara de Diputados](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf).

## Controles propuestos

- Sólo usuarios autenticados; cada Server Action/Route Handler revalida sesión.
- Bucket privado, sin `getPublicUrl`; acceso por JWT o URL firmada de vida corta.
- RLS de tablas y `storage.objects` combina `to authenticated` con propiedad
  `auth.uid() = user_id`; nunca sólo el rol.
- `INSERT`, `SELECT` y `DELETE` separados. No `upsert` de videos; objetos inmutables.
- DAL server-only devuelve DTO mínimo. Ninguna service key llega al navegador.
- Validación servidor: allowlist MIME (`video/mp4`, `video/quicktime`, `video/webm`),
  firma binaria, extensión generada, 5–10 s, un clip, límite inicial 50 MB.
- Transcodificación/decodificación se considera entrada hostil: límites de frames,
  tiempo, memoria y resolución; sin metadatos de nombre/ubicación.
- Cuota propuesta: 3 análisis/día y 10/mes por usuario en beta, más límite global.
- Logs sin ruta firmada, landmarks completos, imagen, prompt privado o email.
- Cifrado en tránsito y reposo del proveedor; secretos sólo en entorno server.

Supabase permite buckets privados con RLS y restricciones por tamaño/MIME. Las
descargas requieren JWT o signed URL; una signed URL no es revocable antes de
expirar, por lo que debe ser breve y la eliminación del objeto es el corte fuerte.

Fuentes: [buckets privados](https://supabase.com/docs/guides/storage/buckets/fundamentals),
[Storage RLS](https://supabase.com/docs/guides/storage/security/access-control),
[límites de archivo](https://supabase.com/docs/guides/storage/uploads/file-limits).

## Retención y eliminación

Hipótesis para aprobación: borrar video bruto a los 7 días tras análisis exitoso
y a los 24 h tras fallo final; conservar observaciones/snapshot 12 meses o hasta
solicitud del titular. Si el usuario solicita borrar, bloquear nuevos accesos,
borrar por Storage API, verificar ausencia y después anonimizar/eliminar derivados.
Backups y logs deben estar cubiertos por la política real del proveedor.

## Abuso y aislamiento

Idempotencia, rate limit por usuario/IP, límite mensual global, timeout, máximo dos
reintentos y circuit breaker de costo. Pruebas SQL futuras deben demostrar que A
no lista, descarga, actualiza ni elimina objetos/resultados de B. Operaciones no
obtiene acceso por defecto; soporte requiere rol explícito y auditoría.

## Riesgos pendientes

- menores de edad y consentimiento del tutor;
- transferencias internacionales/subencargados;
- clasificación legal de landmarks y perfil inferido;
- aviso de privacidad, contrato de proveedores y proceso ARCO;
- sesgo por cuerpo, ropa, tono de piel, discapacidad, dispositivo y entorno;
- AGPL/Ultralytics de SwingTrace y licencias de datasets/pesos.
