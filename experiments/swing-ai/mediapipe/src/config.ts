export const MEDIAPIPE_PACKAGE_VERSION = "1.1.1" as const;
export const MODEL_ID = "mediapipe-pose-landmarker-full" as const;
export const MODEL_VERSION = "float16/1" as const;
export const MODEL_SHA256 =
  "5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1" as const;

export const MEDIAPIPE_WASM_ROOT = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_PACKAGE_VERSION}/wasm`;
export const MODEL_ASSET_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";

export const MIN_VIDEO_DURATION_SECONDS = 5;
export const MAX_VIDEO_DURATION_SECONDS = 10;
export const DEFAULT_SAMPLE_FPS = 10;
export const REQUIRED_LANDMARK_COUNT = 33;
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.5;

export const REQUIRED_BODY_LANDMARKS = [
  11, // left shoulder
  12, // right shoulder
  13, // left elbow
  14, // right elbow
  15, // left wrist
  16, // right wrist
  23, // left hip
  24, // right hip
  25, // left knee
  26, // right knee
  27, // left ankle
  28, // right ankle
] as const;
