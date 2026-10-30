import { DEFAULT_CONFIDENCE_THRESHOLD } from "./config";
import type {
  Delegate,
  SerializableLandmark,
  WorkerRequest,
  WorkerResponse,
} from "./types";

type DetectionResult = {
  timestampMs: number;
  inferenceMs: number;
  landmarks: SerializableLandmark[][];
};

export class WorkerError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "WorkerError";
  }
}

export class PoseWorkerClient {
  private readonly worker = new Worker(
    new URL("./pose.worker.ts", import.meta.url),
    { type: "module" },
  );
  private nextRequestId = 1;
  private ready:
    { resolve: () => void; reject: (error: WorkerError) => void } | undefined;
  private readonly pending = new Map<
    number,
    {
      resolve: (result: DetectionResult) => void;
      reject: (error: WorkerError) => void;
    }
  >();

  constructor() {
    this.worker.onerror = (event) => {
      const error = new WorkerError(
        "WORKER_RUNTIME_FAILED",
        event.message || "The pose worker stopped unexpectedly.",
      );
      this.ready?.reject(error);
      this.ready = undefined;
      this.pending.forEach((request) => request.reject(error));
      this.pending.clear();
    };
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      if (response.type === "READY") {
        this.ready?.resolve();
        this.ready = undefined;
        return;
      }
      if (response.type === "ERROR") {
        const error = new WorkerError(response.code, response.message);
        if (response.requestId === null) {
          this.ready?.reject(error);
          this.ready = undefined;
        } else {
          this.pending.get(response.requestId)?.reject(error);
          this.pending.delete(response.requestId);
        }
        return;
      }
      const request = this.pending.get(response.requestId);
      request?.resolve(response);
      this.pending.delete(response.requestId);
    };
  }

  initialize(delegate: Delegate): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ready = { resolve, reject };
      const request: WorkerRequest = {
        type: "INITIALIZE",
        delegate,
        confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD,
      };
      this.worker.postMessage(request);
    });
  }

  detect(bitmap: ImageBitmap, timestampMs: number): Promise<DetectionResult> {
    const requestId = this.nextRequestId++;
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      const request: WorkerRequest = {
        type: "DETECT",
        requestId,
        bitmap,
        timestampMs,
      };
      this.worker.postMessage(request, [bitmap]);
    });
  }

  close(): void {
    const request: WorkerRequest = { type: "CLOSE" };
    this.worker.postMessage(request);
  }
}
