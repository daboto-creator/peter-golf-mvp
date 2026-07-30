import type { Database } from "@/types/database.types";

type ProductStatus = Database["public"]["Enums"]["product_status"];

export type ProductTransition =
  "edit" | "publish" | "unpublish" | "archive" | "restore";

export type ProductStateSnapshot = {
  archivedAt: string | null;
  status: ProductStatus;
  published: boolean;
};

export type ProductMutationCondition = {
  archiveState: "archived" | "unarchived";
  status: ProductStatus;
  published: boolean;
};

export function getProductMutationCondition(
  transition: ProductTransition,
  snapshot: ProductStateSnapshot,
): ProductMutationCondition | null {
  const isArchived =
    snapshot.archivedAt !== null && snapshot.status === "archived";
  const isUnarchived =
    snapshot.archivedAt === null && snapshot.status !== "archived";

  if (transition === "restore") {
    return isArchived
      ? {
          archiveState: "archived",
          status: snapshot.status,
          published: snapshot.published,
        }
      : null;
  }

  if (
    !isUnarchived ||
    (transition === "publish" && snapshot.published) ||
    (transition === "unpublish" && !snapshot.published)
  ) {
    return null;
  }

  return {
    archiveState: "unarchived",
    status: snapshot.status,
    published: snapshot.published,
  };
}
