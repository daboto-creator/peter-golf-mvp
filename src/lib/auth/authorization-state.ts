export type CatalogAuthorization =
  "unauthenticated" | "forbidden" | "authorized";

export function resolveCatalogAuthorization(
  userId: string | null,
  hasPermission: boolean,
): CatalogAuthorization {
  if (!userId) {
    return "unauthenticated";
  }

  return hasPermission ? "authorized" : "forbidden";
}
