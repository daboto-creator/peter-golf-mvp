# Reglas de negocio

## 1. Mercado y operación

- Peter Golf vende y envía únicamente dentro de México durante el MVP.
- La operación inicial y el equipo de dos personas se ubican en Querétaro.
- La cobertura nacional no implica una tarifa ni tiempo uniforme; ambos dependen del destino, producto y paquetería futura.
- Ninguna fecha de entrega es garantía hasta que el equipo valide disponibilidad y logística.

## 2. Producto

- Todo producto debe indicar una condición: `nuevo` o `seminuevo`.
- Un seminuevo debe describir de manera honesta desgaste, defectos conocidos, accesorios incluidos y evidencia visual suficiente.
- Todo producto debe indicar un modo de disponibilidad: `en_stock` o `sobre_pedido`.
- `en_stock` significa existencia operativa verificada, no disponibilidad perpetua.
- `sobre_pedido` requiere confirmación de proveedor, plazo y precio antes de comprometer la operación.
- Un producto no publicable no debe aparecer en el canal público.

## 3. Inventario

- El inventario no puede quedar negativo.
- Sólo unidades confirmadas pueden considerarse disponibles.
- Una solicitud de asesoría o intención de compra no reserva inventario por sí sola.
- La política de reservación, duración y liberación queda pendiente antes de habilitar pedidos reales.
- Los cambios de inventario deben ser atómicos y auditables cuando exista persistencia.
- Un pedido manual preliminar no reserva ni descuenta inventario. Confirmarlo
  descuenta existencias atómicamente y cancelarlo devuelve exactamente lo
  descontado; un cancelado no puede volver a confirmarse.

## 4. Precios

- La moneda comercial es peso mexicano (`MXN`).
- Los importes se almacenarán en unidades mínimas enteras (centavos), nunca en punto flotante.
- El precio visible debe aclarar si incluye IVA y si el envío se calcula aparte; la política fiscal definitiva está pendiente.
- El servidor es la única autoridad para precio, descuento, impuesto, envío y total.
- Los valores enviados por el cliente nunca se aceptan como importes finales.
- Para productos sobre pedido, el precio puede ser indicativo hasta confirmación explícita.

## 5. Asesoría

- La asesoría busca orientar, no garantizar rendimiento deportivo ni sustituir una evaluación profesional especializada.
- El contacto debe contar con consentimiento y limitarse al propósito informado.
- El equipo debe registrar contexto útil y evitar datos personales innecesarios.
- Horarios y objetivo de tiempo de respuesta quedan pendientes de decisión operativa.

## 6. Pedidos de prueba

- El MVP inicial no procesa pagos ni realiza cargos.
- Toda confirmación debe indicar que se trata de una prueba o intención de compra.
- Un pedido de prueba no crea obligación de surtir, facturar o enviar hasta validación manual.
- No deben solicitarse ni almacenarse números de tarjeta, CVV, cuentas bancarias u otras credenciales de pago.

## 7. Envíos, cambios y devoluciones

- Los envíos se cotizarán según destino, dimensiones, peso, valor y disponibilidad de cobertura.
- Los tiempos de productos sobre pedido se comunican como estimados.
- Las políticas finales de cambios, devoluciones, garantías, daños y riesgo de transporte deben aprobarse antes de producción.
- Los seminuevos requieren reglas específicas de aceptación y devolución antes de una venta real.

## 8. Estados propuestos

- Producto: `borrador`, `publicado`, `pausado`, `archivado`.
- Solicitud de asesoría: `nueva`, `en_contacto`, `resuelta`, `cerrada`.
- Intención/pedido de prueba: `iniciada`, `pendiente_confirmacion`, `confirmada_prueba`, `cancelada`.

Las transiciones finales, responsables y tiempos de conservación se validarán con el equipo antes de implementarse.
