import type { MatchCategory } from "@/lib/mi-golf/domain";

export type CategoryInterpretation = {
  category: MatchCategory;
  confidence: "HIGH" | "MEDIUM";
  clubNumber: number | null;
  subtype: "SAND" | "GAP" | "LOB" | "APPROACH" | null;
};

function normalizeGolfText(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("es-MX")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?!.,;:()'\"]/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Bounded, shared vocabulary for conversational and catalog category input.
 * Details such as a wood/iron number and wedge subtype are returned separately
 * so they never alter the canonical category.
 */
export function interpretGolfCategory(
  input: string,
): CategoryInterpretation | null {
  const text = normalizeGolfText(input);
  if (!text) return null;

  const clubNumberMatch = text.match(
    /\b(?:madera|wood|hierro|fierro|iron)\s*(\d{1,2})\b/,
  );
  const clubNumber = clubNumberMatch ? Number(clubNumberMatch[1]) : null;

  // Exact/common synonyms are checked before typo variants.
  if (/\b(driver|drivers|drive)\b/.test(text))
    return {
      category: "DRIVER",
      confidence: "HIGH",
      clubNumber: null,
      subtype: null,
    };
  if (
    /\b(fairway\s+wood|fairway|wood|woods|madera(?:s)?(?:\s+de\s+calle)?|3\s+wood|5\s+wood)\b/.test(
      text,
    )
  )
    return {
      category: "FAIRWAY_WOOD",
      confidence: "HIGH",
      clubNumber,
      subtype: null,
    };
  if (/\b(hybrid|hybrids|hibrido|rescue|utility\s+hybrid)\b/.test(text))
    return {
      category: "HYBRID",
      confidence: "HIGH",
      clubNumber: null,
      subtype: null,
    };
  if (/\b(iron|irons|hierro|hierros|fierro|fierros)\b/.test(text))
    return { category: "IRON", confidence: "HIGH", clubNumber, subtype: null };
  if (
    /\b(sand\s+wedge|gap\s+wedge|lob\s+wedge|approach\s+wedge|wedge|wedges|sand|gap|lob)\b/.test(
      text,
    )
  ) {
    const subtype = /\bsand(?:\s+wedge)?\b/.test(text)
      ? "SAND"
      : /\bgap(?:\s+wedge)?\b/.test(text)
        ? "GAP"
        : /\blob(?:\s+wedge)?\b/.test(text)
          ? "LOB"
          : /\bapproach\s+wedge\b/.test(text)
            ? "APPROACH"
            : null;
    return { category: "WEDGE", confidence: "HIGH", clubNumber: null, subtype };
  }
  if (/\b(sabd|sw)\b/.test(text))
    return {
      category: "WEDGE",
      confidence: "MEDIUM",
      clubNumber: null,
      subtype: "SAND",
    };
  if (/\b(putter|putt|put)\b/.test(text))
    return {
      category: "PUTTER",
      confidence: "HIGH",
      clubNumber: null,
      subtype: null,
    };

  // Only safe, frequent typos are accepted automatically.
  if (/\b(driber|draiver)\b/.test(text))
    return {
      category: "DRIVER",
      confidence: "MEDIUM",
      clubNumber: null,
      subtype: null,
    };
  if (/\b(pot|pater)\b/.test(text))
    return {
      category: "PUTTER",
      confidence: "MEDIUM",
      clubNumber: null,
      subtype: null,
    };
  return null;
}

export function detectGolfCategory(input: string): MatchCategory | null {
  return interpretGolfCategory(input)?.category ?? null;
}
