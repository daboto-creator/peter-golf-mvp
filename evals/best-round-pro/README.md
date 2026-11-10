# Best Round Pro V1 evaluation corpus

`scenarios.ts` is the versioned, synthetic corpus. It contains 110 cases across
13 golf and conversation groups; no production product IDs or personal data are
used. Each case records context, turns, expected intent/facts/category/recipient,
required and forbidden outcomes, and whether it belongs to the bounded provider
subset.

Run the deterministic checks with:

```sh
npx vitest run src/lib/best-round-pro/corpus-eval.test.ts
```

The deterministic report measures explicit category recognition and recipient
resolution. It reports the planner fallback route distribution separately;
that simple fallback router is not treated as an LLM intent classifier. Fact
extraction, technical recommendation quality, inventory truth, and loop rates
are covered by their focused service/matching/catalog tests; the corpus reports
those metrics as not measured rather than inferring them from labels.

Run the real provider subset against a candidate Preview only:

```sh
BRP_PROVIDER_EVAL_BASE_URL=https://<candidate-preview>.vercel.app \
BRP_PROVIDER_EVAL_CURL_BIN=/path/to/vercel \
  npx vitest run src/lib/best-round-pro/provider-eval.test.ts
```

Set `BRP_PROVIDER_EVAL_CURL_BIN` to use `vercel curl` for a Preview protected
by Vercel Deployment Protection. This reuses the local Vercel login and does
not place a bypass token in the test command or output.

The provider subset has 21 labeled scenarios and at most 25 turn requests. It
requires an HTTPS Vercel Preview URL, evaluates dialogue-act and recipient
accuracy, grounding fallback, unsupported performance claims, and end-to-end
latency. Output is aggregate metadata plus synthetic scenario IDs; reply text,
keys, and personal data are never written to the report. The configured model
name is available only in the deployment's server-side `best_round_pro_turn_trace`
log as `providerModel`, not in the public API response.

Naturalness and response variance are not automated here: naturalness requires
human review, and variance would require repeat calls beyond this bounded first
pass.
