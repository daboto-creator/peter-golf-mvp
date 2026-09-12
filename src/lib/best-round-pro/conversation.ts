import type {
  BestRoundProSessionSummary,
  BuyingIntent,
  MiGolfProfile,
  MatchCategory,
  NextBestQuestion,
} from "@/lib/mi-golf/domain";
import { nextBestQuestion } from "@/lib/mi-golf/domain";
import type { CommercialRankingResult } from "@/lib/recommendations/commercial-ranking";
import {
  detectGolfCategory,
  interpretGolfCategory,
  type ProductFamily,
} from "./category-normalization";

export type ConversationObjection =
  | "PRICE"
  | "UNCERTAIN_FIT"
  | "BRAND"
  | "NEW_VS_USED"
  | "NEED_TO_THINK"
  | "WANT_OTHER_OPTION";

function isProtectedRequest(text: string) {
  return (
    /(ignora|omite|cambia|ponle|ajusta).*(regla|match|100)|\b(margen|margin|comision|comisión|costo|coste|ganancia)\b/i.test(
      text,
    ) &&
    /match|margen|margin|comision|comisión|costo|coste|ganancia/i.test(text)
  );
}

export type ConversationState = {
  session: BestRoundProSessionSummary;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  discussedProductIds: string[];
  pendingQuestionKey: string | null;
  pendingQuestionCategory: string | null;
  pendingQuestionSlotType: NextBestQuestion["slotType"] | null;
  /** Customer-safe catalog context used to resolve follow-up references such as "ese". */
  lastCatalogResults: CatalogProductReference[];
  lastFocusedProduct: CatalogProductReference | null;
  productAdvice: {
    active: boolean;
    product: CatalogProductReference | null;
    pendingQuestionKey: string | null;
    collectedAnswers: Record<string, string | number | boolean | null>;
  };
  participants: ConversationParticipants;
  pendingAssistantOffer: {
    action: "START_PRODUCT_ADVICE" | "COMPARE_PRODUCTS" | "SHOW_ALTERNATIVES" | "CONTINUE_RECOMMENDATION";
    targetProductIds: string[];
    createdAtTurn: number;
  } | null;
};

export type FactStatus = "KNOWN" | "UNKNOWN" | "NONE" | "NOT_APPLICABLE" | "DECLINED";
export type SemanticFact<T> = { status: FactStatus; value?: T; confidence: number; source: "USER" | "INFERRED" };
export type ConversationParticipants = {
  buyer: { isLoggedInUser: true };
  player: {
    relationToBuyer: "SELF" | "SPOUSE" | "CHILD" | "FRIEND" | "OTHER" | "UNKNOWN";
    displayReference: string;
    facts: Record<string, SemanticFact<unknown>>;
  };
};

export type PlayerPerspective = {
  relationToBuyer: ConversationParticipants["player"]["relationToBuyer"];
  displayReference: string;
  subject: string;
  possessive: string;
  isSelf: boolean;
};

export function getPlayerPerspective(participants: ConversationParticipants): PlayerPerspective {
  const isSelf = participants.player.relationToBuyer === "SELF";
  const displayReference = isSelf ? "tú" : participants.player.displayReference;
  return {
    relationToBuyer: participants.player.relationToBuyer,
    displayReference,
    subject: displayReference,
    possessive: isSelf ? "tu" : "su",
    isSelf,
  };
}

export type CatalogProductReference = {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  condition: string;
  price: number;
  productHref: string;
  imagePath: string | null;
  handedness: string | null;
  family: string | null;
};

export type ProductAdviceAction =
  | "SURFACE_INCOMPATIBILITY"
  | "ASK_NEXT_QUESTION"
  | "PROVIDE_ADVICE";

export type NextAction =
  | "ANSWER_SOCIAL" | "ANSWER_DIRECT_QUESTION" | "ASK_NEXT_QUESTION"
  | "ASK_CLARIFICATION" | "SEARCH_CATALOG" | "SEARCH_ALTERNATIVES"
  | "RUN_RECOMMENDATION" | "RUN_COMPARISON" | "EXPLAIN_PRODUCT"
  | "EXPLAIN_PRODUCT_REASON" | "SURFACE_INCOMPATIBILITY"
  | "RETURN_RECOMMENDATIONS" | "RETURN_TERMINAL_OUTCOME";

