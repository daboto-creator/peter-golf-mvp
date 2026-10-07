export const firstPartyHeaders = [
  "ID externo", "Categoría", "Marca", "Modelo", "Año", "Estado", "Cantidad", "Mano", "Loft", "Bounce", "Grind", "Flex", "Material varilla", "Marca varilla", "Modelo varilla", "Peso varilla", "Grip", "Headcover", "Costo adquisición", "Precio propuesto", "Clave fotos", "Notas",
] as const;

export const partnerHeaders = [
  "ID externo", "Categoría", "Marca", "Modelo", "Año", "Estado", "Cantidad", "Mano", "Loft", "Bounce", "Grind", "Flex", "Material varilla", "Marca varilla", "Modelo varilla", "Peso varilla", "Grip", "Headcover", "Precio solicitado", "Neto deseado", "Clave fotos", "Notas",
] as const;

export const firstPartyTemplate = `${firstPartyHeaders.join(",")}\nFP-001,Driver,Titleist,GT3,2024,Usado,1,Derecho,10.5,,,Regular,Grafito,,,,Sí,10500.00,15999,GT3-001,\n`;
export const partnerTemplate = `${partnerHeaders.join(",")}\nPT-001,Wedge,Titleist,Vokey SM10,2024,Usado,1,Diestro,56,,,Stiff,Acero,,,,Sí,8999,7800,SM10-001,\n`;

export const bulkImportGuide = `# Guía de carga masiva\n\n- **ID externo** es obligatorio y único dentro del alcance de la fuente.\n- Usa categorías, marcas y modelos del catálogo; las coincidencias manuales quedan como advertencia.\n- Los montos deben escribirse sin separadores de miles (por ejemplo, 10500.00).\n- El año es opcional y representa la generación del modelo, no la compra.\n- Las fotos usan una Clave fotos como GT3-001 y archivos GT3-001-01.jpg.\n- Partner no captura costo de adquisición; puede indicar precio solicitado o neto deseado.\n- First Party requiere Costo adquisición.\n- Las filas ambiguas pueden corregirse, usarse como modelo manual o excluirse.\n`;
