export type CatalogActionResult = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

export type ProductImageActionResult = {
  status: "idle" | "success" | "error";
  message?: string;
};

export type TaxonomyActionResult = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Record<string, string[] | undefined>;
};
