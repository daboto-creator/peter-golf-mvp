const INTERNAL_PATH_PATTERN = /^\/(?!\/)/;

export function getSafeInternalPath(
  value: string | null | undefined,
  fallback = "/cuenta",
) {
  if (!value || !INTERNAL_PATH_PATTERN.test(value)) {
    return fallback;
  }

  try {
    const url = new URL(value, "http://internal.local");

    if (url.origin !== "http://internal.local") {
      return fallback;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
