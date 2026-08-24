# Pricing Best Round

## Modelo monetario y autoridad

Todos los importes se almacenan como centavos enteros MXN mediante
`money_minor_units numeric(14,0)`. TypeScript usa enteros seguros en sus DTO y
`bigint` dentro del motor puro. PostgreSQL vuelve a calcular cada resultado al
guardar; ningún total, fee, margen o status enviado por el navegador es fuente
de verdad.

El costo de adquisición vive en `product_variants.cost`, por SKU. Los costos de
reacondicionamiento, empaque y subsidio de envío, junto con el estado operativo
actual, viven en `product_pricing`. `products.cost` se conserva sin cambios para
compatibilidad legacy. El precio final se publica en `products.price` para la
variante base canónica, por lo que catálogo, Mi Bolsa, checkout y órdenes siguen
usando una sola fuente comercial.

## Cálculo

Con costo directo `C`, target de retorno sobre costo `r`, porcentaje de
procesamiento `p` y fee fijo `f`:

```text
desiredContribution = ceil(C × r)
financialPrice = ceil((C × (1 + r) + f) / (1 - p))
estimatedPaymentFee = ceil(finalSalePrice × p) + f
expectedContribution = finalSalePrice - C - estimatedPaymentFee
returnOnCost = expectedContribution / C
marginOnSale = expectedContribution / finalSalePrice
```

Las tasas se expresan en puntos base. La configuración inicial de Stripe México
es 360 bps + 300 centavos. El semáforo es verde al cumplir el target, amarillo
hasta 1,000 bps debajo y rojo por debajo de esa tolerancia.

## Redondeo comercial

La función evalúa, en cada bloque de MXN 1,000, las terminaciones:

```text
99, 199, 299, 399, 490, 499, 599, 699, 799, 890, 899, 990, 999
```

Selecciona determinísticamente el menor candidato entero en pesos que no quede
debajo del mínimo protegido. Cuando existe un límite superior de mercado y el
próximo candidato lo excedería, conserva el mínimo exacto si éste todavía cabe
en el rango. Si ni siquiera el mínimo cabe, prioriza la protección financiera.

## Mercado

`MarketPriceProvider` mantiene la investigación desacoplada del motor. El
provider configurado para el MVP consulta Google Shopping México mediante la API
autorizada de SerpApi, exclusivamente del lado servidor y con timeout de 10
segundos. La URL de destino es fija; la consulta se construye con atributos
estructurados del producto y no acepta URLs del navegador. No se realiza
scraping directo de retailers.

Los resultados se deduplican, descartan componentes o modelos/condiciones
incompatibles, puntúan con matching determinista y eliminan outliers después
del filtro semántico. La referencia principal es la mediana; también se conserva
promedio, rango, muestra, confianza y fuentes. Sólo confianza alta o media puede
activar el ajuste automático ±10%; una referencia baja se muestra como
orientación sin desplazar el piso financiero.

La investigación se conserva durante 15 minutos por fingerprint de identidad
del producto. En edición, “Actualizar referencia de mercado” fuerza una consulta
nueva, pero nunca cambia el precio publicado hasta guardar. Si SerpApi falla,
expira o no encuentra comparables suficientes, se usa `NO_MARKET_REFERENCE` y
la creación continúa. La referencia manual sigue disponible como fallback.

La banda competitiva es ±10% de la mediana. El motor nunca baja el precio por
debajo del piso financiero para entrar en la banda. Si el piso queda debajo de
la banda, eleva la recomendación al mínimo competitivo; si queda encima, emite
`ABOVE_MARKET_WARNING`.

## Override y auditoría

Un operador puede cambiar el precio cuando queda en o sobre el piso financiero.
Sólo un admin puede quedar debajo del piso, siempre con motivo. Nadie puede
guardar debajo del costo directo. Cada cálculo crea un snapshot inmutable en
`pricing_calculations`, incluyendo actor, configuración, costos, mercado,
recomendación, precio final y métricas.

## Privacidad

Las tablas de pricing tienen RLS y lectura exclusiva para operator/admin. Las
mutaciones ocurren únicamente mediante RPC autorizados. El costo de variante no
se agrega a los grants públicos; la lectura administrativa usa un RPC privado
que devuelve un DTO reducido. Las consultas públicas continúan seleccionando
columnas explícitas sin costos ni rentabilidad.

## Decisión fiscal pendiente

IVA y fiscalidad están fuera de esta fase. Antes de incorporarlos se debe definir
si los importes del dominio son tax-inclusive o tax-exclusive. Hasta entonces el
motor trabaja solamente con costo directo, fee de procesamiento, target de
retorno y referencia de mercado.