export type ActionResult = {
  action: NextAction;
  status: "COMPLETED" | "FAILED";
  error?: string | null;
  products?: unknown[];
  recommendationOutcome?: string | null;
  nextQuestion?: NextBestQuestion | null;
};

export function evaluateFocusedProductAgainstKnownFacts(input: {
  product: CatalogProductReference;
  answers: Record<string, string | number | boolean | null>;
}) {
  const playerHand = input.answers.handedness;
  const productHand = input.product.handedness;
  if ((playerHand === "LEFT" || playerHand === "RIGHT") &&
      (productHand === "LEFT" || productHand === "RIGHT") && playerHand !== productHand) {
    return { status: "HARD_INCOMPATIBLE" as const, reason: "RIGHT_OR_LEFT_HANDED_PRODUCT_MISMATCH" };
  }
  if (input.answers.handedness && (input.answers.setExperience || input.answers.skill || input.answers.handicap))
    return { status: "ENOUGH_TO_ADVISE" as const, reason: null };
  return { status: "NEEDS_MORE_INFORMATION" as const, reason: null };
}

export function getNextProductAdviceQuestion(input: {
  answers: Record<string, string | number | boolean | null>;
}) {
  if (input.answers.handedness !== "LEFT" && input.answers.handedness !== "RIGHT")
    return { key: "handedness", meaning: "ASK_PLAYER_HANDEDNESS", importance: "MATERIAL" as const, targetEntity: "PLAYER" as const };
  if (!input.answers.setExperience && !input.answers.experience)
    return { key: "setExperience", meaning: "ASK_SET_EXPERIENCE", importance: "MATERIAL" as const, targetEntity: "PLAYER" as const };
  if (!input.answers.skill && input.answers.handicap === undefined)
    return { key: "skill", meaning: "ASK_PLAYER_SKILL_LEVEL", importance: "MATERIAL" as const, targetEntity: "PLAYER" as const };
  return null;
}

export function questionPromptFor(spec: ReturnType<typeof getNextProductAdviceQuestion>, perspective: PlayerPerspective, category: string | null) {
  if (!spec) return null;
  const player = perspective.isSelf ? "tú" : perspective.subject;
  const possessive = perspective.isSelf ? "tu" : perspective.possessive;
  if (spec.meaning === "ASK_PLAYER_HANDEDNESS") return perspective.isSelf ? "¿Juegas como diestro o zurdo?" : `¿${player} juega como diestro o zurdo?`;
  if (spec.meaning === "ASK_SET_EXPERIENCE") return perspective.isSelf ? "¿Es tu primer set o ya juegas actualmente?" : `¿Es el primer set de ${player} o ya juega actualmente?`;
  if (spec.meaning === "ASK_PLAYER_SKILL_LEVEL") return perspective.isSelf ? "¿Cómo describirías tu nivel: principiante, intermedio o avanzado?" : `¿Cómo describirías el nivel de ${possessive} juego: principiante, intermedio o avanzado?`;
  return `¿Qué te gustaría contarnos sobre ${category ?? "tu equipo"}?`;
}

export type ConversationResult = {
  state: ConversationState;
  reply: string;
  nextQuestion: NextBestQuestion | null;
  objection: ConversationObjection | null;
  events: string[];
};

export const EMPTY_SESSION: BestRoundProSessionSummary = {
  requestedCategory: null,
  purchaseIntent: "EXPLORING",
  budgetMxnMinor: null,
  objections: [],
  productsConsidered: [],
  diagnosticAnswers: {},
  unresolvedQuestions: [],
  summary: null,
};

