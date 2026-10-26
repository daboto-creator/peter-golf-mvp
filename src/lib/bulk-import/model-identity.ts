const normalizeIdentityText = (value: unknown) =>
  String(value ?? "").trim().toLocaleLowerCase("es-MX");

const normalizeIdentityYear = (value: unknown) => Number(value) || null;

export function hasBulkModelIdentityChanged(
  previous: Record<string, unknown>,
  next: Record<string, unknown>,
) {
  return (
    normalizeIdentityText(previous.brand) !== normalizeIdentityText(next.brand) ||
    normalizeIdentityText(previous.model) !== normalizeIdentityText(next.model) ||
    normalizeIdentityText(previous.category) !== normalizeIdentityText(next.category) ||
    normalizeIdentityYear(previous.modelYear) !== normalizeIdentityYear(next.modelYear)
  );
}

export function isManualModelResolutionValid(
  manualResolution: Record<string, unknown> | null | undefined,
  normalizedPayload: Record<string, unknown>,
) {
  const model = manualResolution?.model;
  if (!model || typeof model !== "object") return false;
  const approval = model as Record<string, unknown>;
  return approval.approved === true
    && normalizeIdentityText(approval.brand) !== ""
    && normalizeIdentityText(approval.model) !== ""
    && normalizeIdentityText(approval.category) !== ""
    && normalizeIdentityText(approval.brand) === normalizeIdentityText(normalizedPayload.brand)
    && normalizeIdentityText(approval.model) === normalizeIdentityText(normalizedPayload.model)
    && normalizeIdentityText(approval.category) === normalizeIdentityText(normalizedPayload.category)
    && normalizeIdentityYear(approval.modelYear) === normalizeIdentityYear(normalizedPayload.modelYear);
}
