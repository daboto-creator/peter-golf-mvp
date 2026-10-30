import {
  DEFAULT_CONFIDENCE_THRESHOLD,
  MAX_VIDEO_DURATION_SECONDS,
  MIN_VIDEO_DURATION_SECONDS,
  REQUIRED_BODY_LANDMARKS,
  REQUIRED_LANDMARK_COUNT,
} from "./config";
import type {
  BenchmarkFrame,
  FrameFailureReason,
  SerializableLandmark,
} from "./types";

export function validateVideoDuration(durationSeconds: number): string | null {
  if (!Number.isFinite(durationSeconds)) return "VIDEO_DURATION_UNAVAILABLE";
  if (durationSeconds < MIN_VIDEO_DURATION_SECONDS)
    return "VIDEO_SHORTER_THAN_5_SECONDS";
  if (durationSeconds > MAX_VIDEO_DURATION_SECONDS)
    return "VIDEO_LONGER_THAN_10_SECONDS";
  return null;
}

function landmarkConfidence(landmark: SerializableLandmark): number {
  return landmark.visibility ?? landmark.presence ?? 0;
}

export function evaluateFrame(
  timestampMs: number,
  inferenceMs: number,
  poses: SerializableLandmark[][],
  threshold = DEFAULT_CONFIDENCE_THRESHOLD,
): BenchmarkFrame {
  const landmarks = poses[0] ?? [];
  let failureReason: FrameFailureReason = null;
  const requiredConfidences = landmarks.length
    ? REQUIRED_BODY_LANDMARKS.map((index) =>
        landmarks[index] ? landmarkConfidence(landmarks[index]) : 0,
      )
    : [];
  const allConfidences = landmarks.map(landmarkConfidence);
  const minimumRequiredConfidence = requiredConfidences.length
    ? Math.min(...requiredConfidences)
    : null;
  const meanConfidence = allConfidences.length
    ? allConfidences.reduce((sum, value) => sum + value, 0) /
      allConfidences.length
    : null;

  if (!poses.length) failureReason = "NO_POSE";
  else if (landmarks.length !== REQUIRED_LANDMARK_COUNT)
    failureReason = "LANDMARK_COUNT";
  else if (
    minimumRequiredConfidence === null ||
    minimumRequiredConfidence < threshold
  )
    failureReason = "LOW_REQUIRED_LANDMARK_CONFIDENCE";

  return {
    timestampMs,
    inferenceMs,
    poseDetected: poses.length > 0,
    landmarkCount: landmarks.length,
    meanConfidence,
    minimumRequiredConfidence,
    usable: failureReason === null,
    failureReason,
    landmarks,
  };
}

export function percentile(values: number[], ratio: number): number | null {
  if (!values.length) return null;
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.max(0, Math.ceil(ratio * ordered.length) - 1)];
}

export function buildSampleTimestamps(
  durationSeconds: number,
  sampleFps: number,
): number[] {
  const frameCount = Math.floor(durationSeconds * sampleFps);
  return Array.from({ length: frameCount }, (_, index) =>
    Math.round((index / sampleFps) * 1000),
  );
}

export async function anonymizedVideoId(file: File): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  return `sha256:${Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}
