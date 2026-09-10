import type {
  BestRoundProSessionSummary,
  BuyingIntent,
  MiGolfProfile,
  MatchCategory,
  NextBestQuestion,
} from "@/lib/mi-golf/domain";
import { nextBestQuestion } from "@/lib/mi-golf/domain";
import type { CommercialRankingResult } from "@/lib/recommendations/commercial-ranking";

export type ConversationObjection =
  | "PRICE"
  | "UNCERTAIN_FIT"
  | "BRAND"
  | "NEW_VS_USED"
  | "NEED_TO_THINK"
  | "WANT_OTHER_OPTION";

export type ConversationState = {
  session: BestRoundProSessionSummary;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  discussedProductIds: string[];
};

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
    session: { ...EMPTY_SESSION },
    messages: [],
    discussedProductIds: [],
  };
}

const CATEGORY_ALIASES: Array<[MatchCategory, RegExp]> = [
  ["DRIVER", /\b(driver|drivers)\b/i],
  ["FAIRWAY_WOOD", /\b(fairway|madera\s+de\s+calle|maderas)\b/i],
  ["HYBRID", /\b(hybrid|híbrido|hibrido)\b/i],
  ["IRON", /\b(iron|hierro|hierros)\b/i],
  ["WEDGE", /\b(wedge|wedges)\b/i],
  ["PUTTER", /\b(putter|putt)\b/i],
];

export function detectCategory(text: string): MatchCategory | null {
  return (
    CATEGORY_ALIASES.find(([, pattern]) => pattern.test(text))?.[0] ?? null
  );
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

function parseAnswers(
  text: string,
  current: Record<string, string | number | boolean | null>,
) {
  const answers = { ...current };
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
  if (/\b(diestro|derecho|right)\b/i.test(text)) answers.handedness = "RIGHT";
  if (/\b(zurdo|zurda|izquierdo|left)\b/i.test(text))
    answers.handedness = "LEFT";
  if (/slice|reban|se\s+abre/i.test(text)) answers.shotTendency = "SLICE";
  if (/hook|gancho|se\s+cierra/i.test(text)) answers.shotTendency = "HOOK";
  if (/recto|straight/i.test(text)) answers.shotTendency = "STRAIGHT";
  if (/forgiveness|perd[oó]n|f[aá]cil|consisten/i.test(text))
    answers.objective = "MORE_FORGIVENESS";
  if (/slice/i.test(text)) answers.objective ??= "REDUCE_SLICE";
  if (/\b(\d{1,3})(?:\s*)(?:pesos|mxn|mil)?\b/i.test(text)) {
    const match = text.match(/\b(\d{1,3})(?:\s*)(?:pesos|mxn|mil)?\b/i);
    if (match)
      answers.budget = Number(match[1]) * (Number(match[1]) < 1000 ? 100 : 1);
  }
  const handicap = text.match(/handicap\s*(?:de|:)?\s*(\d+(?:\.\d+)?)/i);
  if (handicap) answers.handicap = Number(handicap[1]);
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
    skill: profile?.skillLevel ?? answers.skill,
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
): ConversationResult {
  const category = detectCategory(text) ?? state.session.requestedCategory;
  const intent = detectIntent(text) ?? state.session.purchaseIntent;
  const objection = detectObjection(text);
  const answers = parseAnswers(text, state.session.diagnosticAnswers);
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
  const reply =
    objection === "NEED_TO_THINK"
      ? "Claro. Te dejo un resumen para que lo revises con calma; no tienes que decidir ahora."
      : objection === "PRICE"
        ? "Entiendo la preocupación por el precio. Puedo mostrarte una alternativa de valor sin inventar descuentos, manteniendo claro el compromiso técnico."
        : objection === "UNCERTAIN_FIT"
          ? "La compatibilidad es estimada con los datos disponibles. Te explico el Match, la confianza y qué dato faltaría antes de decidir."
          : objection === "WANT_OTHER_OPTION"
            ? "Voy a revisar otra opción responsable y distinta, sin repetir la misma unidad."
            : (next?.prompt ??
              (category
                ? "Ya tengo lo necesario para revisar inventario real y compatibilidad."
                : "¿Qué equipo buscas: Driver, Fairway, Hybrid, Hierros, Wedge o Putter?"));
  const nextState = {
    session,
    messages: [
      ...state.messages,
      { role: "user" as const, content: text },
      { role: "assistant" as const, content: reply },
    ],
    discussedProductIds: state.discussedProductIds,
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
