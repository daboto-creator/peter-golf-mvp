# Guía de carga masiva

La carga masiva acepta CSV en UTF-8 (incluido BOM), con coma o punto y coma. El límite inicial es de 500 filas. `ID externo`, categoría, estado, cantidad y la información de precio requerida deben ser revisables antes de importar.

First Party requiere `Costo adquisición`; Partner no captura ese costo y puede enviar `Precio solicitado` o `Neto deseado`. Los montos se escriben sin separadores de miles (`10500.00`). El año identifica la generación del modelo y puede quedar vacío.

Las fotos se preparan con `Clave fotos` (por ejemplo `GT3-001`) y archivos `GT3-001-01.jpg`. La carpeta de Drive sólo se valida como referencia; el flujo final copiará las imágenes a almacenamiento de Best Round. ZIP usa únicamente JPEG, PNG y WEBP y rechaza rutas inseguras.

Este PR sólo guarda un job de revisión, sus filas y auditoría. No crea productos, unidades de inventario, listings, pedidos ni pagos.
