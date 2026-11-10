export type BrpScenario = {
  id: string;
  category: string;
  initialContext: {
    requestedCategory: string | null;
    pendingQuestionKey: string | null;
    recipient: "SELF" | "THIRD_PARTY" | "UNKNOWN";
    profileFacts: string[];
    focusedProduct: string | null;
  };
  userMessages: string[];
  expectedIntent: string;
  expectedDialogueActs?: string[];
  expectedFacts: string[];
  expectedProductCategory: string | null;
  expectedRouteIntent?: string | null;
  expectedRecipient: "SELF" | "THIRD_PARTY" | "UNKNOWN";
  requiredOutcome: string;
  forbiddenOutcome: string[];
  notes: string;
  providerEval: boolean;
};

type GroupSeed = {
  key: string;
  category: string;
  expectedIntent: string;
  expectedDialogueActs?: string[];
  expectedProductCategory: string | null;
  expectedRouteIntent?: string | null;
  messages: string[];
  expectedFacts?: string[];
  requestedCategory?: string | null;
  pendingQuestionKey?: string | null;
  recipient?: "SELF" | "THIRD_PARTY" | "UNKNOWN";
  profileFacts?: string[];
  focusedProduct?: string | null;
  requiredOutcome?: string;
  forbiddenOutcome?: string[];
};

function group(seed: GroupSeed): BrpScenario[] {
  return seed.messages.map((message, index) => ({
    id: `brp-v1-${seed.key}-${String(index + 1).padStart(2, "0")}`,
    category: seed.category,
    initialContext: {
      requestedCategory: seed.requestedCategory ?? seed.expectedProductCategory,
      pendingQuestionKey: seed.pendingQuestionKey ?? null,
      recipient: seed.recipient ?? "SELF",
      profileFacts: seed.profileFacts ?? [],
      focusedProduct: seed.focusedProduct ?? null,
    },
    userMessages: [message],
    expectedIntent: seed.expectedIntent,
    expectedDialogueActs: seed.expectedDialogueActs,
    expectedFacts: seed.expectedFacts ?? [],
    expectedProductCategory: seed.expectedProductCategory,
    expectedRouteIntent: seed.expectedRouteIntent,
    expectedRecipient:
      seed.recipient ??
      (/\b(?:mi esposa|mi hijo|mi hija|un amigo|un regalo|para mi hijo)\b/i.test(
        message,
      )
        ? "THIRD_PARTY"
        : "SELF"),
    requiredOutcome:
      seed.requiredOutcome ??
      "answer the latest user request without inventing catalog facts",
    forbiddenOutcome: seed.forbiddenOutcome ?? [
      "unsupported product claim",
      "cross-user memory",
      "unavailable item recommended",
    ],
    notes: `Curated synthetic case for ${seed.category}; no production product identifiers or personal data.`,
    providerEval:
      [
        "beginner",
        "driver",
        "objections",
        "product-context",
        "difficult",
      ].includes(seed.key) &&
      ([0, 3, 6, 9].includes(index) ||
        (["product-context", "difficult"].includes(seed.key) && index === 2)),
  }));
}

