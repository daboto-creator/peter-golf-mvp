import { describe, expect, it } from "vitest";

import {
  buildSampleTimestamps,
  evaluateFrame,
  percentile,
  validateVideoDuration,
} from "./benchmark";
import type { SerializableLandmark } from "./types";

const landmarks = (confidence: number, count = 33): SerializableLandmark[] =>
  Array.from({ length: count }, (_, index) => ({
    x: index / count,
    y: index / count,
    z: 0,
    visibility: confidence,
    presence: confidence,
  }));

describe("video duration validation", () => {
  it("accepts only clips from 5 through 10 seconds", () => {
    expect(validateVideoDuration(5)).toBeNull();
    expect(validateVideoDuration(10)).toBeNull();
    expect(validateVideoDuration(4.99)).toBe("VIDEO_SHORTER_THAN_5_SECONDS");
    expect(validateVideoDuration(10.01)).toBe("VIDEO_LONGER_THAN_10_SECONDS");
  });
});

describe("frame evidence gate", () => {
  it("accepts exactly 33 sufficiently visible landmarks", () => {
    const frame = evaluateFrame(100, 12, [landmarks(0.8)]);
    expect(frame.usable).toBe(true);
    expect(frame.landmarkCount).toBe(33);
    expect(frame.failureReason).toBeNull();
  });

  it("never treats missing or low-confidence pose output as usable", () => {
    const noPose = evaluateFrame(0, 1, []);
    expect(noPose.failureReason).toBe("NO_POSE");
    expect(noPose.minimumRequiredConfidence).toBeNull();
    expect(evaluateFrame(0, 1, [landmarks(0.8, 32)]).failureReason).toBe(
      "LANDMARK_COUNT",
    );
    expect(evaluateFrame(0, 1, [landmarks(0.2)]).failureReason).toBe(
      "LOW_REQUIRED_LANDMARK_CONFIDENCE",
    );
  });
});

describe("benchmark helpers", () => {
  it("builds monotonic timestamps without sampling beyond the clip", () => {
    const timestamps = buildSampleTimestamps(5, 10);
    expect(timestamps).toHaveLength(50);
    expect(timestamps[0]).toBe(0);
    expect(timestamps.at(-1)).toBe(4900);
  });

  it("calculates nearest-rank percentiles", () => {
    expect(percentile([40, 10, 20, 30], 0.5)).toBe(20);
    expect(percentile([40, 10, 20, 30], 0.95)).toBe(40);
    expect(percentile([], 0.5)).toBeNull();
  });
});
