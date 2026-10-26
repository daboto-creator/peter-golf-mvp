import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const evidenceClasses = new Set(["AUTHORIZED", "PUBLIC_LICENSED", "SYNTHETIC"]);
const perspectives = new Set([
  "FACE_ON",
  "DOWN_THE_LINE",
  "FRONT_OBLIQUE",
  "REAR_OBLIQUE",
  "UNKNOWN",
]);

export function parseBenchmarkJsonl(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line, index) => {
      const row = JSON.parse(line);
      for (const field of ["runId", "modelId", "modelVersion", "videoId"])
        if (typeof row[field] !== "string" || !row[field].trim())
          throw new Error(`line ${index + 1}: ${field} is required`);
      if (!evidenceClasses.has(row.evidenceClass))
        throw new Error(`line ${index + 1}: invalid evidenceClass`);
      if (!perspectives.has(row.perspective))
        throw new Error(`line ${index + 1}: invalid perspective`);
      for (const field of [
        "durationSeconds",
        "totalFrames",
        "usableFrames",
        "latencyMs",
      ])
        if (typeof row[field] !== "number" || !Number.isFinite(row[field]))
          throw new Error(`line ${index + 1}: ${field} must be finite`);
      if (
        row.peakMemoryMb !== null &&
        (typeof row.peakMemoryMb !== "number" ||
          !Number.isFinite(row.peakMemoryMb) ||
          row.peakMemoryMb < 0)
      )
        throw new Error(
          `line ${index + 1}: peakMemoryMb must be finite, non-negative or null`,
        );
      if (row.durationSeconds < 5 || row.durationSeconds > 10)
        throw new Error(
          `line ${index + 1}: duration must be between 5 and 10 seconds`,
        );
      if (
        row.totalFrames <= 0 ||
        row.usableFrames < 0 ||
        row.usableFrames > row.totalFrames
      )
        throw new Error(`line ${index + 1}: invalid frame counts`);
      return row;
    });
}

function percentile(values, ratio) {
  if (!values.length) return null;
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.ceil(ratio * ordered.length) - 1];
}

export function summarizeBenchmark(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.modelId}@${row.modelVersion}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()].map(([model, allRuns]) => {
    const real = allRuns.filter((run) => run.evidenceClass !== "SYNTHETIC");
    const totalFrames = real.reduce((sum, run) => sum + run.totalFrames, 0);
    const usableFrames = real.reduce((sum, run) => sum + run.usableFrames, 0);
    return {
      model,
      allRuns: allRuns.length,
      syntheticRuns: allRuns.length - real.length,
      representativeRuns: real.length,
      representativeVideoCount: new Set(real.map((run) => run.videoId)).size,
      usableFramePercent: totalFrames
        ? Number(((usableFrames / totalFrames) * 100).toFixed(2))
        : null,
      latencyMsP50: percentile(
        real.map((run) => run.latencyMs),
        0.5,
      ),
      latencyMsP95: percentile(
        real.map((run) => run.latencyMs),
        0.95,
      ),
      peakMemoryMbMax: real.some((run) => run.peakMemoryMb !== null)
        ? Math.max(
            ...real
              .map((run) => run.peakMemoryMb)
              .filter((value) => value !== null),
          )
        : null,
      errors: real.filter((run) => run.errorCode).length,
      representative: new Set(real.map((run) => run.videoId)).size >= 20,
    };
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (!process.argv[2])
    throw new Error("usage: node aggregate.mjs <runs.jsonl>");
  const rows = parseBenchmarkJsonl(readFileSync(process.argv[2], "utf8"));
  process.stdout.write(
    `${JSON.stringify(summarizeBenchmark(rows), null, 2)}\n`,
  );
}
