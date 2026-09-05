# Best Round Pro / Mi Golf architecture

Best Round Pro is the optional customer-facing advisor: it can explain,
compare, handle objections, and help close a sale. Mi Golf is the golfer's
private, user-controlled memory (profile, equipment, objectives, and future
recommendations). Neither replaces the catalog or checkout.

The future Equipment Matching Engine evaluates the actual sellable
configuration/unit. Inventory supplies truth about price, specifications, and
availability. A Commercial Ranker may order technically suitable candidates;
it never changes technical Match.

Every future recommendation keeps four independent concepts:

- Equipment Match: technical compatibility, `MATCH` or `INCOMPATIBLE`, 0–100.
- Confidence: certainty from known golfer/product evidence (`HIGH`, `MEDIUM`, `LOW`).
- Personal Fit: explicit preferences such as brand, style, or familiarity.
- Commercial Fit: price, budget, condition, value, and availability.

Margin, acquisition cost, partner economics, and internal reserves are never
inputs to Equipment Match and are never exposed to a customer advisor model.
LLM output, when introduced, must be a structured validated action request;
models never write directly to Supabase or change prices, inventory, payment, or
ownership.

Mi Golf memory policy is explicit: user-declared durable facts may be saved;
inferences require confirmation; temporary buying context remains session-only;
unsupported chatter is not saved. Purchase history never implies current
equipment ownership. User corrections and removals win over inferred data.

The PR75 contracts in `src/lib/mi-golf/domain.ts` are intentionally provider
agnostic and ready for PR76 matching without adding a chatbot or ranking logic.
