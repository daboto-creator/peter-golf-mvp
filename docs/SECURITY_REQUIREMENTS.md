# Requisitos de seguridad

## 1. Principios

- Mínimo privilegio, denegación por defecto y defensa en profundidad.
- Recopilación mínima de datos y privacidad desde el diseño.
- Separación estricta de staging y producción.
- Controles de servidor como autoridad; la interfaz no es una frontera de seguridad.
- Registro de acciones sensibles sin incluir secretos ni datos personales innecesarios.

## 2. Secretos y ambientes

- Nunca guardar secretos en Git, documentación, código cliente, logs o mensajes de error.
- Usar variables de ambiente administradas por cada plataforma y rotarlas ante sospecha de exposición.
- No usar llaves live, secretos, datos o endpoints de producción en staging.
- No exponer una llave `service_role` de Supabase al navegador.
- Sólo variables expresamente públicas pueden llevar el prefijo público de Next.js.
- Mantener separados `peter-golf-staging` y `peter-golf-production`.

## 3. Entradas y salidas

- Validar en servidor tipo, formato, tamaño, rango y pertenencia de toda entrada no confiable.
- Normalizar datos antes de aplicar reglas de negocio.
- Escapar o codificar salidas según contexto y evitar renderizar HTML no confiable.
- Aplicar límites de tamaño y frecuencia a formularios y endpoints.
- Proteger solicitudes mutables contra abuso, repetición e idempotencia incorrecta.
- No revelar stack traces, consultas, IDs internos sensibles ni configuración en respuestas públicas.

## 4. Autenticación y autorización futuras

- Las sesiones deben usar mecanismos seguros, expiración y revocación apropiadas.
- Verificar autorización en cada lectura o mutación sensible del lado servidor.
- Requerir controles reforzados para roles administrativos.
- Evitar enumeración de cuentas y respuestas que filtren existencia de usuarios.
- Revisar cambios de rol y operaciones privilegiadas mediante auditoría.

## 5. Supabase futuro

- RLS obligatoria en todas las tablas accesibles por API.
- Crear políticas explícitas para `select`, `insert`, `update` y `delete`; no asumir que una política cubre todas las operaciones.
- Probar aislamiento entre usuarios y roles, incluyendo intentos de acceso directo.
- Restringir funciones con `security definer`, fijar su `search_path` y revisar sus permisos.
- Configurar buckets privados por defecto y políticas específicas para archivos.
- Aplicar migraciones revisadas y reproducibles; nunca editar producción de forma improvisada.

## 6. Precios e inventario

- Calcular precio, descuento, impuestos, envío y total en el servidor usando datos vigentes.
- Usar enteros para centavos y validar moneda.
- No confiar en IDs, precios, condición, stock o disponibilidad enviados por el cliente.
- Proteger ajustes y reservas con transacciones y controles de concurrencia.
- Registrar actor y motivo de cambios de inventario o precio.

## 7. Pagos

El MVP inicial no acepta pagos reales. No se debe:

- integrar Stripe u otro proveedor;
- capturar datos de tarjeta o cuenta;
- simular un cargo de forma que pueda confundirse con uno real;
- mostrar confirmaciones de pago.

Una fase futura de pagos requerirá un análisis de amenazas, proveedor aprobado, webhooks verificados, idempotencia y alcance PCI definido.

## 8. Datos personales

- Solicitar consentimiento y explicar finalidad antes de recopilar contacto.
- Limitar acceso al equipo que necesita atender la solicitud.
- Definir antes de producción plazos de conservación, derechos ARCO, aviso de privacidad y proceso de eliminación conforme a la normativa mexicana aplicable.
- Cifrar datos en tránsito y usar capacidades de cifrado administradas en reposo.
- No usar datos reales de clientes en staging.

## 9. Dependencias y operación

- Mantener dependencias revisadas y actualizadas mediante tareas separadas.
- Ejecutar lint, typecheck, pruebas y build antes de integrar.
- Configurar encabezados de seguridad y una CSP compatible antes de producción.
- Contar con respaldos, restauración probada, monitoreo y respuesta a incidentes.
- Tratar cualquier exposición de credenciales como incidente: revocar, rotar, investigar y documentar.

## 10. Criterio de salida a producción

No desplegar operación real hasta resolver hallazgos críticos/altos, aprobar políticas RLS, aviso de privacidad, control de acceso, recuperación, monitoreo y revisión legal/operativa.
