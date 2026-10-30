# Best Round Swing AI — isolated discovery harness

This directory belongs to PR 1 technical discovery. Nothing here is imported by
the production application, creates database objects, uploads media, or calls a
paid service.

## Executable artifacts

- `contracts.ts`: provider-independent, versioned contracts proposed for later PRs.
- `fitting/prototype.ts`: conservative decision gates, not a customer-facing score.
- `benchmark/aggregate.mjs`: JSONL validation and aggregation that excludes
  synthetic fixtures from representative model results.

## Run

```bash
npx vitest run --config experiments/swing-ai/vitest.config.mts
node --test experiments/swing-ai/benchmark/aggregate.test.mjs
node experiments/swing-ai/benchmark/aggregate.mjs \
  experiments/swing-ai/benchmark/fixtures/synthetic-runs.jsonl
```

Checked-in benchmark records are synthetic harness fixtures. They do not
represent model accuracy or latency. No video is stored in Git.

## Adding authorized runs later

Keep source videos outside the repository, record consent or the exact public
license, use an opaque `videoId`, pin every model revision, and run every model
against the same decoded frames. Only `AUTHORIZED` or `PUBLIC_LICENSED` rows
count toward representative results; at least 20 distinct videos are required.

## PR2: MediaPipe benchmark

El ejecutor browser-first vive en `mediapipe/`. Reutiliza los contratos y el
agregador del discovery, procesa archivos elegidos por el usuario en un Web
Worker y exporta JSON/JSONL sin incluir el nombre original del video. Consulta
`mediapipe/README.md` antes de ejecutar clips autorizados.
