# Best Round Pro conversacional

Best Round Pro es la capa conversacional opcional sobre Mi Golf. La interfaz
puede explorar sin autenticación; la memoria durable sólo se escribe mediante
acciones de servidor autenticadas y con datos explícitos. El flujo pide una
sola pregunta material a la vez usando `nextBestQuestion`, y distingue la
intención `BUY_NOW` de `EXPLORING` sin alterar Match.

La recomendación sigue el flujo local: contexto de Mi Golf → inventario
sellable validado → `matchEquipment` → ranking comercial. No se inventan
productos, precios, stock ni descuentos. Sólo se muestran hasta tres unidades
disponibles (`BEST_OPTION`, `BEST_VALUE`, `ALTERNATIVE`), o
`NO_CURRENT_MATCH` cuando no hay una opción responsable.

La respuesta actual usa reglas deterministas (`deterministic-rules-v1`) como
fallback seguro. Un futuro proveedor de lenguaje puede recibir únicamente
razones, tradeoffs, confianza y datos de producto ya calculados; nunca puede
calcular Match, disponibilidad, precio, ranking o margen, ni escribir registros
arbitrarios. Los datos temporales (por ejemplo presupuesto) permanecen en la
sesión; los hechos durables sólo se consideran para persistencia después de una
confirmación explícita.

Objeciones MVP (precio, fit, marca, nuevo/usado, pensarlo y otra opción) se
resuelven sobre los resultados existentes sin reiniciar el diagnóstico. El
handoff a un Pro ofrece un resumen seguro orientado a WhatsApp. La telemetría
de sesión registra eventos de embudo y latencia sin exponer costes internos.
La experiencia no pretende sustituir un fitting profesional cuando faltan
datos de lanzamiento, lie, longitud, bounce, grind o stroke.
