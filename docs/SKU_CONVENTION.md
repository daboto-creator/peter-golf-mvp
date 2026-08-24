# Convención SKU de Best Round Pro Shop

Aplica exclusivamente a productos nuevos. Los SKU existentes son inmutables.

## Formato

`BRPS-BRAND-TYPE[-SUBTYPE]-MODEL[-PRIMARY_SPEC][-FLEX]-CONDITION-SEQUENCE`

Sólo se incluyen segmentos con significado. Nunca se emiten `NULL`, `UNK`,
guiones vacíos ni loft/flex para categorías donde no aplican.

### Tipo

| Producto      | Código |
| ------------- | ------ |
| Driver        | `DRV`  |
| Fairway Wood  | `FW`   |
| Hybrid        | `HYB`  |
| Iron          | `IRN`  |
| Wedge         | `WDG`  |
| Putter        | `PUT`  |
| Golf Club Set | `SET`  |
| Golf Bag      | `BAG`  |

Para bolsas se agrega sólo cuando aplica `STB`, `CTB`, `TRB` o `TVB`. Pencil bag
permanece como `BAG` hasta que exista una necesidad operativa real.

### Marca y modelo

Titleist, TaylorMade, Callaway, Ping y Cobra tienen códigos conocidos `TIT`,
`TM`, `CAL`, `PNG` y `COB`. El fallback no depende de esa lista: normaliza Unicode
con NFKD, elimina diacríticos y caracteres especiales, usa iniciales en marcas
multitérmino o tres caracteres en una palabra. Una marca compuesta sólo por
símbolos recibe un hash estable no vacío. Agregar `brands.code` explícito es deuda
técnica si la operación necesita controlar colisiones semánticas o excepciones.

El modelo se normaliza a mayúsculas. Un token corto se conserva hasta ocho
caracteres; en nombres compuestos se conservan números/tokens cortos y dos
consonantes de términos largos, con máximo de diez caracteres. Así `GT3` → `GT3`,
`SM10` → `SM10` y `Stealth 2` → `ST2`.

### Spec, flex y condición

- Loft se guarda en décimas y mínimo tres dígitos: `9` → `090`, `10.5` → `105`,
  `56` → `560`.
- Iron usa su número cuando existe. Bags y sets no agregan loft.
- Flex: Regular `R`, Stiff `S`, X-Stiff `X`, Senior `SR`, Ladies `L`; si no
  aplica, se omite.
- Condición: New `N`, Used `U`; `acquisition_channel=trade_in` tiene prioridad y
  produce `T`.

## Unicidad y estabilidad

`reserve_brps_product_sku()` usa `public.brps_product_sku_sequence`. Cada reserva
obtiene un valor distinto aun con concurrencia y comprueba colisiones contra
`products` y `product_variants`; sus unique constraints siguen siendo la última
defensa. Los huecos por regeneración o transacciones fallidas son esperados y no
deben rellenarse.

El formulario reserva automáticamente cuando existen marca, categoría/tipo y
modelo, permite regenerar antes de guardar y muestra un campo de sólo lectura.
Después de crear, la acción de servidor rechaza cualquier cambio de SKU. Nombre,
precio, specs, imágenes, inventario, pricing y market research no lo regeneran.
El slug conserva su generador independiente y nunca recibe prefijo `BRPS`.

Ejemplos de base antes de la secuencia:

- `BRPS-TIT-DRV-GT3-090-R-N`
- `BRPS-TIT-WDG-SM10-560-S-N`
- `BRPS-TM-DRV-ST2-105-R-U`
- `BRPS-TIT-DRV-GT3-090-R-T`
- `BRPS-TIT-BAG-STB-PL4-N`
