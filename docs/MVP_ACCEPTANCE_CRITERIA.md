# Criterios de aceptación del MVP

## 1. Propósito

Estos criterios describen el MVP funcional futuro. La etapa actual sólo entrega documentación y scaffold; no afirma que los criterios funcionales ya estén implementados.

## 2. Experiencia pública

- [ ] La experiencia está en español de México y funciona en móvil y escritorio.
- [ ] El usuario puede consultar productos publicados sin acceder a borradores o archivados.
- [ ] Cada producto muestra nombre, imágenes, especificaciones, precio de referencia en MXN, condición y disponibilidad.
- [ ] Un producto seminuevo muestra notas y evidencia visual de su condición.
- [ ] Un producto sobre pedido muestra que requiere confirmación y comunica un plazo estimado o su incertidumbre.
- [ ] No se promete stock, precio final ni entrega cuando requieren validación.
- [ ] Estados de carga, vacío, error y contenido inexistente son comprensibles.

## 3. Asesoría

- [ ] El usuario puede solicitar asesoría desde un contexto general o de producto.
- [ ] El formulario solicita sólo datos necesarios, explica la finalidad y registra consentimiento.
- [ ] La validación ocurre también en servidor y rechaza entradas inválidas o excesivas.
- [ ] El usuario recibe confirmación sin exposición de datos internos.
- [ ] El equipo puede identificar y dar seguimiento a una solicitud mediante el mecanismo operativo aprobado.
- [ ] El estado de seguimiento tiene transiciones definidas y auditables.

## 4. Intención de compra sin pago

- [x] Un operador o administrador puede registrar, editar y consultar pedidos
      manuales preliminares sin pago integrado.
- [x] Confirmar descuenta inventario de forma atómica y cancelar devuelve las
      unidades una sola vez.

- [ ] El usuario puede registrar una intención o pedido de prueba con productos válidos.
- [ ] La interfaz declara antes de confirmar que no se realizará ningún cargo.
- [ ] No se solicitan datos de tarjeta, CVV ni credenciales financieras.
- [ ] Precios y totales se recalculan en servidor; alterar valores del cliente no cambia el total autorizado.
- [ ] La confirmación se presenta como prueba o solicitud pendiente, nunca como pago realizado.
- [ ] El flujo no reserva ni descuenta inventario salvo que exista una regla aprobada y transaccional.

## 5. Operación y datos

- [ ] Se distinguen productos nuevos/seminuevos y en stock/sobre pedido.
- [ ] El inventario no puede resultar negativo.
- [ ] Los accesos del equipo respetan mínimo privilegio.
- [ ] Cambios de precio, inventario y estado relevante quedan auditados.
- [ ] Los datos necesarios pueden exportarse o consultarse para seguimiento por el equipo de dos personas sin exponer secretos.

## 6. Seguridad y privacidad

- [ ] Staging y producción usan recursos, secretos y datos separados.
- [ ] Staging no contiene llaves live ni datos reales de clientes.
- [ ] Si se implementa Supabase, todas las tablas expuestas tienen RLS y pruebas positivas/negativas.
- [ ] No existen secretos en el repositorio o bundle del cliente.
- [ ] Entradas no confiables se validan en servidor y los endpoints tienen mitigación básica de abuso.
- [ ] Aviso de privacidad, consentimiento y retención están aprobados antes de recopilar datos reales.

## 7. Calidad y entrega

- [ ] `npm run lint` termina correctamente.
- [ ] `npm run typecheck` termina correctamente.
- [ ] `npm run test` termina correctamente.
- [ ] `npm run build` termina correctamente.
- [ ] Flujos críticos cuentan con pruebas automatizadas y una pasada manual en staging.
- [ ] No hay defectos críticos o altos abiertos.
- [ ] Accesibilidad por teclado, contraste y etiquetas se revisó.
- [ ] El runbook de despliegue y rollback fue probado.

## 8. Criterio de éxito de la prueba

Antes de iniciar la prueba se deben fijar duración, muestra y metas para solicitudes de asesoría, intenciones de compra, tiempo de respuesta y retroalimentación cualitativa. Sin esos umbrales, el MVP puede verificarse técnicamente, pero no declararse validado comercialmente.
