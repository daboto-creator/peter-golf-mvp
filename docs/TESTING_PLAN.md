# Plan de pruebas

## 1. Objetivo

Verificar que Peter Golf cumpla requisitos funcionales futuros, proteja datos y comunique correctamente que el MVP no realiza pagos. Este plan crecerá junto con la implementación.

## 2. Estado actual

El repositorio dispone de:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:watch`
- `npm run test:e2e`
- `npm run build`

Las pruebas unitarias usan Vitest y Testing Library. Las pruebas E2E usan Playwright y se ejecutan localmente; todavía no forman parte del workflow de CI para evitar descargar navegadores en esta fase.

El catálogo incorpora pruebas unitarias deterministas para formateo de importes
en unidades menores, condición, mensajes de disponibilidad y validación de rutas
de imagen. La gestión operativa agrega pruebas de validación de producto,
conversión exacta de precio, generación/validación de slug, reglas de
publicación y resolución reutilizable de autorización. No dependen de Supabase
remoto.

La base de imágenes agrega pruebas unitarias para MIME, extensión, tamaño,
firma binaria básica, cantidad, rutas seguras, texto alternativo, evidencia de
condición, orden, promoción de principal y compensación de borrado.

La gestión de taxonomías agrega pruebas deterministas para nombre, slug, estados,
orden, UUID de padre, autorreferencia, ciclos, selección de referencias activas,
conservación de relaciones archivadas actuales y mensajes de conflicto. No usa
staging ni servicios remotos.

La gestión de inventario agrega pruebas unitarias de cantidades enteras,
movimientos permitidos, notas, cálculo de saldo, prevención de disponible
negativo, niveles de stock y transformación del historial. La prueba SQL local
`supabase/tests/inventory_management_foundation.sql` cubre inicialización,
incremento, decremento, idempotencia, inmutabilidad y RLS para customer,
operator y admin dentro de una transacción con `ROLLBACK`.

La prueba SQL local
`supabase/tests/catalog_base_variant_foundation.sql` verifica que la creación
operativa produzca exactamente una variante base en la misma transacción, que
normalice y respete la unicidad del SKU, que un conflicto revierta también el
producto y que reintentos o ediciones no creen duplicados. También cubre la
reparación explícita de huérfanos, el rechazo de archivados y la matriz
customer/operator/admin, siempre con `ROLLBACK` y sin staging.

`supabase/tests/catalog_base_variant_updates.sql` añade cambios sincronizados de
nombre/SKU, atomicidad ante colisiones, edición sin duplicados, bloqueo de
escritura directa, rechazo de huérfanos/archivados/variantes no canónicas o
múltiples, snapshot de estado concurrente y autorización customer/operator/admin.

## 3. Pirámide de pruebas

### Estáticas

- ESLint sin errores.
- TypeScript estricto sin errores.
- Build de producción exitoso.
- Revisión de secretos y configuración por ambiente.

### Unitarias

- Reglas de condición y disponibilidad.
- Cálculo server-side de subtotales y totales.
- Conversión y redondeo de centavos.
- Validadores de formularios y transiciones de estado.
- Jerarquía acíclica de categorías y selección segura de taxonomías.
- Plazos y mensajes para productos sobre pedido.
- Validación y consistencia de imágenes de producto.
- Creación atómica y reparación idempotente de variantes base.

### Integración

- Persistencia y restricciones del modelo.
- Autorización por rol y propiedad.
- RLS con casos permitidos y denegados cuando exista Supabase.
- Concurrencia de inventario y prevención de cantidades negativas.
- Creación de solicitud de asesoría e intención sin pago.

### End-to-end

- Navegar listado y detalle publicado.
- Distinguir nuevo/seminuevo y stock/sobre pedido.
- Enviar una solicitud válida y manejar errores.
- Registrar intención de compra sin solicitar pago.
- Intentar manipular precio, producto, cantidad o estado desde el cliente.
- Confirmar que borradores y recursos ajenos no sean accesibles.
- Confirmar que un cliente reciba 403 en `/operacion` y que un operador pueda
  crear, editar, publicar, despublicar, archivar y restaurar.
- Confirmar que sólo operator/admin puede gestionar imágenes y que IDs de otro
  producto son rechazados.

### Manuales

- Responsive en tamaños móviles y escritorio.
- Navegación por teclado, foco visible, etiquetas, contraste y lector de pantalla en rutas críticas.
- Contenido, fotografías y descripción de seminuevos.
- Mensajes de error, vacío, espera y ausencia de red.
- Revisión operativa por las dos personas del equipo.

## 4. Matriz mínima de datos

| Dimensión      | Casos                                                                           |
| -------------- | ------------------------------------------------------------------------------- |
| Condición      | nuevo, seminuevo con desgaste                                                   |
| Disponibilidad | en stock, agotado, sobre pedido                                                 |
| Estado         | borrador, publicado, pausado, archivado                                         |
| Precio         | válido, cero no permitido según regla, límite, manipulado                       |
| Cantidad       | 1, máximo permitido, 0, negativa, no entera, superior a stock                   |
| Contacto       | válido, campos vacíos, formato inválido, longitud excesiva, contenido malicioso |
| Acceso         | público, cliente propietario, otro cliente, staff, admin                        |
| Envío          | Querétaro, otra entidad con cobertura, código postal inválido/no cubierto       |

## 5. Seguridad

- Intentos de XSS, inyección, acceso directo a objetos y escalamiento de rol.
- Rate limiting o mitigación de spam en formularios.
- Ausencia de secretos y datos personales en HTML, bundles, logs y errores.
- Aislamiento de staging/producción.
- Pruebas por operación de cada política RLS.
- Confirmación de que no existe captura ni transmisión de datos de pago.

## 6. Ambientes y datos

- Pruebas automatizadas deterministas y aisladas.
- Staging con datos ficticios claramente identificados.
- Nunca copiar datos reales de producción a staging.
- Semillas futuras sin teléfonos, correos o direcciones de personas reales.
- Limpiar o anonimizar artefactos de prueba según política.

## 7. Ejecución por tarea

Cuando existan todos los scripts:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Playwright requiere instalar el navegador local una vez con:

```bash
npx playwright install chromium
```

## 8. Evidencia y salida

Cada entrega debe registrar comandos, resultado, ambiente, pruebas manuales y defectos conocidos. Un release no avanza con fallas de build, defectos críticos/altos, controles de acceso sin comprobar o ambigüedad sobre pagos reales.