export const bestRoundProScenarios: BrpScenario[] = [
  ...group({
    key: "beginner",
    category: "Beginner",
    expectedIntent: "FITTING_RECOMMENDATION",
    expectedProductCategory: "DRIVER",
    expectedFacts: ["skill:BEGINNER"],
    messages: [
      "Estoy empezando, ¿qué driver me recomiendas?",
      "Quiero mi primer driver para empezar a jugar.",
      "Nunca he comprado palos; ¿qué driver me puede servir?",
      "Juego dos veces al mes y soy principiante: busco un driver.",
      "No sé mi handicap, pero apenas comienzo y quiero un driver.",
      "¿Qué driver recomendarías a alguien que está aprendiendo?",
      "Estoy empezando y quiero algo sencillo para salir del tee.",
      "Es mi primer set, ¿qué debería considerar?",
      "Juego ocasionalmente y no sé mucho de palos; ayúdame con un driver.",
      "Quiero iniciar en golf, ¿necesito un set completo?",
    ],
  }),
  ...group({
    key: "level",
    category: "Handicap / level",
    expectedIntent: "FITTING_RECOMMENDATION",
    expectedProductCategory: "DRIVER",
    messages: [
      "Tengo handicap 2; recomiéndame un driver.",
      "Mi handicap es 10 y busco un driver.",
      "Juego con handicap 18, ¿qué driver revisamos?",
      "Tengo handicap 30 y quiero un driver compatible.",
      "No tengo handicap; busco un driver para mi juego.",
      "Soy buen jugador, pero no sé mi handicap; ¿qué driver me recomiendas?",
      "Antes dije handicap 18, corrijo: ahora es 12. Recomiéndame un driver.",
      "Tengo handicap bajo y quiero revisar un driver.",
    ],
    expectedFacts: ["handicapIndex:KNOWN"],
  }),
  ...group({
    key: "handedness",
    category: "Handedness",
    expectedIntent: "FITTING_RECOMMENDATION",
    expectedProductCategory: "DRIVER",
    messages: [
      "Soy zurdo, recomiéndame un driver.",
      "Juego como diestro y busco un driver.",
      "No sé si soy zurdo o diestro en los palos; ayúdame a elegir.",
      "Soy zurda y quiero un driver para mi juego.",
      "¿Qué tienes para zurdo?",
      "Soy diestro, pero el producto enfocado dice LH; ¿me sirve?",
      "El catálogo parece no tener opciones zurdas de driver; ¿qué alternativa hay?",
      "Corrijo: juego como zurdo, no diestro.",
    ],
    expectedFacts: ["handedness:LEFT"],
  }),
  ...group({
    key: "driver",
    category: "Driver",
    expectedIntent: "FITTING_RECOMMENDATION",
    expectedProductCategory: "DRIVER",
    messages: [
      "Tengo slice; ¿qué driver me recomiendas?",
      "Mi miss es hook y busco un driver.",
      "Quiero más precisión desde el tee; ¿qué driver encaja?",
      "Busco distancia con una velocidad de swing lenta.",
      "Mi swing es rápido; ¿qué debería revisar en un driver?",
      "¿Qué loft de driver me conviene si no conozco mi velocidad?",
      "Tengo una varilla regular; ¿me sirve el driver enfocado?",
      "Uso stiff actualmente; compara un driver con esa flexibilidad.",
      "Quiero específicamente el Titleist GT3; ¿me sirve para mi juego?",
      "El driver enfocado no coincide con mi mano, ¿qué hago?",
      "¿Qué drivers tienen disponibles?",
      "¿Hay un driver de 9 grados en stock?",
    ],
  }),
  ...group({
    key: "fairway",
    category: "Fairway / Hybrid",
    expectedIntent: "FITTING_RECOMMENDATION",
    expectedProductCategory: "FAIRWAY_WOOD",
    messages: [
      "Quiero reemplazar un hierro largo; ¿madera o híbrido?",
      "¿Qué diferencia práctica hay entre madera 3 y madera 5?",
      "Me cuesta pegar el hierro 4; ¿un híbrido podría servir?",
      "No logro pegar desde fairway con mi madera.",
      "Soy principiante: ¿madera 5 o híbrido?",
      "Juego avanzado y busco cubrir el hueco entre driver y hierros.",
      "Necesito una alternativa a mi hierro largo para salir del rough.",
      "¿Qué híbridos hay disponibles para diestro?",
    ],
  }),
  ...group({
    key: "irons",
    category: "Irons",
    expectedIntent: "FITTING_RECOMMENDATION",
    expectedProductCategory: "IRON",
    messages: [
      "Busco hierros game improvement para handicap alto.",
      "Tengo handicap bajo y quiero comparar player irons.",
      "¿Me convienen blades con handicap 20?",
      "Prefiero varilla de grafito en mis hierros.",
      "Busco hierros con varilla de acero; ¿qué hay disponible?",
      "Sólo necesito un set parcial de hierros.",
      "Quiero un juego completo de hierros para mi nivel intermedio.",
      "¿Qué hierros activos hay en inventario?",
    ],
  }),
  ...group({
    key: "wedges",
    category: "Wedges",
    expectedIntent: "FITTING_RECOMMENDATION",
    expectedProductCategory: "WEDGE",
    messages: [
      "Necesito mejorar el gapping de mis wedges.",
      "Tengo un gap wedge de 50 y busco evitar duplicar loft.",
      "¿Qué bounce conviene para un campo firme?",
      "Juego en pasto suave y quiero revisar bounce.",
      "No sé mis lofts; sólo sé que mi wedge llega a 80 yardas.",
      "Mis wedges actuales son 50, 54 y 58 grados.",
      "Ya tengo un wedge de 56; ¿otro de 56 duplicaría función?",
      "Busco un sand wedge para completar mi juego corto.",
    ],
    expectedFacts: ["currentWedgeLofts:CONFIRMED"],
  }),
  ...group({
    key: "putter",
    category: "Putter",
    expectedIntent: "FITTING_RECOMMENDATION",
    expectedProductCategory: "PUTTER",
    messages: [
      "¿Blade o mallet para mi putter?",
      "No sé qué longitud de putter necesito.",
      "Prefiero la estética de un blade; ¿qué opciones revisamos?",
      "Me cuesta alinear putts largos.",
      "Quiero ver putters disponibles con una forma compacta.",
      "Mi putter actual se siente demasiado largo; comparemos.",
    ],
  }),
  ...group({
    key: "objections",
    category: "Budget / objections",
    expectedIntent: "PRODUCT_COMPARISON",
    expectedProductCategory: "DRIVER",
    messages: [
      "Está muy caro, ¿hay una alternativa más barata?",
      "Quiero algo más económico sin comprometer demasiado el ajuste.",
      "¿Por qué este driver y no otro?",
      "Prefiero usado; recomiéndame un driver seminuevo.",
      "Sólo quiero Titleist; recomiéndame un driver de esa marca.",
      "No quiero Callaway; muéstrame otro driver.",
      "Quiero pensarlo con calma, no necesito decidir ahora.",
      "Muéstrame otra opción de driver distinta a la anterior.",
      "No quiero pagar de más; compara opciones disponibles.",
      "¿Cuál es una alternativa de valor con stock real?",
    ],
  }),
  ...group({
    key: "mi-golf",
    category: "Mi Golf",
    expectedIntent: "FITTING_RECOMMENDATION",
    expectedProductCategory: "DRIVER",
    profileFacts: ["handicapIndex", "handedness", "currentEquipment"],
    messages: [
      "Mi perfil está vacío; ayúdame a elegir un driver.",
      "Con mi perfil completo, recomienda un driver según mis datos.",
      "Corrijo mi handicap: ahora es 14.",
      "Actualiza mi mano de juego a izquierda.",
      "Agrega a mi bolsa un híbrido que acabo de comprar.",
      "Ya no uso el hierro 5 que aparece en mi equipo.",
      "Según mi equipo actual, ¿qué driver cubre mejor mi necesidad?",
      "Estoy comprando un driver para mi hijo, no para mí.",
    ],
    expectedFacts: ["facts-owner:PLAYER"],
  }),
  ...group({
    key: "product-context",
    category: "Product context",
    expectedIntent: "FITTING_RECOMMENDATION",
    expectedProductCategory: "DRIVER",
    focusedProduct: "Demo Driver A",
    messages: [
      "¿Este driver me sirve?",
      "¿Por qué me recomiendas este producto?",
      "Compáralo con otra opción disponible.",
      "¿Hay algo más barato que este driver?",
      "¿Qué cambia respecto a mi driver actual?",
      "No sé si este modelo es compatible con mi mano.",
      "¿Este Titleist tiene el loft que necesito?",
      "Muéstrame un producto parecido de otra marca.",
    ],
  }),
  ...group({
    key: "stock",
    category: "Stock / catalog",
    expectedIntent: "CATALOG_SEARCH",
    expectedProductCategory: "DRIVER",
    messages: [
      "¿Qué drivers hay con inventario?",
      "Busca drivers sin inventario y dime si no hay opciones.",
      "No encuentro el modelo Demo X; ¿existe en catálogo?",
      "La variante de 10.5 grados aparece agotada.",
      "¿Qué opciones Marketplace hay para driver?",
      "¿Hay productos First Party disponibles?",
      "No me muestres productos archivados.",
      "¿Hay listings de Partner publicados ahora?",
    ],
    requiredOutcome: "use only currently public, active, sellable catalog rows",
    forbiddenOutcome: [
      "recommend zero quantity",
      "recommend archived record",
      "claim expired quote is valid",
    ],
  }),
  ...group({
    key: "difficult",
    category: "Difficult conversation / loops",
    expectedIntent: "OTHER",
    expectedProductCategory: "DRIVER",
    requestedCategory: "DRIVER",
    pendingQuestionKey: "handedness",
    messages: [
      "Ahora mejor hablemos de wedges.",
      "Sí.",
      "No sé.",
      "Corrijo lo que dije antes: soy zurdo.",
      "No sé, tal vez uno que ayude con eso.",
      "Quiero un driver y también saber si hay envío.",
      "Volvamos a comparar el driver anterior.",
      "Ya te dije que soy diestro.",
    ],
    expectedFacts: ["pending-answer:preserve-context", "no-repeat-question"],
  }),
];

