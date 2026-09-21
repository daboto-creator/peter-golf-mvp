export const SEARCH_SCOPE_MODES = [
  "EXACT",
  "MULTI_FAMILY",
  "ALL_CLUBS",
  "ALL_EQUIPMENT",
] as const;

export type SearchScopeMode = (typeof SEARCH_SCOPE_MODES)[number];

export const SEARCH_SCOPE_MODE_CONTRACT = SEARCH_SCOPE_MODES.join("|");