export function initialConversationState(): ConversationState {
  return {
    session: {
      ...EMPTY_SESSION,
      objections: [...EMPTY_SESSION.objections],
      productsConsidered: [...EMPTY_SESSION.productsConsidered],
      diagnosticAnswers: { ...EMPTY_SESSION.diagnosticAnswers },
      unresolvedQuestions: [...EMPTY_SESSION.unresolvedQuestions],
    },
    messages: [],
    discussedProductIds: [],
    pendingQuestionKey: null,
    pendingQuestionCategory: null,
    pendingQuestionSlotType: null,
    lastCatalogResults: [],
    lastFocusedProduct: null,
    productAdvice: {
      active: false,
      product: null,
      pendingQuestionKey: null,
      collectedAnswers: {},
    },
    participants: {
      buyer: { isLoggedInUser: true },
      player: { relationToBuyer: "SELF", displayReference: "tú", facts: {} },
    },
    pendingAssistantOffer: null,
  };
}

function normalizeShortAnswer(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("es-MX")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?!.,;:]/g, "")
    .replace(/\s+/g, " ");
}

function normalizeNaturalLanguage(value: string) {
  return normalizeShortAnswer(value).replace(/["'¿?¡!.,;:()]/g, " ");
}

export function resolveContextualShortAnswer(input: {
  pendingQuestionKey: string | null;
  userMessage: string;
}) {
  const value = normalizeShortAnswer(input.userMessage);
  if (!input.pendingQuestionKey) return null;
  if (
    input.pendingQuestionKey === "swingSpeed" &&
    /^(no|no se|ni idea|no tengo idea|no recuerdo|no la conozco|nunca la he medido)$/.test(
      value,
    )
  )
    return {
      field: "swingSpeed",
      value: "ANSWERED_UNKNOWN" as const,
      answerState: "ANSWERED_UNKNOWN" as const,
    };
  if (
    input.pendingQuestionKey === "acceptUsed" &&
    /^(no|no quiero|solo nuevo)$/.test(value)
  )
    return {
      field: "conditionPreference",
      value: "NEW_ONLY" as const,
      answerState: "ANSWERED_NEGATIVE" as const,
    };
  if (
    ["length", "gapping", "currentBag", "skill", "shotTendency"].includes(
      input.pendingQuestionKey,
    ) &&
    /^(no|no se|ni idea|no recuerdo|no la conozco)$/.test(value)
  ) {
    const fieldByQuestion: Record<string, string> = {
      length: "length",
      gapping: "gapping",
      currentBag: "currentBag",
      skill: "skill",
      shotTendency: "shotTendency",
      objective: "objective",
    };
    return {
      field: fieldByQuestion[input.pendingQuestionKey],
      value: "ANSWERED_UNKNOWN" as const,
      answerState: "ANSWERED_UNKNOWN" as const,
    };
  }
  return null;
}

function categoryLabel(category: MatchCategory | string) {
  const labels: Record<string, string> = {
    DRIVER: "Driver",
    FAIRWAY_WOOD: "madera de calle (Fairway)",
    HYBRID: "híbrido",
    IRON: "hierros",
    WEDGE: "Wedge",
    PUTTER: "Putter",
    SET: "set completo",
  };
  return labels[category] ?? category;
}

export function detectCategory(text: string): ProductFamily | null {
  return detectGolfCategory(normalizeNaturalLanguage(text));
}

function detectObjection(text: string): ConversationObjection | null {
  if (/car[oa]|precio|presupuesto/i.test(text)) return "PRICE";
  if (/no s[eé]|duda|seguro|encaja|fit|compatib/i.test(text))
    return "UNCERTAIN_FIT";
  if (/otra\s+marca|no\s+quiero|marca/i.test(text)) return "BRAND";
  if (/nuevo|usado|seminuevo/i.test(text)) return "NEW_VS_USED";
  if (/pensar|lo\s+voy\s+a\s+pensar/i.test(text)) return "NEED_TO_THINK";
  if (/otra|otro|alternativa|muéstrame/i.test(text)) return "WANT_OTHER_OPTION";
  return null;
}

function detectIntent(text: string): BuyingIntent | null {
  if (/comprar|me\s+lo\s+llev|hoy|necesito\s+ya/i.test(text)) return "BUY_NOW";
  if (/explor|comparar|aprender|conocer/i.test(text)) return "EXPLORING";
  return null;
}

export type CurrentEquipmentReference = {
  category: MatchCategory;
  clubNumber: number | null;
  subtype: "SAND" | "GAP" | "LOB" | "APPROACH" | null;
  brand: string | null;
};

const KNOWN_BRANDS = [
  "TaylorMade",
  "Titleist",
  "Callaway",
  "PING",
  "Cobra",
  "Mizuno",
  "Srixon",
  "Cleveland",
  "Odyssey",
];

export function parseCurrentEquipment(
  text: string,
): CurrentEquipmentReference[] {
  const numberWords: Record<string, number> = {
    uno: 1,
    dos: 2,
    tres: 3,
    cuatro: 4,
    cinco: 5,
    seis: 6,
    siete: 7,
    ocho: 8,
    nueve: 9,
  };
  const references: Array<CurrentEquipmentReference | null> = text
    .split(/,|\s+y\s+/i)
    .map((part): CurrentEquipmentReference | null => {
      const interpretation = interpretGolfCategory(part);
      if (!interpretation || interpretation.category === "SET") return null;
      const numberToken = part.match(/\b([1-9])\b/i)?.[1];
      const wordNumber = Object.entries(numberWords).find(([word]) =>
        new RegExp(`\\b${word}\\b`, "i").test(part),
      )?.[1];
      const normalizedPart = normalizeNaturalLanguage(part).replace(/\s+/g, "");
      const brand = KNOWN_BRANDS.find((name) =>
        normalizedPart.includes(normalizeNaturalLanguage(name).replace(/\s+/g, "")),
      );
      return {
        category: interpretation.category,
        clubNumber:
          interpretation.clubNumber ??
          (numberToken
            ? Number(numberToken)
            : wordNumber
              ? numberWords[wordNumber]
              : null),
        subtype: interpretation.subtype,
        brand: brand ?? null,
      };
    });
  return references.filter(
    (item): item is CurrentEquipmentReference => item !== null,
  );
}

function parseAnswers(
  text: string,
  current: Record<string, string | number | boolean | null>,
  pendingQuestionKey: string | null,
  category: MatchCategory | null,
) {
  const answers = { ...current };
  // A declined pending field is answered, not missing. The semantic
  // interpreter supplies this status in normal production; this conservative
  // fallback keeps the deterministic path from re-asking the slot.
  if (
    pendingQuestionKey === "skill" &&
    /(?:prefiero|no quiero)\s+(?:no\s+)?decir|no\s+te\s+lo\s+quiero\s+decir/i.test(text)
  ) {
    answers.handicap = "DECLINED";
    answers.skill = "DECLINED";
  }
  if (/\bno\s+(s[eé]|la\s+conozco|tengo\s+ese\s+dato)\b/i.test(text)) {
    if (current.swingSpeed === undefined)
      answers.swingSpeed = "ANSWERED_UNKNOWN";
    if (current.shotTendency === undefined)
      answers.shotTendency = "ANSWERED_UNKNOWN";
    if (current.currentBag === undefined)
      answers.currentBag = "ANSWERED_UNKNOWN";
    if (current.gapping === undefined) answers.gapping = "ANSWERED_UNKNOWN";
    if (current.turfInteraction === undefined)
      answers.turfInteraction = "ANSWERED_UNKNOWN";
    if (current.length === undefined) answers.length = "ANSWERED_UNKNOWN";
    if (current.strokeType === undefined)
      answers.strokeType = "ANSWERED_UNKNOWN";
  }
  if (/\b(diestro|derecho|derechos|right)\b/i.test(text))
    answers.handedness = "RIGHT";
  if (/\b(zurdo|zurda|zurdos|izquierdo|izquierda|left)\b/i.test(text))
    answers.handedness = "LEFT";
  if (
    /slic(?:e)?\b|slide\b|slise\b|slaice\b|reban|se\s+abre/i.test(text) &&
    (pendingQuestionKey === "shotTendency" || category === "DRIVER")
  )
    answers.shotTendency = "SLICE";
  if (/hook|gancho|se\s+cierra/i.test(text)) answers.shotTendency = "HOOK";
  if (/recto|straight/i.test(text)) answers.shotTendency = "STRAIGHT";
  if (
    pendingQuestionKey === "shotTendency" &&
    /\b(normal|normalmente\s+recto|va\s+normal|vuelo\s+normal|sin\s+desviaci[oó]n|bastante\s+recto|m[aá]s\s+o\s+menos\s+recto)\b/i.test(
      text,
    )
  )
    answers.shotTendency = "STRAIGHT";
  if (
    pendingQuestionKey === "shotTendency" &&
    /\b(ninguno|ninguna|no\s+tengo(?:\s+un)?\s+fallo(?:s)?(?:\s+com[uú]n)?|ning[uú]n\s+fallo|no\s+realmente|ninguno\s+en\s+particular)\b/i.test(
      text,
    )
  )
    answers.shotTendency = "NO_COMMON_MISS";
  if (/forgiveness|perd[oó]n|perdonador|f[aá]cil|consisten/i.test(text))
    answers.objective = "MORE_FORGIVENESS";
  if (
    pendingQuestionKey === "objective" &&
    /\b(distancia|m[aá]s\s+(?:distancia|lejos|yardas|largo)|pegar\s+m[aá]s\s+lejos|ganar\s+yardas|llegar\s+m[aá]s\s+lejos)\b/i.test(
      text,
    )
  )
    answers.objective = "MORE_DISTANCE";
  if (
    pendingQuestionKey === "objective" &&
    /\b(perd[oó]n|tolerancia|consistente|estabilidad|m[aá]s\s+recto|fallar\s+menos)\b/i.test(
      text,
    )
  )
    answers.objective = "MORE_FORGIVENESS";
  if (
    pendingQuestionKey === "objective" &&
    /\b(slice|menos\s+slice|corregir\s+slice|cerrar\s+el\s+slice|derecha)\b/i.test(
      text,
    )
  )
    answers.objective = "REDUCE_SLICE";
  if (/slice|slide|slise|slaice/i.test(text) && category === "DRIVER")
    answers.objective ??= "REDUCE_SLICE";
  if (pendingQuestionKey === "objective" && /\b(nada|ninguna cosa|no quiere mejorar|sin cambiar|igual que ahora)\b/i.test(text))
    answers.objective = "NONE";
  const numericSlot = ["skill", "gapping", "swingSpeed", "length"].includes(
    pendingQuestionKey ?? "",
  );
  if (!numericSlot && /\b(\d{1,3})(?:\s*)(?:pesos|mxn|mil)?\b/i.test(text)) {
    const match = text.match(/\b(\d{1,3})(?:\s*)(?:pesos|mxn|mil)?\b/i);
    if (match)
      answers.budget = Number(match[1]) * (Number(match[1]) < 1000 ? 100 : 1);
  }
  const handicap = text.match(
    /(?:handicap|hcp|soy|tengo|como)?\s*(\d+(?:\.\d+)?)/i,
  );
  if (
    (pendingQuestionKey === "skill" || /handicap|hcp/i.test(text)) &&
    handicap &&
    Number(handicap[1]) >= 0 &&
    Number(handicap[1]) <= 54
  ) {
    answers.handicap = Number(handicap[1]);
    answers.skill = "ANSWERED_VALUE";
  }
  if (pendingQuestionKey === "gapping") {
    const gap = text.match(
      /(?:entre\s+)?(\d{1,3})(?:\s*(?:a|y|-)\s*(\d{1,3}))?/i,
    );
    if (gap) {
      answers.gapping = Number(gap[1]);
      answers.gappingUnit = /(?:yd|yarda|yardas)/i.test(text)
        ? "YARDS"
        : /(?:m|metro|metros)/i.test(text)
          ? "METERS"
          : "ASSUMED_YARDS_FROM_CONTEXT";
    }
  }
  if (pendingQuestionKey === "length") {
    const length = text.match(/\b(\d{2})\b/);
    if (length && Number(length[1]) >= 28 && Number(length[1]) <= 40) {
      answers.length = Number(length[1]);
      answers.lengthUnit = "INCHES";
    }
  }
  if (pendingQuestionKey === "swingSpeed") {
    const speed = text.match(/\b(\d{2,3})\b/);
    if (speed) answers.swingSpeed = Number(speed[1]);
  }
  if (pendingQuestionKey === "currentBag") {
    const equipment = parseCurrentEquipment(text);
    if (equipment.length) {
      // currentBag is the canonical diagnostic slot. Keep the richer alias for
      // consumers that want the parsed entities, but slot completion must not
      // depend on brand/model enrichment.
      const serialized = JSON.stringify(equipment);
      answers.currentBag = serialized;
      answers.currentEquipment = serialized;
      answers.currentBagAnswerState = "ANSWERED_VALUE";
    } else if (/\b(ninguno|no\s+(?:llevo|tengo|uso)|solo\s+hierros)\b/i.test(text)) {
      answers.currentBag = "KNOWN_NONE";
      answers.currentEquipment = "[]";
      answers.currentBagAnswerState = "ANSWERED_VALUE";
    }
  }
  if (pendingQuestionKey === "turfInteraction") {
    if (/\b(barre|barro|barrer|raspa|superficial|poco\s+divot)\b/i.test(text))
      answers.turfInteraction = "SWEEPER";
    else if (
      /\b(neutro|normal|intermedio|ni\s+mucho\s+ni\s+poco)\b/i.test(text)
    )
      answers.turfInteraction = "NEUTRAL";
    else if (
      /\b(profundo|cavo|mucho\s+divot|entra\s+profundo|pego\s+hacia\s+abajo)\b/i.test(
        text,
      )
    )
      answers.turfInteraction = "DIGGER";
  }
  if (/nuevo\s+sol|solo\s+nuevo/i.test(text))
    answers.conditionPreference = "NEW_ONLY";
  if (/usado|seminuevo|valor/i.test(text))
    answers.conditionPreference = "USED_ACCEPTABLE";
  if (/regular/i.test(text)) answers.shaftFlex = "REGULAR";
  if (/stiff/i.test(text)) answers.shaftFlex = "STIFF";
  return answers;
}

export function knownFacts(
  profile: MiGolfProfile | null,
  session: BestRoundProSessionSummary,
): Record<string, unknown> {
  const answers = session.diagnosticAnswers;
  return {
    handedness:
      profile?.handedness && profile.handedness !== "UNKNOWN"
        ? profile.handedness
        : answers.handedness,
    objective: answers.objective,
    shotTendency: profile?.shotTendency ?? answers.shotTendency,
    swingSpeed: answers.swingSpeed,
    currentBag: answers.currentBag,
    skill: profile?.skillLevel ?? answers.skill ?? answers.handicap,
    handicap: answers.handicap,
    gapping: answers.gapping,
    turfInteraction: answers.turfInteraction,
    length: answers.length,
    strokeType: answers.strokeType,
  };
}

export function nextQuestionFor(
  category: string | null,
  profile: MiGolfProfile | null,
  session: BestRoundProSessionSummary,
): NextBestQuestion | null {
  if (!category) return null;
  return nextBestQuestion(category, knownFacts(profile, session));
}

export function classifyConversationTurn(
  state: ConversationState,
  text: string,
  profile: MiGolfProfile | null = null,
  playerPerspective: PlayerPerspective | null = null,
  options: { allowDeterministicFallback?: boolean } = {},
): ConversationResult {
  const allowFallback = options.allowDeterministicFallback !== false;
  const contextual = allowFallback ? resolveContextualShortAnswer({
    pendingQuestionKey: state.pendingQuestionKey,
    userMessage: text,
  }) : null;
  const detectedCategory = allowFallback ? detectCategory(text) : null;
  const explicitCategoryChange =
    /\b(mejor|quiero|busco|necesito|cambiemos|veamos|prefiero)\b[\s\S]{0,24}\b(driver|drive|driber|draiver|fairway|wood|madera|hybrid|hibrido|rescue|iron|hierro|fierro|wedge|sand|gap|lob|putter|putt|put|pot|pater)\b/i.test(
      text,
    );
  const category =
    state.pendingQuestionKey === "currentBag" &&
    state.session.requestedCategory &&
    !explicitCategoryChange
      ? state.session.requestedCategory
      : (detectedCategory ?? state.session.requestedCategory);
  const intent = detectIntent(text) ?? state.session.purchaseIntent;
  const objection = detectObjection(text);
  const answers = allowFallback
    ? parseAnswers(text, state.session.diagnosticAnswers, state.pendingQuestionKey, category as MatchCategory | null)
    : { ...state.session.diagnosticAnswers };
  if (contextual) answers[contextual.field] = contextual.value;
  const speed = text.match(/\b(\d{2,3})\s*(?:mph|km\/h)?\b/i);
  if (state.pendingQuestionKey === "swingSpeed" && speed)
    answers.swingSpeed = Number(speed[1]);
  const session: BestRoundProSessionSummary = {
    ...state.session,
    requestedCategory: category,
    purchaseIntent: intent,
    budgetMxnMinor:
      typeof answers.budget === "number"
        ? Number(answers.budget)
        : state.session.budgetMxnMinor,
    diagnosticAnswers: answers,
    objections:
      objection && !state.session.objections.includes(objection)
        ? [...state.session.objections, objection]
        : state.session.objections,
    unresolvedQuestions: [],
  };
  const next = nextQuestionFor(category, profile, session);
  const events = state.messages.length === 0 ? ["SESSION_STARTED"] : [];
  if (category && category !== state.session.requestedCategory)
    events.push("CATEGORY_SELECTED");
  if (next) session.unresolvedQuestions = [next.id];
  const distanceOnlyRequest =
    !category &&
    /\b(pegar|ganar)\s+(?:(?:más\s+)?distancia|más\s+lejos)\b/i.test(text);
  const extractedFacts = [
    category ? `buscas un ${categoryLabel(category)}` : "",
    answers.handedness === "RIGHT" ? "juegas como diestro" : "",
    answers.handedness === "LEFT" ? "juegas como zurdo" : "",
    answers.shotTendency === "SLICE" ? "tu miss habitual es slice" : "",
    answers.shotTendency === "HOOK" ? "tu miss habitual es hook" : "",
  ].filter(Boolean);
  const understandingPrefix =
    extractedFacts.length >= 2 && !objection
      ? `Perfecto: entiendo que ${extractedFacts.join(" y ")}. `
      : "";
  const nextPrompt = next && playerPerspective && !playerPerspective.isSelf
    ? {
        handedness: `¿${playerPerspective.subject} juega como diestro o zurdo?`,
        objective: `¿Hay algo que ${playerPerspective.subject} quiera mejorar con su próximo ${categoryLabel(category ?? "equipo").toLowerCase()}?`,
        shotTendency: `¿${playerPerspective.possessive} tiro normalmente va recto o suele aparecer slice o hook?`,
        swingSpeed: `¿Conoce ${playerPerspective.possessive} velocidad de swing aproximada?`,
        skill: `¿Cómo describirías el nivel de ${playerPerspective.possessive} juego: principiante, intermedio o avanzado?`,
      }[next.id] ?? next.prompt
    : next?.prompt;
  const reply = isProtectedRequest(text)
    ? "No puedo modificar el Match ni compartir información comercial interna. El Match se mantiene porque lo calcula el sistema con tu perfil y la configuración real del equipo."
    : objection === "NEED_TO_THINK"
      ? "Claro. Te dejo un resumen para que lo revises con calma; no tienes que decidir ahora."
      : objection === "PRICE"
        ? "Entiendo la preocupación por el precio. Puedo mostrarte una alternativa de valor sin inventar descuentos, manteniendo claro el compromiso técnico."
        : objection === "UNCERTAIN_FIT"
          ? "La compatibilidad es estimada con los datos disponibles. Te explico el Match, la confianza y qué dato faltaría antes de decidir."
          : objection === "WANT_OTHER_OPTION"
            ? "Voy a revisar otra opción responsable y distinta, sin repetir la misma unidad."
            : distanceOnlyRequest
              ? "Claro. ¿Quieres ganar distancia principalmente con el Driver o con otro palo?"
              : `${understandingPrefix}${
                  nextPrompt ??
                  (category
                    ? "Ya tengo lo necesario para revisar inventario real y compatibilidad."
                    : "¿Qué equipo buscas: Driver, Fairway, Hybrid, Hierros, Wedge o Putter?")
                }`;
  const nextState = {
    session,
    messages: [
      ...state.messages,
      { role: "user" as const, content: text },
      { role: "assistant" as const, content: reply },
    ],
    discussedProductIds: state.discussedProductIds,
    pendingQuestionKey: next?.id ?? null,
    pendingQuestionCategory: next?.category ?? null,
    pendingQuestionSlotType: next?.slotType ?? null,
    lastCatalogResults: state.lastCatalogResults,
    lastFocusedProduct: state.lastFocusedProduct,
    productAdvice: state.productAdvice,
    participants: state.participants,
    pendingAssistantOffer: state.pendingAssistantOffer,
  };
  return { state: nextState, reply, nextQuestion: next, objection, events };
}

export function recommendationReply(result: CommercialRankingResult): string {
  if (result.status === "NO_CURRENT_MATCH") {
    return "Hoy no tengo un match responsable disponible en inventario real. Puedo dejar definido el perfil que buscamos y avisarte cuando aparezca una opción adecuada.";
  }
  const best = result.recommendations[0];
  return best
    ? `Encontré una opción disponible: ${best.candidate.brand ?? ""} ${best.candidate.model ?? ""}. Match ${best.equipmentMatch.matchScore} y confianza ${best.equipmentMatch.confidence.toLowerCase()}.`
    : "No encontré una opción responsable disponible por ahora.";
}

export type ConversationOutcome =
  | "RECOMMENDATIONS_AVAILABLE"
  | "NO_INVENTORY"
  | "NO_RESPONSIBLE_MATCH"
  | "INSUFFICIENT_DATA";

export type ConversationOutcomeResult = {
  type: ConversationOutcome;
  message: string;
};

export function terminalOutcomeMessage(
  outcome: ConversationOutcome,
  category: string,
  handedness: string | number | boolean | null | undefined,
) {
  const label: Record<string, string> = {
    DRIVER: "drivers",
    FAIRWAY_WOOD: "maderas de calle",
    HYBRID: "híbridos",
    IRON: "hierros",
    WEDGE: "wedges",
    PUTTER: "putters",
  };
  const categoryLabel = label[category] ?? "opciones de equipo";
  const hand =
    handedness === "RIGHT"
      ? " para diestro"
      : handedness === "LEFT"
        ? " para zurdo"
        : "";
  if (outcome === "NO_INVENTORY")
    return `Ahora mismo no tengo ${categoryLabel}${hand} disponibles. Prefiero no recomendarte algo que no encaje contigo.`;
  if (outcome === "NO_RESPONSIBLE_MATCH")
    return "Sí encontré algunas opciones, pero ninguna encaja lo suficiente contigo como para recomendarla responsablemente.";
  return "No pude determinar un siguiente paso seguro. Puedo mostrarte opciones disponibles o revisar un producto concreto.";
}

export function priceObjectionReply(
  hasBestValue: boolean,
  hasAlternative: boolean,
) {
  if (hasBestValue)
    return "Sí, encontré una alternativa de Mejor valor en inventario real. Mantiene una compatibilidad responsable y reduce el precio, con un compromiso claro frente a la Mejor opción.";
  if (hasAlternative)
    return "Sí, encontré otra opción responsable en inventario real. Tiene un intercambio distinto frente a la Mejor opción y te muestro sus datos actuales.";
  return "En este momento no tengo una opción responsable más económica en inventario. La opción actual sigue siendo la más sólida técnicamente.";
}
