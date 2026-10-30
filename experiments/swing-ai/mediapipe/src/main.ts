import {
  anonymizedVideoId,
  buildSampleTimestamps,
  evaluateFrame,
  percentile,
  validateVideoDuration,
} from "./benchmark";
import {
  DEFAULT_CONFIDENCE_THRESHOLD,
  DEFAULT_SAMPLE_FPS,
  MEDIAPIPE_PACKAGE_VERSION,
  MEDIAPIPE_WASM_ROOT,
  MODEL_ASSET_URL,
  MODEL_ID,
  MODEL_SHA256,
  MODEL_VERSION,
} from "./config";
import { drawLandmarks } from "./drawing";
import type {
  BenchmarkFrame,
  BenchmarkEvidenceClass,
  BenchmarkRunExport,
  BenchmarkRunSummary,
  Delegate,
} from "./types";
import { PoseWorkerClient, WorkerError } from "./worker-client";

const element = <T extends HTMLElement>(id: string): T => {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing required element: ${id}`);
  return found as T;
};

const fileInput = element<HTMLInputElement>("video-file");
const perspectiveInput = element<HTMLSelectElement>("perspective");
const delegateInput = element<HTMLSelectElement>("delegate");
const evidenceClassInput = element<HTMLSelectElement>("evidence-class");
const rightsInput = element<HTMLInputElement>("rights-confirmed");
const runButton = element<HTMLButtonElement>("run");
const statusOutput = element<HTMLElement>("status");
const progressOutput = element<HTMLOutputElement>("progress");
const video = element<HTMLVideoElement>("video");
const canvas = element<HTMLCanvasElement>("canvas");
const summaryElement = element<HTMLElement>("summary");
const annotatedFramesElement = element<HTMLElement>("annotated-frames");
const downloadJsonButton = element<HTMLButtonElement>("download-json");
const downloadJsonlButton = element<HTMLButtonElement>("download-jsonl");
const context = canvas.getContext("2d", { alpha: false });

if (!context) throw new Error("Canvas 2D is not available in this browser.");

let selectedFile: File | null = null;
let videoObjectUrl: string | null = null;
let latestExport: BenchmarkRunExport | null = null;
let annotationUrls: string[] = [];

type MemoryPerformance = Performance & {
  memory?: { usedJSHeapSize: number };
};
type DeviceNavigator = Navigator & { deviceMemory?: number };

const currentMemoryMb = (): number | null => {
  const bytes = (performance as MemoryPerformance).memory?.usedJSHeapSize;
  return bytes === undefined ? null : bytes / 1024 / 1024;
};

const waitForEvent = (target: EventTarget, eventName: string) =>
  new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      target.removeEventListener(eventName, onSuccess);
      target.removeEventListener("error", onError);
    };
    const onSuccess = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(`Browser failed while waiting for ${eventName}.`));
    };
    target.addEventListener(eventName, onSuccess, { once: true });
    target.addEventListener("error", onError, { once: true });
  });

const prepareVideo = async (file: File) => {
  if (file.type && !file.type.startsWith("video/"))
    throw new Error("Selecciona un archivo de video compatible.");
  if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl);
  videoObjectUrl = URL.createObjectURL(file);
  video.src = videoObjectUrl;
  video.load();
  await waitForEvent(video, "loadedmetadata");
  const durationError = validateVideoDuration(video.duration);
  if (durationError)
    throw new Error(
      durationError === "VIDEO_SHORTER_THAN_5_SECONDS"
        ? "El video dura menos de 5 segundos."
        : "El video supera 10 segundos.",
    );

  const scale = Math.min(1, 1280 / video.videoWidth);
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  statusOutput.textContent = `${video.duration.toFixed(2)} s · ${video.videoWidth}×${video.videoHeight} · listo para procesar localmente.`;
};

const seekVideo = async (timestampMs: number) => {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA)
    await waitForEvent(video, "loadeddata");
  const targetSeconds = Math.min(
    timestampMs / 1000,
    Math.max(0, video.duration - 0.001),
  );
  if (Math.abs(video.currentTime - targetSeconds) < 0.0005) return;
  const seeked = waitForEvent(video, "seeked");
  video.currentTime = targetSeconds;
  await seeked;
};

const canvasBlob = () =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("No fue posible generar el fotograma anotado."));
    }, "image/png");
  });

const clearAnnotations = () => {
  annotationUrls.forEach((url) => URL.revokeObjectURL(url));
  annotationUrls = [];
  annotatedFramesElement.replaceChildren();
};

const addAnnotationDownload = async (timestampMs: number) => {
  const url = URL.createObjectURL(await canvasBlob());
  annotationUrls.push(url);
  const link = document.createElement("a");
  link.href = url;
  link.download = `swing-frame-${timestampMs}ms.png`;
  link.textContent = `Fotograma ${timestampMs} ms`;
  annotatedFramesElement.append(link);
};

const download = (filename: string, content: string, mimeType: string) => {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

const renderSummary = (result: BenchmarkRunExport) => {
  const { summary, resources, errors } = result;
  const usablePercent = summary.totalFrames
    ? (summary.usableFrames / summary.totalFrames) * 100
    : 0;
  const metrics = [
    ["Landmarks", "33 por pose detectada"],
    ["Frames utilizables", `${usablePercent.toFixed(1)}%`],
    [
      "Inferencia p50",
      `${resources.inferenceTimeMsP50?.toFixed(1) ?? "N/D"} ms`,
    ],
    ["Errores", String(errors.length)],
  ];
  summaryElement.className = "summary";
  summaryElement.replaceChildren(
    ...metrics.map(([label, value]) => {
      const card = document.createElement("div");
      card.className = "metric";
      const labelElement = document.createElement("span");
      labelElement.textContent = label;
      const valueElement = document.createElement("strong");
      valueElement.textContent = value;
      card.append(labelElement, valueElement);
      return card;
    }),
  );
};

const runBenchmark = async () => {
  if (!selectedFile) throw new Error("Selecciona primero un video local.");
  if (!rightsInput.checked)
    throw new Error("Confirma derechos y consentimiento antes de procesar.");
  if (validateVideoDuration(video.duration))
    throw new Error("El video debe durar entre 5 y 10 segundos.");

  runButton.disabled = true;
  downloadJsonButton.disabled = true;
  downloadJsonlButton.disabled = true;
  clearAnnotations();
  latestExport = null;
  progressOutput.value = "0%";

  const perspective = perspectiveInput.value as "FACE_ON" | "DOWN_THE_LINE";
  const delegate = delegateInput.value as Delegate;
  const evidenceClass = evidenceClassInput.value as BenchmarkEvidenceClass;
  const worker = new PoseWorkerClient();
  const frames: BenchmarkFrame[] = [];
  const errors: BenchmarkRunExport["errors"] = [];
  const timestamps = buildSampleTimestamps(video.duration, DEFAULT_SAMPLE_FPS);
  const annotationTargets = [0.25, 0.5, 0.75].map((ratio) =>
    Math.floor(timestamps.length * ratio),
  );
  let nextAnnotation = 0;
  let peakMemoryMb = currentMemoryMb();
  const wallStartedAt = performance.now();

  try {
    statusOutput.textContent = `Cargando MediaPipe ${MEDIAPIPE_PACKAGE_VERSION} y Pose Landmarker Full…`;
    await worker.initialize(delegate);

    for (const [index, timestampMs] of timestamps.entries()) {
      await seekVideo(timestampMs);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const bitmap = await createImageBitmap(canvas);

      try {
        const detection = await worker.detect(bitmap, timestampMs);
        const frame = evaluateFrame(
          timestampMs,
          detection.inferenceMs,
          detection.landmarks,
        );
        frames.push(frame);
        if (frame.landmarks.length)
          drawLandmarks(context, frame.landmarks, DEFAULT_CONFIDENCE_THRESHOLD);
        if (
          frame.usable &&
          nextAnnotation < annotationTargets.length &&
          index >= annotationTargets[nextAnnotation]
        ) {
          await addAnnotationDownload(timestampMs);
          nextAnnotation += 1;
        }
      } catch (error) {
        const code = error instanceof WorkerError ? error.code : "FRAME_FAILED";
        errors.push({
          code,
          message:
            error instanceof Error ? error.message : "Unknown frame error",
          timestampMs,
        });
        frames.push(evaluateFrame(timestampMs, 0, []));
      }

      const memory = currentMemoryMb();
      if (memory !== null)
        peakMemoryMb = Math.max(peakMemoryMb ?? memory, memory);
      progressOutput.value = `${Math.round(((index + 1) / timestamps.length) * 100)}%`;
    }

    const wallTimeMs = performance.now() - wallStartedAt;
    const inferenceTimes = frames
      .map((frame) => frame.inferenceMs)
      .filter((inferenceMs) => inferenceMs > 0);
    const summary: BenchmarkRunSummary = {
      runId: crypto.randomUUID(),
      modelId: MODEL_ID,
      modelVersion: `${MEDIAPIPE_PACKAGE_VERSION}+${MODEL_VERSION}`,
      videoId: await anonymizedVideoId(selectedFile),
      evidenceClass,
      perspective,
      durationSeconds: Number(video.duration.toFixed(3)),
      totalFrames: frames.length,
      usableFrames: frames.filter((frame) => frame.usable).length,
      latencyMs: Number(wallTimeMs.toFixed(3)),
      peakMemoryMb:
        peakMemoryMb === null ? null : Number(peakMemoryMb.toFixed(3)),
      errorCode: errors[0]?.code ?? null,
    };

    latestExport = {
      schemaVersion: "swing-ai-mediapipe-benchmark-v1",
      generatedAt: new Date().toISOString(),
      summary,
      model: {
        package: "@mediapipe/tasks-vision",
        packageVersion: MEDIAPIPE_PACKAGE_VERSION,
        modelAsset: MODEL_ASSET_URL,
        modelVersion: MODEL_VERSION,
        modelSha256: MODEL_SHA256,
        delegate,
        runtime: "BROWSER_WEB_WORKER",
      },
      environment: {
        userAgent: navigator.userAgent,
        hardwareConcurrency: navigator.hardwareConcurrency || null,
        deviceMemoryGb: (navigator as DeviceNavigator).deviceMemory ?? null,
        crossOriginIsolated,
      },
      capture: {
        mimeType: selectedFile.type,
        sizeBytes: selectedFile.size,
        width: video.videoWidth,
        height: video.videoHeight,
        sampleFps: DEFAULT_SAMPLE_FPS,
        originalFilenameIncluded: false,
      },
      thresholds: {
        detection: DEFAULT_CONFIDENCE_THRESHOLD,
        presence: DEFAULT_CONFIDENCE_THRESHOLD,
        tracking: DEFAULT_CONFIDENCE_THRESHOLD,
        usableLandmarkConfidence: DEFAULT_CONFIDENCE_THRESHOLD,
      },
      resources: {
        wallTimeMs: Number(wallTimeMs.toFixed(3)),
        inferenceTimeMsTotal: Number(
          inferenceTimes.reduce((sum, value) => sum + value, 0).toFixed(3),
        ),
        inferenceTimeMsP50: percentile(inferenceTimes, 0.5),
        inferenceTimeMsP95: percentile(inferenceTimes, 0.95),
        memoryMeasurement:
          peakMemoryMb === null ? "UNAVAILABLE" : "CHROMIUM_NON_STANDARD",
      },
      privacy: {
        localFileOnly: true,
        videoUploaded: false,
        videoPersistedByPrototype: false,
        trainingUse: false,
        assetOrigins: [
          new URL(MEDIAPIPE_WASM_ROOT).origin,
          new URL(MODEL_ASSET_URL).origin,
        ],
      },
      errors,
      frames,
      limitations: [
        "Landmarks are model observations, not biomechanical ground truth.",
        "A single camera view cannot measure club delivery, impact, ball flight, force, or true 3D motion.",
        "No fitting recommendation is generated by this benchmark.",
        "Memory is unavailable outside browsers exposing performance.memory.",
        "The prototype fetches pinned WASM and model assets; it never sends video frames to those origins.",
      ],
    };

    renderSummary(latestExport);
    downloadJsonButton.disabled = false;
    downloadJsonlButton.disabled = false;
    statusOutput.textContent = `Finalizado: ${summary.usableFrames}/${summary.totalFrames} frames utilizables. Revisa las limitaciones antes de interpretar.`;
  } finally {
    worker.close();
    runButton.disabled = false;
  }
};

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0] ?? null;
  selectedFile = null;
  latestExport = null;
  downloadJsonButton.disabled = true;
  downloadJsonlButton.disabled = true;
  if (!file) {
    statusOutput.textContent = "Selecciona un video.";
    return;
  }
  try {
    statusOutput.textContent = "Leyendo metadatos localmente…";
    await prepareVideo(file);
    selectedFile = file;
  } catch (error) {
    statusOutput.textContent =
      error instanceof Error ? error.message : "No fue posible leer el video.";
  }
});

runButton.addEventListener("click", () => {
  runBenchmark().catch((error) => {
    statusOutput.textContent =
      error instanceof Error ? error.message : "El benchmark falló.";
    progressOutput.value = "Error";
    runButton.disabled = false;
  });
});

downloadJsonButton.addEventListener("click", () => {
  if (!latestExport) return;
  download(
    `${latestExport.summary.runId}.json`,
    `${JSON.stringify(latestExport, null, 2)}\n`,
    "application/json",
  );
});

downloadJsonlButton.addEventListener("click", () => {
  if (!latestExport) return;
  download(
    `${latestExport.summary.runId}.jsonl`,
    `${JSON.stringify(latestExport.summary)}\n`,
    "application/x-ndjson",
  );
});

window.addEventListener("beforeunload", () => {
  if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl);
  clearAnnotations();
});
