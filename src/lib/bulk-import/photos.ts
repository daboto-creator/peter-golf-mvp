import type { PhotoSourceResult } from "./types";
import { normalizePhotoKey } from "./normalization";

export function parseDriveFolderReference(value: string): PhotoSourceResult {
  if (!value.trim()) return { sourceType: "GOOGLE_DRIVE_SHARED_FOLDER", normalizedKey: null, status: "NOT_PROVIDED" };
  const match = value.match(/\/folders\/([a-zA-Z0-9_-]+)/) ?? value.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return match ? { sourceType: "GOOGLE_DRIVE_SHARED_FOLDER", normalizedKey: match[1], status: "PENDING_ACCESS" } : { sourceType: "GOOGLE_DRIVE_SHARED_FOLDER", normalizedKey: null, status: "WARNING", code: "DRIVE_FOLDER_NOT_ACCESSIBLE" };
}

export function resolvePhotoKeyCollisions(keys: string[]): { normalized: string[]; collisions: string[] } {
  const normalized = keys.map((key) => normalizePhotoKey(key)).filter((key): key is string => Boolean(key));
  const counts = new Map<string, number>();
  normalized.forEach((key) => counts.set(key, (counts.get(key) ?? 0) + 1));
  return { normalized, collisions: [...counts].filter(([, count]) => count > 1).map(([key]) => key) };
}

export function validateZipEntryPath(path: string): boolean {
  return Boolean(path) && !path.startsWith("/") && !path.split(/[\\/]/).includes("..") && !path.includes("\\0");
}

export function isAllowedImageMime(mime: string): boolean {
  return ["image/jpeg", "image/png", "image/webp"].includes(mime.toLowerCase());
}