const categoryOverrides: Record<string, string | null> = {
  "brp-v1-beginner-08": "SET",
  "brp-v1-beginner-10": "SET",
  "brp-v1-fairway-03": "HYBRID",
  // Gap/replacement questions allow multiple technically relevant families.
  "brp-v1-fairway-06": null,
  "brp-v1-fairway-07": null,
  "brp-v1-irons-06": null,
  "brp-v1-mi-golf-05": "HYBRID",
  "brp-v1-mi-golf-06": "IRON",
  "brp-v1-difficult-01": "WEDGE",
};
for (const scenario of bestRoundProScenarios) {
  if (scenario.id in categoryOverrides)
    scenario.expectedProductCategory = categoryOverrides[scenario.id];
}

const providerActExpectations: Record<string, string[]> = {
  "brp-v1-beginner-01": ["FITTING_REQUEST", "PRODUCT_ADVICE"],
  "brp-v1-beginner-04": ["FITTING_REQUEST", "PRODUCT_ADVICE"],
  "brp-v1-beginner-07": ["FITTING_REQUEST", "PRODUCT_ADVICE"],
  "brp-v1-beginner-10": ["FITTING_REQUEST", "PRODUCT_ADVICE"],
  "brp-v1-driver-01": ["FITTING_REQUEST", "PRODUCT_ADVICE"],
  "brp-v1-driver-04": ["FITTING_REQUEST", "PRODUCT_ADVICE"],
  "brp-v1-driver-07": ["ASK_PRODUCT_FIT"],
  "brp-v1-driver-10": ["ASK_PRODUCT_FIT", "PRODUCT_ADVICE"],
  "brp-v1-objections-01": [
    "SALES_OBJECTION",
    "CATALOG_SEARCH",
    "ASK_COMPARISON",
  ],
  "brp-v1-objections-04": ["SALES_OBJECTION", "PRODUCT_ADVICE"],
  "brp-v1-objections-07": ["DECLINE", "SALES_OBJECTION"],
  "brp-v1-objections-10": ["ASK_COMPARISON"],
  "brp-v1-product-context-01": ["ASK_PRODUCT_FIT"],
  "brp-v1-product-context-03": ["ASK_COMPARISON"],
  "brp-v1-product-context-04": ["SALES_OBJECTION", "CATALOG_SEARCH"],
  "brp-v1-product-context-07": ["ASK_PRODUCT_DETAILS", "ASK_PRODUCT_FIT"],
  "brp-v1-difficult-01": ["CHANGE_TOPIC"],
  "brp-v1-difficult-03": ["ANSWER_PENDING_QUESTION"],
  "brp-v1-difficult-04": ["CORRECTION"],
  "brp-v1-difficult-07": ["ASK_COMPARISON"],
  "brp-v1-mi-golf-08": ["FITTING_REQUEST", "PRODUCT_ADVICE"],
};
for (const scenario of bestRoundProScenarios) {
  if (providerActExpectations[scenario.id])
    scenario.expectedDialogueActs = providerActExpectations[scenario.id];
}
const thirdPartyEval = bestRoundProScenarios.find(
  (scenario) => scenario.id === "brp-v1-mi-golf-08",
);
if (thirdPartyEval) thirdPartyEval.providerEval = true;

const multiTurnSequences: Record<string, string[]> = {
  "brp-v1-difficult-02": ["¿Eres diestro o zurdo?", "Sí."],
  "brp-v1-difficult-03": ["¿Cuál es tu mano de juego?", "No sé."],
  "brp-v1-difficult-04": [
    "Antes dijiste diestro.",
    "Corrijo lo que dije antes: soy zurdo.",
  ],
  "brp-v1-difficult-05": [
    "¿Qué tendencia tiene tu tiro?",
    "No sé, tal vez uno que ayude con eso.",
  ],
  "brp-v1-difficult-06": [
    "¿Buscas driver?",
    "Quiero un driver y también saber si hay envío.",
  ],
  "brp-v1-difficult-07": [
    "Revisamos wedges.",
    "Volvamos a comparar el driver anterior.",
  ],
  "brp-v1-difficult-08": ["¿Qué mano juegas?", "Ya te dije que soy diestro."],
  "brp-v1-mi-golf-08": [
    "¿Es para ti?",
    "Estoy comprando un driver para mi hijo, no para mí.",
  ],
};

for (const scenario of bestRoundProScenarios) {
  const sequence = multiTurnSequences[scenario.id];
  if (sequence) scenario.userMessages = sequence;
}
