import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseBenchmarkJsonl, summarizeBenchmark } from "./aggregate.mjs";

const fixture = new URL("./fixtures/synthetic-runs.jsonl", import.meta.url);
const detailedExample = new URL(
  "../mediapipe/examples/benchmark-run.example.json",
  import.meta.url,
);

test("synthetic runs validate the harness but never become representative", () => {
  const [summary] = summarizeBenchmark(
    parseBenchmarkJsonl(readFileSync(fixture, "utf8")),
  );
  assert.equal(summary.syntheticRuns, 2);
  assert.equal(summary.representativeRuns, 0);
  assert.equal(summary.usableFramePercent, null);
  assert.equal(summary.representative, false);
});

test("only authorized or licensed runs contribute measured metrics", () => {
  const rows = parseBenchmarkJsonl(readFileSync(fixture, "utf8"));
  rows.push({
    ...rows[0],
    runId: "authorized-1",
    videoId: "opaque-1",
    evidenceClass: "AUTHORIZED",
    usableFrames: 80,
    totalFrames: 100,
    latencyMs: 1200,
    peakMemoryMb: 256,
    errorCode: null,
  });
  const [summary] = summarizeBenchmark(rows);
  assert.equal(summary.usableFramePercent, 80);
  assert.equal(summary.latencyMsP50, 1200);
  assert.equal(summary.peakMemoryMbMax, 256);
});

test("rejects clips outside the five-to-ten-second window", () => {
  const invalid = JSON.stringify({
    runId: "x",
    modelId: "m",
    modelVersion: "v",
    videoId: "v",
    evidenceClass: "SYNTHETIC",
    perspective: "FACE_ON",
    durationSeconds: 11,
    totalFrames: 1,
    usableFrames: 1,
    latencyMs: 1,
    peakMemoryMb: 1,
  });
  assert.throws(() => parseBenchmarkJsonl(invalid), /between 5 and 10/);
});

test("accepts unavailable memory without fabricating a zero measurement", () => {
  const rows = parseBenchmarkJsonl(readFileSync(fixture, "utf8"));
  rows.push({
    ...rows[0],
    runId: "authorized-without-memory",
    videoId: "opaque-no-memory",
    evidenceClass: "AUTHORIZED",
    peakMemoryMb: null,
  });
  const [summary] = summarizeBenchmark(rows);
  assert.equal(summary.peakMemoryMbMax, null);
});

test("the detailed example exposes an aggregator-compatible summary", () => {
  const example = JSON.parse(readFileSync(detailedExample, "utf8"));
  const [row] = parseBenchmarkJsonl(JSON.stringify(example.summary));
  const [summary] = summarizeBenchmark([row]);
  assert.equal(summary.syntheticRuns, 1);
  assert.equal(summary.representativeRuns, 0);
  assert.equal(summary.representative, false);
});
