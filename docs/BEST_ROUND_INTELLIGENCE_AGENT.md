# Diseño futuro: Best Round Intelligence Agent

PR 3 deja un contrato estructurado y sin ejecución para **Product Evaluation**:
identidad, specs, condición, fotos y defectos entran; identificación, daños,
autenticidad, confidence y recomendación podrán salir. Best Round conserva la
decisión humana. **Market/Pricing Intelligence** permanece separado para PR 5 y
consumirá comparables normalizados; ninguna salida probabilística modifica dinero
directamente.

Estado: **POST-MVP / no implementado en esta rama**.

## Límite de responsabilidad

`Product → Best Round Intelligence Agent → web research → comparables → evidence
→ confidence → MarketPriceResult → pricing engine determinista → aprobación humana`

El agente investiga y explica evidencia. No decide el precio final, no escribe
costos y no evita la aprobación humana. El pricing engine existente conserva las
reglas financieras, fee, costo directo, retorno objetivo, fallback y redondeo.

## Interfaz recomendada

Implementar un nuevo `MarketPriceProvider` que reciba el `MarketPriceInput`
vigente y devuelva el `MarketPriceResult` existente. Cada comparable debe incluir
merchant, nombre, precio original/MXN, URL, disponibilidad, condición, alcance de
mercado, score, fecha y confianza. La salida debe validarse con Zod antes de
persistirla.

Se reutilizan:

- `MarketPriceProvider`, `MarketPriceInput` y `MarketPriceResult`;
- matching, estadísticas, resiliencia y fallback;
- fingerprint, cache de 15 minutos y `market_price_researches`;
- UI de Market Research y la separación actual del pricing engine.

El agente reemplazaría o complementaría únicamente la obtención de comparables
de `SerpApiMarketPriceProvider`. SerpApi permanece como provider vigente y puede
servir como herramienta/fallback. Se conservan normalización, exclusión,
estadística, trazabilidad, cache y aprobación.

## Seguridad, configuración y evals

Será necesaria `OPENAI_API_KEY` exclusivamente server-side, separada por ambiente
y nunca expuesta a bundles, logs o snapshots. También se requieren límites de
tiempo/costo, allowlist de herramientas, protección ante prompt injection web,
URLs seguras, evidencia citable y degradación a `unavailable`.

Evals mínimos: dataset versionado por familia/condición, exactitud de matching,
rechazo de accesorios/financiamiento/outliers, conversión monetaria, cobertura de
México, calibración de confidence, fidelidad de citas, resistencia a injection,
latencia/costo y comparación contra SerpApi. La promoción requiere thresholds y
revisión humana de falsos positivos/negativos.
