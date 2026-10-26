/// <reference lib="webworker" />

import {
  FilesetResolver,
  PoseLandmarker,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";

import { MEDIAPIPE_WASM_ROOT, MODEL_ASSET_URL, MODEL_SHA256 } from "./config";
import { sha256Hex } from "./integrity";
import type {
  SerializableLandmark,
  WorkerRequest,
  WorkerResponse,
} from "./types";

const worker = self as DedicatedWorkerGlobalScope;
let landmarker: PoseLandmarker | null = null;

const serializeLandmark = (
  landmark: NormalizedLandmark,
): SerializableLandmark => ({
  x: landmark.x,
  y: landmark.y,
  z: landmark.z,
  visibility: Number.isFinite(landmark.visibility) ? landmark.visibility : null,
  presence:
    landmark.presence !== undefined && Number.isFinite(landmark.presence)
      ? landmark.presence
      : null,
});

const post = (message: WorkerResponse) => worker.postMessage(message);

const loadVerifiedModel = async (): Promise<Uint8Array> => {
  const response = await fetch(MODEL_ASSET_URL);
  if (!response.ok)
    throw new Error(`Model download failed with HTTP ${response.status}.`);
  const buffer = await response.arrayBuffer();
  const actual = await sha256Hex(buffer);
  if (actual !== MODEL_SHA256)
    throw new Error(`Model integrity mismatch: expected ${MODEL_SHA256}.`);
  return new Uint8Array(buffer);
};

worker.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;

  try {
    if (message.type === "INITIALIZE") {
      landmarker?.close();
      const vision = await FilesetResolver.forVisionTasks(
        MEDIAPIPE_WASM_ROOT,
        true,
      );
      const modelAssetBuffer = await loadVerifiedModel();
      landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetBuffer,
          delegate: message.delegate,
        },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: message.confidenceThreshold,
        minPosePresenceConfidence: message.confidenceThreshold,
        minTrackingConfidence: message.confidenceThreshold,
        outputSegmentationMasks: false,
      });
      post({ type: "READY", delegate: message.delegate });
      return;
    }

    if (message.type === "CLOSE") {
      landmarker?.close();
      landmarker = null;
      worker.close();
      return;
    }

    if (!landmarker) {
      message.bitmap.close();
      post({
        type: "ERROR",
        requestId: message.requestId,
        code: "WORKER_NOT_INITIALIZED",
        message: "Pose Landmarker has not finished initialization.",
      });
      return;
    }

    const startedAt = performance.now();
    const result = landmarker.detectForVideo(
      message.bitmap,
      message.timestampMs,
    );
    const inferenceMs = performance.now() - startedAt;
    message.bitmap.close();

    post({
      type: "RESULT",
      requestId: message.requestId,
      timestampMs: message.timestampMs,
      inferenceMs,
      landmarks: result.landmarks.map((pose) => pose.map(serializeLandmark)),
    });
  } catch (error) {
    if (message.type === "DETECT") message.bitmap.close();
    post({
      type: "ERROR",
      requestId: message.type === "DETECT" ? message.requestId : null,
      code:
        message.type === "INITIALIZE"
          ? "MEDIAPIPE_INITIALIZATION_FAILED"
          : "MEDIAPIPE_INFERENCE_FAILED",
      message:
        error instanceof Error ? error.message : "Unknown MediaPipe error",
    });
  }
};
