import type { SerializableLandmark } from "./types";

const CONNECTIONS: Array<[number, number]> = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [27, 29],
  [29, 31],
  [24, 26],
  [26, 28],
  [28, 30],
  [30, 32],
];

const confidence = (landmark: SerializableLandmark) =>
  landmark.visibility ?? landmark.presence ?? 0;

export function drawLandmarks(
  context: CanvasRenderingContext2D,
  landmarks: SerializableLandmark[],
  threshold: number,
): void {
  context.save();
  context.lineWidth = Math.max(2, context.canvas.width / 360);

  for (const [fromIndex, toIndex] of CONNECTIONS) {
    const from = landmarks[fromIndex];
    const to = landmarks[toIndex];
    if (!from || !to) continue;
    const visible =
      confidence(from) >= threshold && confidence(to) >= threshold;
    context.strokeStyle = visible ? "#78f7c7" : "#ffbf69";
    context.beginPath();
    context.moveTo(
      from.x * context.canvas.width,
      from.y * context.canvas.height,
    );
    context.lineTo(to.x * context.canvas.width, to.y * context.canvas.height);
    context.stroke();
  }

  landmarks.forEach((landmark, index) => {
    context.fillStyle =
      confidence(landmark) >= threshold ? "#d9fff1" : "#ff8f70";
    context.beginPath();
    context.arc(
      landmark.x * context.canvas.width,
      landmark.y * context.canvas.height,
      index < 11 ? 2 : 3,
      0,
      Math.PI * 2,
    );
    context.fill();
  });
  context.restore();
}
