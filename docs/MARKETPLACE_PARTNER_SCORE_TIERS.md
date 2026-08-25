# Marketplace Partner Score y Tiers

## Alcance de PR 4

PR 4 agrega el bounded context privado `Score events → Score snapshot → Rolling
volume → Tier state`. No hace pública la reputación, no calcula comisiones y no
habilita Marketplace, pricing, checkout, shipping, ledger ni payouts.

El Score y el Tier son independientes: el Score mide confiabilidad operacional;
el Tier selecciona el nivel más alto cuyos requisitos de Score y volumen se
cumplen simultáneamente. `BOGEY` es fallback y un Score `PROVISIONAL` tiene cap
configurable, inicialmente `PAR`.

## Configuración versionada

Cada cálculo referencia una versión publicada e inmutable de configuración. El
baseline incluye prior 8/10 (Score neutral 80), umbral establecido de cinco
órdenes, siete pesos que suman 10,000 bps, outcomes estructurados, decay por
severidad, cuatro bandas de antigüedad, cap provisional, siete días de estabilidad
y catorce de protección. Publicar una configuración incompleta, con pesos distintos
de 10,000 bps o thresholds desordenados falla transaccionalmente.

El mapping de comisión existente permanece en `marketplace_tier_rules`, sin entrar
al cálculo de Score. PR 5 consumirá el Tier vigente; PR 4 no calcula dinero.

## Evidencia y snapshots

`partner_score_events` y `partner_ratings` son append-only e idempotentes. Sólo
workflows autorizados u Operations pueden registrar evidencia; el Partner no puede
insertarla. Los siete componentes almacenan numerador, observaciones, Score ajustado,
peso, contribución y resumen estructurado en un snapshot inmutable.

La fórmula determinística usa enteros/bps:

```text
adjusted_rate = (score_sum + prior_success_equivalent × 10000)
                / (observations + prior_observations)
raw_weighted_score = Σ(component_score × component_weight / 10000)
calculated_score = clamp(raw_weighted_score - active_penalties, 0, 10000)
```

Un override de Score, siempre razonado y auditado, produce `final_score_bps` sin
reescribir la evidencia ni el cálculo normal.

## Rolling volume y Tier

`partner_daily_listing_metrics` reconstruye los últimos 30 días configurables desde
historial de status e inventario append-only. Excluye días previos a la primera
verificación y días no elegibles. En esta fase sólo `APPROVED` con modelo canónico e
inventario disponible cuenta; la regla está centralizada y preparada para migrar a
`PUBLISHED`. Drafts, rechazados, vendidos, expirados y archivados no cuentan.

Las promociones exigen siete días consecutivos. Si se rompe la elegibilidad, el
timer se reinicia. Los downgrades esperan catorce días y se cancelan si el Partner se
recupera. Un riesgo crítico puede omitir el grace operacional y abre
`SUSPENSION_REVIEW`; no suspende automáticamente al Partner.

`partner_tier_history` conserva tier anterior/nuevo, snapshot, promedio, versión de
configuración, actor/job, motivo y fecha. `partner_score_tier_state` es sólo el cache
actual para lectura eficiente.

## Jobs e idempotencia

`pg_cron` ejecuta `run_marketplace_score_tier_job` diariamente a las 05:15 UTC. Se
eligió el scheduler transaccional ya disponible en PostgreSQL para no introducir un
servicio externo ni una credencial privilegiada en Vercel. Cada job y cálculo tiene
una key única, advisory locks y verificación de payload en replay. Puede reintentarse
sin duplicar snapshots.

Operations puede ejecutar un recálculo manual con reason. El job expira penalties y
overrides de manera idempotente, recalcula el estado normal y audita cambios. Los
penalties críticos nunca expiran automáticamente.

## Seguridad

RLS permite al Partner leer únicamente su estado, componentes, historial, métricas y
penalties marcados como visibles. Eventos crudos, ratings, riesgos, jobs y overrides
son de Operations. Crear/limpiar penalties requiere capability de Score; crear o
limpiar overrides exige Admin. Configuración financiera continúa reservada a la
capability ya existente. No hay Score público ni service role en cliente.

## Pruebas locales

Después de `npm run supabase:reset`:

```bash
docker exec -i supabase_db_peter-golf-mvp psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 < supabase/tests/marketplace_partner_score_tiers.sql
```

La suite termina en `ROLLBACK` y cubre configuración, idempotencia, neutral/provisional,
promoción, downgrade, rolling average, decay, riesgo crítico, inmutabilidad y RLS A/B.

## Extensiones futuras

- Los order/fulfillment/dispute workflows deberán emitir los eventos estructurados
  mediante una integración interna autorizada, nunca desde el navegador Partner.
- `eligible_listing_weight` podrá ponderar elegibilidad antifraude sin cambiar el
  contrato diario; PR 4 cuenta cada listing real como una unidad.
- Reviews públicas, GMV/category weighting y reputación visible quedan fuera.
