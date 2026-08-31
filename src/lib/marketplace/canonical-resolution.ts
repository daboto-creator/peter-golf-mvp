function normalize(value: string | null) {
  return value
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function canonicalResolutionConfidence(input: {
  canonicalModelId: string | null;
  proposedBrand: string | null;
  proposedModel: string | null;
  candidates: Array<{ id: string; brandName: string; modelName: string }>;
}) {
  if (input.canonicalModelId)
    return {
      confidence: "HIGH",
      suggestedModelId: input.canonicalModelId,
    } as const;
  const exact = input.candidates.filter(
    (candidate) =>
      normalize(candidate.brandName) === normalize(input.proposedBrand) &&
      normalize(candidate.modelName) === normalize(input.proposedModel),
  );
  if (exact.length === 1)
    return { confidence: "HIGH", suggestedModelId: exact[0]!.id } as const;
  const sameBrand = input.candidates.filter(
    (candidate) =>
      normalize(candidate.brandName) === normalize(input.proposedBrand),
  );
  const model = normalize(input.proposedModel) ?? "";
  const suggested = sameBrand.find((candidate) => {
    const candidateModel = normalize(candidate.modelName) ?? "";
    return (
      model.length >= 3 &&
      (candidateModel.includes(model) || model.includes(candidateModel))
    );
  });
  return suggested
    ? ({ confidence: "MEDIUM", suggestedModelId: suggested.id } as const)
    : ({ confidence: "LOW", suggestedModelId: null } as const);
}
