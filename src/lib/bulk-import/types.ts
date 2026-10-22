export const bulkImportTypes = ["FIRST_PARTY", "PARTNER"] as const;
export type BulkImportType = (typeof bulkImportTypes)[number];

export const bulkImportStatuses = [
  "UPLOADED",
  "PARSING",
  "NORMALIZING",
  "VALIDATING",
  "RESOLVING_CATALOG",
  "RESOLVING_ASSETS",
  "ANALYZING_PRICING",
  "READY_FOR_REVIEW",
  "APPROVED_FOR_IMPORT",
  "IMPORTING",
  "IMPORTED",
  "PARTIALLY_IMPORTED",
  "FAILED_IMPORT",
  "FAILED",
  "CANCELLED",
] as const;
export type BulkImportStatus = (typeof bulkImportStatuses)[number];

export type BulkRowSeverity = "PENDING" | "READY" | "WARNING" | "ERROR";
export type BulkRowExecutionStatus = "PENDING_IMPORT" | "IMPORTING" | "IMPORTED" | "SKIPPED_EXISTING" | "FAILED";
export type IssueSeverity = "ERROR" | "WARNING" | "INFO";

export type RawCsvRow = {
  rowNumber: number;
  values: Record<string, string>;
};

export type CatalogModelReference = {
  id: string;
  brandId: string;
  brandName: string;
  brandSlug: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  modelName: string;
  normalizedModelName: string;
  modelYear: number | null;
};

export type NormalizationKind =
  | "EXACT"
  | "AUTO_NORMALIZED"
  | "NORMALIZED_WITH_WARNING"
  | "AMBIGUOUS"
  | "INVALID";

export type FieldNormalization = {
  original: string;
  value: string | number | boolean | null;
  kind: NormalizationKind;
  code?: string;
  candidates?: string[];
};

export type NormalizedBulkRow = {
  rowNumber: number;
  original: Record<string, string>;
  normalized: {
    externalId: string | null;
    category: string | null;
    categorySlug: string | null;
    brand: string | null;
    brandSlug: string | null;
    model: string | null;
    modelYear: number | null;
    condition: string | null;
    quantity: number | null;
    hand: "RIGHT" | "LEFT" | null;
    loft: number | null;
    bounce: number | null;
    grind: string | null;
    flex: string | null;
    shaftMaterial: string | null;
    headcover: boolean | null;
    acquisitionCostMinor: number | null;
    askingPriceMinor: number | null;
    desiredNetMinor: number | null;
    photoKey: string | null;
    notes: string | null;
  };
  fields: Record<string, FieldNormalization>;
};

export type BulkIssue = {
  severity: IssueSeverity;
  code: string;
  field?: string;
  message: string;
  details?: Record<string, unknown>;
};

export type ResolvedBulkRow = NormalizedBulkRow & {
  canonicalBrandId: string | null;
  canonicalCategoryId: string | null;
  canonicalModelId: string | null;
  modelCandidates: CatalogModelReference[];
  issues: BulkIssue[];
  pricing: PricingPrecheck;
  photo: PhotoSourceResult;
  severity: BulkRowSeverity;
};

export type PricingPrecheck = {
  status: "COMPETITIVE" | "OVERPRICED" | "UNDERPRICED" | "INSUFFICIENT_DATA";
  proposedPriceMinor: number | null;
  marketReferenceMinor: number | null;
  estimatedPartnerNetMinor: number | null;
  viability: string;
  researchRequestKey: string | null;
  reusedResearch: boolean;
};

export type PhotoSourceResult = {
  sourceType: "GOOGLE_DRIVE_SHARED_FOLDER" | "ZIP_UPLOAD" | null;
  normalizedKey: string | null;
  status: "NOT_PROVIDED" | "PENDING_ACCESS" | "MATCHED" | "WARNING" | "ERROR";
  code?: string;
};

export type BulkPreview = {
  importType: BulkImportType;
  rows: ResolvedBulkRow[];
  summary: { total: number; ready: number; warnings: number; errors: number };
};
