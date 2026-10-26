import type { CameraPerspective } from "../../contracts";

export type Delegate = "CPU" | "GPU";
export type BenchmarkEvidenceClass =
  "AUTHORIZED" | "PUBLIC_LICENSED" | "SYNTHETIC";

export type SerializableLandmark = {
  x: number;
  y: number;
  z: number;
  visibility: number | null;
  presence: number | null;
};

export type FrameFailureReason =
  "NO_POSE" | "LANDMARK_COUNT" | "LOW_REQUIRED_LANDMARK_CONFIDENCE" | null;

export type BenchmarkFrame = {
  timestampMs: number;
  inferenceMs: number;
  poseDetected: boolean;
  landmarkCount: number;
  meanConfidence: number | null;
  minimumRequiredConfidence: number | null;
  usable: boolean;
  failureReason: FrameFailureReason;
  landmarks: SerializableLandmark[];
};

export type BenchmarkRunSummary = {
  runId: string;
  modelId: typeof import("./config").MODEL_ID;
  modelVersion: string;
  videoId: string;
  evidenceClass: BenchmarkEvidenceClass;
  perspective: Extract<CameraPerspective, "FACE_ON" | "DOWN_THE_LINE">;
  durationSeconds: number;
  totalFrames: number;
  usableFrames: number;
  latencyMs: number;
  peakMemoryMb: number | null;
  errorCode: string | null;
};

export type BenchmarkRunExport = {
  schemaVersion: "swing-ai-mediapipe-benchmark-v1";
  generatedAt: string;
  summary: BenchmarkRunSummary;
  model: {
    package: "@mediapipe/tasks-vision";
    packageVersion: string;
    modelAsset: string;
    modelVersion: string;
    modelSha256: string;
    delegate: Delegate;
    runtime: "BROWSER_WEB_WORKER";
  };
  environment: {
    userAgent: string;
    hardwareConcurrency: number | null;
    deviceMemoryGb: number | null;
    crossOriginIsolated: boolean;
  };
  capture: {
    mimeType: string;
    sizeBytes: number;
    width: number;
    height: number;
    sampleFps: number;
    originalFilenameIncluded: false;
  };
  thresholds: {
    detection: number;
    presence: number;
    tracking: number;
    usableLandmarkConfidence: number;
  };
  resources: {
    wallTimeMs: number;
    inferenceTimeMsTotal: number;
    inferenceTimeMsP50: number | null;
    inferenceTimeMsP95: number | null;
    memoryMeasurement: "CHROMIUM_NON_STANDARD" | "UNAVAILABLE";
  };
  privacy: {
    localFileOnly: true;
    videoUploaded: false;
    videoPersistedByPrototype: false;
    trainingUse: false;
    assetOrigins: string[];
  };
  errors: Array<{
    code: string;
    message: string;
    timestampMs: number | null;
  }>;
  frames: BenchmarkFrame[];
  limitations: string[];
};

export type WorkerRequest =
  | {
      type: "INITIALIZE";
      delegate: Delegate;
      confidenceThreshold: number;
    }
  | {
      type: "DETECT";
      requestId: number;
      bitmap: ImageBitmap;
      timestampMs: number;
    }
  | { type: "CLOSE" };

export type WorkerResponse =
  | { type: "READY"; delegate: Delegate }
  | {
      type: "RESULT";
      requestId: number;
      timestampMs: number;
      inferenceMs: number;
      landmarks: SerializableLandmark[][];
    }
  | { type: "ERROR"; requestId: number | null; code: string; message: string };
