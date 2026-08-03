# Perfil y direcciones del cliente

## Rutas y alcance

- `/cuenta/perfil`: consulta correo no editable, fecha de alta, nombre y teléfono; permite actualizar sólo nombre, apellido y teléfono.
- `/cuenta/direcciones`: lista exclusivamente direcciones propias, muestra estado vacío, predeterminada, edición y eliminación confirmada.
- `/cuenta/direcciones/nueva` y `/cuenta/direcciones/[id]/editar`: alta y edición móvil/accesible con país fijo `MX`.
- `/checkout`: permite elegir una dirección guardada o capturar una nueva y guardarla opcionalmente.

`profiles.id` y `addresses.user_id` siempre proceden de `auth.uid()`. El correo vive en `auth.users` y no se duplica ni modifica en esta fase. No hay cambio de correo, eliminación de cuenta, facturación ni datos financieros.

## Datos y validación

El perfil conserva `first_name`, `last_name`, `display_name` derivado y `phone`. El nombre visible completo mide de 2 a 120 caracteres; cada parte hasta 80 y el teléfono de 7 a 30. Los espacios se recortan y colapsan.

La dirección contiene etiqueta (2–40), destinatario (2–120), teléfono (7–30), calle, exterior, interior opcional, colonia, ciudad/municipio, estado, CP mexicano de cinco dígitos, referencias opcionales (máximo 500), `MX`, predeterminada y versión. `line_1` conserva la calle; `exterior_number` y `delivery_references` completan el modelo previo.

## Autorización, transacciones y concurrencia

RLS permite `SELECT` propio en `profiles` y `addresses`. Los privilegios directos de escritura están revocados. `update_customer_profile` y `manage_customer_address` son funciones con `search_path` vacío, ejecución sólo para `authenticated`, validación de `auth.uid()` y columnas explícitas; nunca reciben `user_id` ni roles.

Las mutaciones de direcciones bloquean la fila del perfil del usuario, serializando sus cambios. Al crear, editar o promover una predeterminada, se desmarca la anterior en la misma transacción. El índice único parcial `addresses_one_default_per_user_idx` es la defensa final ante concurrencia. La edición/eliminación usa `version`; eliminar la predeterminada no reasigna otra.

## Checkout y privacidad

La firma nueva de `create_customer_checkout_order` recibe opcionalmente un UUID de dirección. Si existe, SQL consulta una fila activa con `id` y `user_id = auth.uid()`, ignora los campos de dirección del navegador y construye el snapshot vigente. Si se captura una nueva, la validación existente se reutiliza; la opción de guardar participa en la misma transacción e idempotencia del pedido. No cambian envío, pago, impuestos, descuentos, totales ni inventario.

Los UUID son los únicos datos de dirección presentes en formularios/URLs. Teléfono, correo, dirección, payload, actores internos y llaves de idempotencia no se registran ni se incluyen en URLs o errores públicos.

## Pruebas y limitaciones

`src/lib/customer/address-rules.test.ts` y `src/lib/auth/validation.test.ts` cubren normalización, perfil, teléfonos, etiqueta, opcionales, CP, país y transformación. `supabase/tests/customer_profile_addresses.sql` prueba sesión, propiedad, privilegios, roles, CRUD, versión y predeterminada. `supabase/tests/customer_checkout_foundation.sql` verifica que checkout resuelva la dirección guardada real e ignore una dirección manipulada del navegador. Todas las pruebas SQL usan transacción y `ROLLBACK`.

Las direcciones históricas anteriores pueden no tener `exterior_number`; se muestran con una compatibilidad de lectura y quedan estructuradas al editarse. No se reasigna automáticamente una dirección predeterminada.
