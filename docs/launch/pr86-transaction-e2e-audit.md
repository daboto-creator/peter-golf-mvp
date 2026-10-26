# PR86 — Transaction E2E Launch Audit

**Audit base:** `eabe474c7a85e7b8af4b66f0f7c86ae676a045b6`  
**Scope:** read-only discovery of First Party and Partner purchase, payment, fulfillment, delivery, claims, ledger, and payout. No business behavior, schema, or transaction data was changed. Swing AI/video work is out of scope.

## A. Executive summary

The repository has a substantial transaction foundation: authenticated carts, database checkout RPCs, Stripe Checkout in test mode, signed webhooks, payment and order histories, Marketplace stock reservation, seller-separated fulfillments, delivery acceptance, claims, ledger, payout records, and Operations/Partner/Buyer screens. These components are **not collectively proven by a real Stripe test transaction through delivery and payout**.

**Launch decision: NOT READY — FIXABLE BLOCKERS.** The main absolute blocker is First Party stock concurrency: checkout locks and checks inventory but never reserves it. Two different checkout requests can both create payable orders for the last unit. Operations later decrements stock while confirming an order, so the second paid order can fail after the customer has paid. Marketplace checkout reserves both First Party and Partner stock before payment in one transaction and uses deterministic lock ordering.

Other pilot blockers include no automated expiry worker for generic inventory reservations, Partner stock confirmation/reminder/cancellation policy not demonstrated end to end, no First Party delivery acceptance/claim path matching the stated policy, uncertain staging Stripe endpoint/configuration and no safe authenticated test account in this audit, and unproven customer/Operations completion of refunds and manual payouts. These are distinguished in the gap matrix; manual shipping labels, claim review, and weekly bank payout can be viable pilot operations once the transaction/inventory blockers are addressed.

## B. Evidence and method

Evidence levels mean:

- **E2E-PROVEN:** actual integrated transaction tested through the relevant action.
- **CODE+DB-PROVEN:** code and applied staging schema/configuration prove the mechanism, but not full browser/provider behavior.
- **CODE-PROVEN:** source and automated tests prove behavior.
- **PARTIAL:** useful pieces exist, with a missing or unverified link.
- **MISSING:** no implementation found in the audited paths.
- **BLOCKED-BY-ENVIRONMENT:** could not safely verify runtime/provider/account conditions.

Inspected the repository at the specified main SHA, transaction migrations and routes/actions, staging schema/migration history, selected non-PII staging aggregates, cron configuration, Vercel staging project environment-variable *names only*, and staging health endpoints. Did not create orders, call Stripe, modify staging data, or access production. No authenticated staging buyer account or disposable test inventory fixture was available for a safe transaction. Thus transaction scenarios below are not labeled E2E-PROVEN.

Staging reports `stripe_checkout_test_mode_enabled() = true` and Marketplace enabled. Applied migrations include the Stripe, Marketplace checkout, claims, payout, and PR84 migration `20261026165356 final_bulk_import_platform_hardening`. Staging has one active shipping method `envio_nacional_temporal`, MXN, base price 14,900 minor units (MXN 149.00). Active/published First Party variants inspected had null variant prices (5); no divergent override was found, so current data uses `products.price` via `coalesce(variant.price, product.price)`. The stable staging deployment (`dpl_GbzH7hd1RSWMrCgnS6s72Nhmota5`) returned root HTTP 200 and `/api/health/supabase` HTTP 200 with `status=available`, `environment=staging`. The PR preview (`dpl_7mx1sy2489HqDFJahNhJVpeiibYy`) also passed Vercel and both smoke endpoints. Vercel environment listing returned names for Stripe/Supabase/payment variables in the staging project's Production target, but values and webhook endpoint configuration were not read or proven. Values were not displayed or recorded.

## C. Architecture map

| Stage | Main UI / code | Database boundary / persisted records |
|---|---|---|
| Catalog and product detail | `src/app/productos/**`, product detail/cart controls | `products`, `product_variants`, `inventory`; public catalog read policies |
| Cart | `/carrito`, `src/lib/cart/cart-actions.ts`, `src/lib/cart/customer-cart.ts` | `carts`, `cart_items`; `add_customer_cart_item`, `add_marketplace_cart_item`, change/refresh RPCs |
| Checkout | `/checkout`, `src/components/cart/checkout-form.tsx`, `checkoutAction` | First Party `create_customer_checkout_order`; mixed/Partner `create_marketplace_checkout_order`; `orders`, `order_items`, `order_payments`, idempotency keys |
| Stripe | `src/lib/payments/stripe-actions.ts`, `src/lib/stripe/server.ts` | Stripe Checkout Session; `stripe_checkout_sessions`, test-only gates; persisted amount comes from `order_payments.expected_amount` |
| Webhook | `/api/webhooks/stripe`, `src/lib/stripe/webhook-processing.ts`, `webhook-rpc.ts` | signature verification then `process_stripe_webhook_event`; unique Stripe event, session/payment state, histories and refund records |
| Operations orders | `/operacion/pedidos`, `/operacion/pedidos/[id]`, `src/lib/orders/order-actions.ts` | order/payment transitions, confirmations, inventory movement and histories |
| Marketplace fulfillment | `/operacion/marketplace/ordenes`, `/partner/ventas`, `src/lib/marketplace/fulfillment-actions.ts` | `order_fulfillments`, `marketplace_fulfillment_status_history`, fulfillment idempotency, reservation commit/release |
| Buyer order | `/cuenta/pedidos`, `/cuenta/pedidos/[id]`, `/pedido-confirmado/[id]` | customer-owned order read RPCs; fulfillment summary; Marketplace acceptance/claim actions |
| Claims | `/operacion/marketplace/reclamos`, Buyer order detail, claim actions/data | `marketplace_claims`, evidence, events, resolutions, returns, payable/payout holds |
| Ledger/payout | `/operacion/marketplace/pagos`, `/operacion/marketplace/payouts`, `/partner/pagos` | Marketplace payables and immutable integer-cent ledger entries; payout batch/items/holds/events/settlements/job runs |
| Stripe endpoint | `src/app/api/webhooks/stripe/route.ts` | requires test mode and signing secret; validates signature from raw body; rejected transient database outcomes return 500 for Stripe retry |

Key migration map: `20260801000000_order_management_foundation.sql` (orders and order idempotency); `20260803000000_order_payments_foundation.sql` (payment records and checkout); `20260804000100_stripe_test_checkout_foundation.sql`, `20260806000000_stripe_abandoned_checkout_recovery.sql`, `20260806000100_stripe_webhook_rejection_audit.sql`; `20260817000100_guard_stripe_operational_confirmation.sql`, `20260817000200_allow_stripe_checkout_before_confirmation.sql`; `20260829000000_marketplace_checkout_orders_fulfillment.sql`; `20260830000000_marketplace_partner_ledger_payables.sql`; `20260831000000_marketplace_delivery_claims_returns.sql`; `20260901000000_marketplace_partner_payouts_settlement.sql`; `20260903000000_marketplace_workflow_simplification.sql`.

## D. First Party transaction map

1. Buyer adds a product/variant through `addToCartAction` → `add_customer_cart_item`.
2. Checkout validates address, cart version, listed/active product and variant, price and stock; `create_customer_checkout_order` creates a Best Round order and immutable item price snapshot. Current amount source is `coalesce(product_variants.price, products.price)`; `product_variants.price` is null in the sampled active staging rows, so current staging follows `products.price`.
3. First Party checkout takes an inventory row lock and checks `quantity_on_hand - quantity_reserved`, but does **not** increment `quantity_reserved` or create an `inventory_reservations` row.
4. Payment row is created. For card, server creates a Stripe Checkout Session from persisted expected amount and currency; buyer payment remains pending until webhook.
5. Signed webhook updates payment state. Operations confirms the paid order; `confirm_operational_order` locks and decrements inventory and records a sale movement.
6. Operations order UI manages order/payment status. Generic order fulfillment/shipping fields exist, but the Marketplace fulfillment and acceptance workflow is explicitly source `PARTNER` in key delivery functions.

**Concurrency conclusion:** lock/check alone only serializes checkout transactions. Since neither transaction reserves stock, after the first transaction commits, the next checkout sees the same available quantity. Later confirmation prevents negative stock, but it can do so after both customers have been charged. A database constraint may prevent negative stock; it does not make checkout acquisition exclusive. **P0.**

First Party has no Partner payable creation on its normal payment path; partner ledger/payables are tied to Marketplace item snapshots. This was inspected in code and staging schema; no First Party order was created for this audit.

## E. Partner / Marketplace transaction map

1. Buyer adds an approved listing and its current approved pricing quote to the cart.
2. `create_marketplace_checkout_order` checks the cart version, quote/listing version and expiry, verified Partner eligibility, and current stock. It validates each line and obtains locks in deterministic source/product order.
3. Within the same transaction it creates one Best Round customer order, order items, per-source/per-Partner fulfillments, Marketplace item economics snapshots, and active inventory reservations. Marketplace inventory is atomically reserved before checkout completes; payment row uses the requested method/provider and expected total from current quote plus shipping.
4. Paid event commits reservations (decrements on-hand and clears reserved). Failed/refunded payment releases active reservations; expired Stripe sessions release reservations. A general `release_expired_marketplace_reservations` RPC exists, but staging cron inventory shows no scheduled expiry worker for it.
5. Partner fulfillment transitions require ownership derived from authenticated Partner profile and use a version/idempotency key. Fulfillment is grouped by partner and fulfillment mode; customer order/payment remain one shared order.
6. Snapshot stores listing, Partner, quote, commission/tax/processing/admin/minimum revenue inputs and Partner net. Checkout uses an approved quote/snapshot; it does not invoke AI for money. It validates quote version and uses persisted integer-minor-unit values.

**Multi-seller support:** the SQL model supports one customer order/payment with multiple Partner fulfillments and First Party `BEST_ROUND` fulfillment(s), including mixed baskets. This is **CODE+DB-PROVEN, not E2E-PROVEN**. Buyer cart UI/checkout route exposes a single checkout. Partner rows are separated by seller; order item snapshots and `partner_id` bind Partner attribution. Stripe money does not split into multiple buyer charges.

**Data coherence observation:** Marketplace checkout inserts `orders.payment_method='bank_transfer'` and `payment_status='transfer_pending'` literals while separately creating `order_payments.method/provider` from the requested card/bank-transfer choice. Stripe gating and webhook read `order_payments`, but the legacy order-level method/status can contradict the payment record for card. This should be reconciled and tested before treating order/payment presentation or reports as authoritative. **P1.**

## F. Stripe and payment state

Stripe Checkout Session (not a direct PaymentIntent integration) is created in `src/lib/payments/stripe-actions.ts`; card path is test-only (`PAYMENTS_MODE=test`, `STRIPE_CHECKOUT_MODE=test`, DB gate, and `session.livemode=false`). Session line amount is server-prepared `expected_amount` in minor units, not client-provided. Checkout and session creation use DB idempotency records and Stripe idempotency key `pg_checkout_<attempt>`; order amount comes from the server checkout RPC.

Webhook endpoint verifies Stripe signature with raw body, rejects live-mode events, normalizes supported events, and calls a restricted service-role RPC. Supported types include `checkout.session.completed`, `checkout.session.expired`, `payment_intent.payment_failed`, and refund created/updated/failed. Unique Stripe event IDs and DB state checks protect duplicate deliveries; transient RPC/DB failures return 500 for retry, permanent rejection is acknowledged and logged. This is **CODE-PROVEN**, duplicate provider delivery is not E2E-PROVEN in staging.

Observed relevant enums: order `created`, `pending_confirmation`, `simulated_payment_approved`, `preparing`, `ready_to_ship`, `shipped`, `delivered`, `cancelled`, `returned`; payment `pending`, `submitted`, `under_review`, `paid`, `rejected`, `refunded`, `failed`, `partially_refunded`; Stripe session `creating`, `open`, `payment_failed`, `completed`, `expired` (and `abandoned` in recovery migration). Invalid transitions are guarded by RPC checks/triggers; all transition permutations have not been integration tested.

Stripe test checkout DB gate is enabled on staging. Vercel project metadata includes Stripe secret, webhook secret, checkout mode, payment mode, Supabase URL/key names, and app URL names without exposing values. Exact deployed staging target values, key mode, Stripe dashboard webhook delivery configuration, webhook reachability and end-to-end test account are **BLOCKED-BY-ENVIRONMENT / NOT-PROVEN**. No Stripe test charge was made.

## G. Inventory, reservation, expiration

| Domain | Checkout protection | Payment effect | Abandon/failure |
|---|---|---|---|
| First Party only | `FOR UPDATE` + availability check; **no reservation** | Operational confirmation decrements on-hand | No pre-payment stock reservation to release; concurrent paid orders may exceed stock |
| Partner or mixed cart | Deterministic lock order, availability checks, reservation rows and reserved quantity in same RPC transaction | Paid state commits each reservation to on-hand; idempotent reservation movement | Stripe expired session and failed/rejected/refunded payment release; explicit expired reservation RPC also exists |

Reservation timeout comes from operational rule (default 30 minutes, configured 5–1440). Staging cron lists active Marketplace delivery autoaccept and weekly payout jobs, but not reservation expiry cleanup. A caller can expire a Stripe checkout and its attached reservation, but an order with no session/abandoned initiation can retain a reservation absent an explicit cleanup invocation. This is P1 capacity/recovery risk, not an oversell path.

## H. Fulfillment, shipping and delivery

`order_fulfillments` stores source, seller, fulfillment mode/custody, statuses, confirm/handoff deadlines, carrier, tracking, label status, shipped/delivered/acceptance timestamps, cancellation and hold reasons. Marketplace has explicit Partner actions/status history and Operations orchestration. The seller confirms/updates own fulfillment through authenticated profile ownership. One fulfillment per Partner grouping (and a Best Round group for First Party) supports a mixed order.

No carrier/label provider integration was found; manual label generation and tracking entry are appropriate pilot operations. Staging has a positive active shipping method (`envio_nacional_temporal`, MXN 149.00), and checkout order total includes the selected shipping method price. Shipping is not assumed zero in the inspected staging config. There is one fixed national method, not carrier/rate/zone calculation or per-fulfillment charge allocation. Operations needs to reconcile a single customer-paid shipping amount to actual packages/sellers manually. Buyer order detail exposes fulfillment status/tracking fields where present.

Marketplace delivery action records delivered timestamp and creates acceptance window; buyer can accept or report a problem. Acceptance deadline is config-backed; staging cron is active hourly and accepts eligible pending acceptance rows with skip-locked/advisory lock and deterministic idempotency. The DB window is configured from operational rules; the audit did not read its exact current hours, so **48-hour policy match remains unverified**. Acceptance triggers ledger availability after the eligible hold lifecycle. Staging acceptance table had zero rows, so no persisted E2E sample exists.

The audited delivery/acceptance/claim functions filter `source='PARTNER'`. First Party shipments do not share this 48-hour acceptance and Marketplace claim policy. First Party completion/claim/refund SOP and UI path require separate confirmation before pilot. **P1.**

## I. Claims, ledger and payout

Marketplace claim domain includes buyer claim creation, evidence, claim status/event history, Partner response, Operations resolution, return requirement/events, adjustment/refund state, and claim-linked payable hold. States include open/review/evidence/partner response/return/resolve/cancel. This is substantial implementation; actual claims UX, correct claim SLA and refund/return actions were not exercised. Used-product remorse policy is not implemented as a generic return entitlement in these findings; operation must enforce eligible reasons.

Marketplace ledger uses integer cents and immutable `marketplace_partner_ledger_entries` with pending/on-hold/available/paid/reversed deltas, order/item/fulfillment/partner/payable references, reason, actor/source, idempotency key, and metadata. `marketplace_partner_payables` bind order item, Partner, payment and pricing quote. Ledger amounts derive from reviewed Marketplace snapshot fields (public gross, commission, commission VAT, processing shares, admin fees, Partner net and Best Round revenue). Reconciliation/history is present in schema. First Party payment path does not create Partner payable/ledger settlement.

Manual weekly payout is supported in code: Operations creates batches/payouts/items, checks available eligible balance and holds, marks ready/awaiting confirmation, records manual bank transfer settlement, and can cancel/fail/reconcile with events and ledger deltas. Cron is active Mondays at 06:00 UTC for payout job preparation, not autonomous bank movement. Payout RPCs check `can_manage_marketplace_payouts()` and Partner read paths scope to own profile. No payable/payout rows existed on staging and safe payout execution was not attempted; end-to-end reconciliation and post-payment reversal remain unproven. Manual payout is acceptable for a small pilot after one controlled dry run with a separate fixture.

## J. Refunds and cancellation

Stripe webhook handles refund events, records refund IDs/status and updates payment refunded amount/status; payment UI/action has an Operations refund path. Reservation sync releases an active Marketplace reservation when payment becomes failed/rejected/refunded. Ledger/claim return/reversal primitives exist for Marketplace. Refund after a Partner payable is paid requires reversal/reconciliation/hold handling, but is not proven as a complete integrated Stripe→ledger→payout recovery. First Party inventory return and accounting/reporting after refund also need explicit SOP proof. Cancellation RPCs and status fields exist, but cancellation at each point (pre-payment, after paid/pre-ship, Partner stock rejection, shipped) needs an end-to-end matrix, especially ensuring paid cancellation calls refund and safe inventory restoration exactly once.

## K. Security, authorization and observability

- Cart/order mutations are server actions/RPCs; checkout derives user from `auth.uid()`, locks the owned cart and address, derives price/Partner identity from catalog/listing records, and snapshots buyer/order values.
- Marketplace checkout requires verified Partner, rejects self-purchase and critical risk flags; CSV/client values cannot select seller economics.
- Partner fulfillment uses own Partner profile checks. Payout/claim/order actions use named authorization functions and explicit RPC grants; reviewed functions use `SECURITY DEFINER SET search_path=''` where applicable.
- Stripe verifies webhook signature, denies live-mode event and service-role processing is confined to the route/RPC wrapper. Client does not select authoritative Stripe amount or order/payment state.
- Money computation is deterministic integer minor units / quote snapshots; no AI-generated amount becomes the checkout charge.
- Order, payment, Stripe event, fulfillment, claim, ledger, payout event/job histories provide useful traces. Stripe logs are structured but intentionally redact IDs/URLs. Alerting/dead-letter visibility and a unified order timeline spanning support, provider, fulfillment and payout were not demonstrated. Rejected permanent webhook events are recorded, but require Operations to inspect the Stripe event view/logs.
- Staging schema isolation and RPC security were inspected from migrations; role-level adversarial RLS test and deployment-secret target verification were not performed.

## L. Launch gap matrix (ordered by severity)

| ID | Domain | Capability | Current state | Evidence level | Gap | Severity | Manual workaround possible? | Recommended fix | Recommended PR |
|---|---|---|---|---|---|---|---|---|
| P0-1 | First Party | Last-unit concurrent checkout | Checkout locks/checks stock but creates no reservation; decrement occurs at Operations confirmation | CODE+DB-PROVEN | Two orders can reach payment for one unit; later confirmation fails after payment | P0 | No safe manual database reservation for each order | Add atomic reservation/release/commit parity for First Party-only checkout; prove two competing sessions | PR87 |
| P0-2 | Both | Real staging Stripe TEST end-to-end | DB test gates true; project has relevant variable names | PARTIAL / BLOCKED-BY-ENVIRONMENT | Effective deployment config, webhook registration/reachability, buyer test account and complete integrated event not verified | P0 | No; cannot accept live money without a controlled successful/failed test | Build isolated staging fixture and verify card success/failure/expiry/duplicate delivery before pilot | PR88 |
| P1-1 | Both | Reservation cleanup | Marketplace release RPC and Stripe expiry hooks exist; no reservation cleanup cron in staging | CODE+DB-PROVEN | Abandoned/non-Stripe order may keep stock reserved until manual expiry call | P1 | Yes at low volume via authorized Operations flow if exposed; direct SQL is unacceptable | Add monitored idempotent expiry worker or a surfaced Operations action | PR89 |
| P1-2 | Partner | Confirm stock SLA | status and `inventory_confirmation_due_at` exist; Partner fulfillment UI/actions exist | PARTIAL | No reminder/escalation/cancellation/release path was proven for Partner declining/unavailable stock | P1 | Yes with daily Operations review and documented buyer refund workflow | Prove/complete stock refusal path, stock release, refund and buyer notice; add reminder if needed | PR89 |
| P1-3 | First Party | Delivery acceptance and claims | generic shipment fields/order screens exist; delivery/acceptance/claims are Marketplace Partner-only | PARTIAL | No First Party 48-hour accept/problem/claim policy path proven | P1 | Yes with support SOP only if policy and records are explicit; no SQL | Decide whether FP needs same acceptance rules; implement minimal tracked support flow | PR90 |
| P1-4 | Marketplace | order/payment method coherence | Marketplace order stores bank-transfer literals while payment row stores requested card/method | CODE-PROVEN | Legacy order summary/report can contradict authoritative payment record | P1 | Operations can inspect payment row, but this is error-prone | Persist matching order method/status and regression test card/bank transfer mixed cart | PR87 |
| P1-5 | Both | Refund/cancel recovery | Stripe refund, Marketplace reversal and cancel primitives exist | PARTIAL | Full refund, partial refund, stock return, pre/post-payout ledger effect not integrated-proven | P1 | Manual refund may work, but payout already paid needs controlled reconciliation | Test complete refund/cancel matrix with isolated test orders; publish SOP and fix failures | PR88/90 |
| P1-6 | Marketplace | 48-hour acceptance policy | Config-backed deadline and active hourly idempotent job | CODE+DB-PROVEN | Actual staging rule value not verified against 48-hour business policy | P1 | Yes if Operations tracks due timestamps | Verify config equals 48 hours and test due/non-due/replay cases | PR88 |
| P1-7 | Both | Multi-seller lifecycle | One customer order/payment plus item and seller fulfillments supported | CODE+DB-PROVEN | No integrated mixed/multi-Partner test through shipping, refund and settlement | P1 | Not reliably at scale | Add deterministic isolated integration tests and one browser test | PR88 |
| P2-1 | Shipping | Manual label/tracking operations | fields and status actions exist; no provider integration | PARTIAL | No demonstrated complete staff workflow for generating label and entering tracking per seller | P2 | Yes, low-volume | Document/validate exact Operations handoff; no carrier API required | PR89 |
| P2-2 | Buyer | Order communications | order pages and notification foundation exist | PARTIAL | Notification delivery and stock/shipped/delivered/claim/refund templates not verified | P2 | Yes via support/manual email for pilot | Verify minimal transactional notices and operational owner | PR90 |
| P2-3 | Operations | Unified support audit | Separate order/payment/fulfillment/claim/ledger/payout screens and histories | PARTIAL | Support must navigate several surfaces; no unified complete audit timeline proven | P2 | Yes for low volume | Add cross-link/timeline and run operator usability drill | PR90 |
| P2-4 | Marketplace | Partner payout dry run | weekly job and manual settlement records/RPCs present | CODE+DB-PROVEN | No sample payable/batch/transfer reconciled in safe test fixture | P2 | Yes after approved dry run | Validate eligible balance, holds, exact cents, receipt, double-submit, reversal | PR90 |
| P3-1 | Shipping | Carrier rate/label API | no integration found | MISSING | Manual labels and tracking only | P3 | Yes | Defer until volume needs it | Later |
| P3-2 | Marketplace | Stripe Connect / automatic payouts | manual bank payout model | MISSING by decision | No automated transfers | P3 | Yes; matches MVP decision | Keep manual weekly payout for pilot | Later |
| P3-3 | Platform | Swing AI/video integration | out of scope | MISSING by design | No dependency | P3 | N/A | No launch dependency | Later |

## M. Required scenario results

### First Party

| ID | Current support / evidence | Gap and severity |
|---|---|---|
| FP-01 successful checkout | CODE+DB-PROVEN; route and checkout RPC create order/items/payment with server price | No staging Stripe E2E; P0-2 |
| FP-02 payment failure | CODE-PROVEN webhook maps failed intent and payment state | Integrated buyer/order recovery not E2E; P1-5 |
| FP-03 duplicate webhook | CODE-PROVEN unique event processing and replay state | Not provider-replay E2E; P0-2 |
| FP-04 stock=1 concurrent buyers | CODE+DB-PROVEN no reservation in FP-only RPC; confirmation lock/decrement later | Paid oversell possible; P0-1 |
| FP-05 abandoned/expired checkout | Stripe session expiration modeled; FP has no reservation to release | Abandoned order cleanup/operator visibility not proven; P1-1 |
| FP-06 cancel before shipping | order cancellation/status primitives present | Paid refund and stock restoration matrix not E2E; P1-5 |
| FP-07 shipping added | fixed positive shipping method applied to order total | staging observed MXN 149; per-carrier/per-package allocation manual; P2-1 |
| FP-08 mark shipped | order screens and shipping status fields exist | Full operator path not E2E; P2-1 |
| FP-09 mark delivered | generic order states exist; Marketplace delivery recorder only Partner source | First Party delivered timestamp path unproven; P1-3 |
| FP-10 buyer acceptance | Marketplace Buyer flow is Partner-only | no FP accept/autoaccept; P1-3 |
| FP-11 claim | Marketplace claims exist | no equivalent FP claim flow/policy proven; P1-3 |
| FP-12 refund | Stripe refund and payment status support exist | inventory/accounting/reporting end-to-end unproven; P1-5 |

### Partner / Marketplace

| ID | Current support / evidence | Gap and severity |
|---|---|---|
| MP-01 successful checkout | CODE+DB-PROVEN quote validation, order/payment/snapshot; no real test txn | P0-2 |
| MP-02 inventory reservation | CODE+DB-PROVEN atomic reservation rows in checkout transaction | Concurrent DB/browser proof absent; P0-2 |
| MP-03 Partner cannot confirm stock | confirmation due/status and refusal/cancel primitives partly present | refund, release, notice/SLA flow not proven; P1-2 |
| MP-04 duplicate webhook | CODE-PROVEN unique Stripe event and state guards | no provider replay test; P0-2 |
| MP-05 stock=1 concurrent buyers | CODE+DB-PROVEN lock and reserved quantity | test exact concurrent execution; P0-2 |
| MP-06 Partner fulfillment creation | checkout creates per-Partner fulfillment with deadline | CODE+DB-PROVEN, no browser E2E; P1-7 |
| MP-07 shipping/tracking | carrier/tracking fields and Partner/Operations transitions | manual workflow not drilled; P2-1 |
| MP-08 delivery | Partner delivery recorder and states exist | no persisted staging sample; P1-7 |
| MP-09 buyer accepts | Buyer accept/problem action exists | no staging action E2E; P1-7 |
| MP-10 48h autoaccept | active hourly cron, deadline selector and idempotency key | actual config value and outcome not proven; P1-6 |
| MP-11 claim creates hold | claim domain and payable hold linkage exist | no scenario proof; P1-5 |
| MP-12 claim resolution | Operations resolution/return/refund and ledger primitives | no integrated proof; P1-5 |
| MP-13 ledger AVAILABLE | acceptance and claim-hold ledger transitions exist, integer cents | no real order ledger reconciliation; P1-7 |
| MP-14 weekly payout | active Monday job and manual bank transfer settlement path | no safe payout dry run; P2-4 |
| MP-15 payout reversal/hold | hold, cancel/fail/reconciliation records exist | post-settlement handling needs transaction proof; P1-5 |
| MP-16 refund before payout | Stripe refunds + payable/ledger reversal primitives | end-to-end linkage unproven; P1-5 |
| MP-17 refund after payout | reversal/reconciliation primitives exist | no complete recovery proof; P1-5 |
| MP-18 multi-Partner order | data model/RPC groups fulfillment by partner | no test through all seller lifecycles; P1-7 |
| MP-19 FP+Partner mixed order | mixed RPC and item-source branches support it | no test through charge and separate fulfillment; P1-7 |

## N. Operations, Partner and Buyer surfaces

- **Operations:** order list/detail and payment review; Marketplace order/fulfillment, payment/ledger, claims, payout batch screens exist. Operator can inspect core states and histories. Tracking entry, cancel/refund, seller stock failure, and complete audit cross-navigation were not exercised. No normal flow should require SQL, but an accessible Reservation expiry operator action was not found.
- **Partner:** `/partner/ventas` and detail plus `/partner/pagos` routes exist; fulfillment actions/data are scoped by the signed-in Partner. Exact partner view of required handoff/tracking and expected net/payout in the full order path is **PARTIAL** until an authenticated drill.
- **Buyer:** catalog/cart/checkout, payment success/cancel pages, order list/detail, fulfillment status/tracking display, Marketplace acceptance/problem and claim controls exist. No E2E tested; First Party acceptance/claim is missing from the audited Marketplace-only workflow.
- **Email:** order-notification foundation exists, but staging sender/provider values and delivery of required lifecycle notices were not verified. Manual support notices are acceptable for a controlled pilot if the owner and scripts are defined.

## O. Data invariants and launch controls

| Invariant | Audit finding |
|---|---|
| One Stripe event creates one payment effect | unique event IDs, event-state guards, and payment/session row locks in code; E2E not proven |
| Same checkout submission is safe | order idempotency key binds actor, operation, payload hash and order; Marketplace also locks cart/version; code-proven |
| Order item seller/domain correct | explicit `item_source`, item fulfillment link, Marketplace snapshot partner/listing references; code-proven |
| Partner identity is server-owned | listing owner and verified `partner_profiles` read server-side; buyer cannot submit authoritative `partner_id` |
| First Party has no Partner payout | Partner payables originate from Marketplace snapshot/fulfillment path; no First Party payable path found |
| Fulfillment group correct | source and Partner ID/mode grouping in checkout; code-proven |
| Ledger/payout/claim links correct | foreign keys and order/item/fulfillment/Partner/payable references in staging schema; no transaction fixture to verify end-to-end |
| Inventory movement tied to order | explicit order item/order reference and idempotency key; FP checkout concurrency gap remains |
| Money deterministic | quote/snapshot and integer minor units; no AI/client amount authority found |
| Imported PR84 QA data | untouched; no PR84 job rows were read or mutated for this audit |
| Production | untouched; only staging schema/config metadata and source files inspected |

## P. Cron and environment audit

Staging `cron.job` reports active: Marketplace delivery autoaccept hourly (`0 * * * *`), weekly payout preparation (`0 6 * * 1`), daily Partner score tiers. No transaction reservation cleanup job found. Cron functions use internal idempotency/advisory locks; recent job success/failure telemetry was not queried, so deployed activity/health is **PARTIAL**.

| Setting / integration | Staging evidence | Result |
|---|---|---|
| Supabase URL and client keys | Vercel project env names present; project linked to staging DB | PRESENT (values not read) |
| Stripe secret / webhook secret | Vercel project env names present for staging Production target; DB `stripe_checkout_test_mode_enabled()` true | PRESENT by name; whether key prefixes are test-only and webhook registration/reachability UNKNOWN |
| Payment mode / Stripe checkout mode | variable names present for staging Production target; DB Stripe test gate true | DB gate PRESENT; effective `PAYMENTS_MODE=test` and `STRIPE_CHECKOUT_MODE=test` UNKNOWN because values are masked |
| App URL | Vercel variable name present | PRESENT by name; exact target URL not recorded |
| Email sender/provider | no required transaction email provider verified in env inventory | UNKNOWN; notifications can be manual for pilot |
| Cron secret/auth | SQL scheduled functions present; delivery/payout cron active | DB cron PRESENT; external cron secret not applicable to these in-DB jobs |
| Shipping provider | none found or required for manual-label approach | MISSING by design |

## Q. Domain separation matrix

| Rule / engine | First Party | Partner / Marketplace |
|---|---|---|
| Product amount authority | `products.price` (variant override currently null) | approved quote + listing version snapshot |
| Acquisition cost | APPLIES only to internal product margin | DOES NOT APPLY |
| Financial floor | APPLIES to internal pricing | DOES NOT APPLY |
| Partner desired net / tier commission | DOES NOT APPLY | APPLIES via approved economics snapshot |
| Commission VAT / processing split / admin fee / minimum Marketplace revenue | DOES NOT APPLY | APPLIES via Marketplace quote/snapshot |
| Buyer checkout charge | one server-calculated order amount | one server-calculated order amount |
| Inventory | database check/decrement; reservation missing in FP-only flow | atomic reservation and payment commit/release |
| Manual model/catalog | catalog resolution and manual model rules | listing/quote snapshot references |
| Fulfillment ownership | Best Round | Partner-owned item group under Best Round order |
| Delivery acceptance / claims | no shared workflow proven | implemented Partner Marketplace workflow |
| Partner payable/ledger/payout | DOES NOT APPLY | applies to eligible Partner items |

## R. Recommended shortest PR path to pilot

1. **PR87 — First Party stock reservation and order/payment coherence.** Reserve inventory atomically in First Party-only checkout, ensure payment failure/expiry/cancel release and paid confirmation commit are idempotent, reconcile `orders.payment_method/payment_status` with `order_payments`, and add the stock=1 two-checkout regression.
2. **PR88 — Controlled staging Stripe E2E.** Add disposable buyer/cart/inventory fixtures and prove First Party, Partner, mixed order success; payment failure; expired session; duplicate webhook; refund; webhook retry; and multi-seller effects. Verify deployed staging values and webhook signature endpoint without touching live Stripe or production.
3. **PR89 — Pilot operations for reservations and Partner stock exceptions.** Provide expiry processing/visibility, Partner refusal/unavailable stock cancellation/refund/release/notification procedure, and operator manual-label/tracking drill. No carrier API needed.
4. **PR90 — Delivery/claim/refund/payout closure.** Decide First Party delivery/claim treatment, verify Marketplace acceptance is exactly 48 hours, exercise claim hold and resolution, full/partial refund before and after payout, and reconcile one manual weekly payout with exact cents. Finish buyer/Partner/Operations SOP and notification checks.

PR ordering may change if PR88 test evidence demonstrates existing flows already satisfy later items; do not start implementation as part of PR86.

## S. Pilot go/no-go checklist

### Before pilot customers

- [ ] First Party last-unit concurrent checkout can produce at most one payable order.
- [ ] First Party Stripe TEST success/failure/expiry plus duplicate webhook is proven in staging.
- [ ] Partner Stripe TEST success, reservation, release, duplicate webhook and seller attribution are proven.
- [ ] Mixed First Party + Partner and multiple Partner checkout charge once and create correct separated fulfillments.
- [ ] Shipping is an explicit positive price and Operations can create labels/enter tracking per fulfillment.
- [ ] Partner stock refusal releases/resolves stock and refunds/notifies buyer.
- [ ] Delivery records, buyer accept/problem, exact 48-hour autoaccept, and ledger availability are proven.
- [ ] Claims place hold and resolution/refund/return paths reconcile the payable.
- [ ] One manual payout dry run validates available balance, holds, exact cents, audit record and no duplicate settlement.
- [ ] Operations and Partner complete a transaction drill without SQL; buyer can see order/payment/tracking/claim status.
- [ ] Staging effective Stripe TEST variables, webhook endpoint/signature and cron health verified.

### Before broader public launch

- [ ] Production Stripe LIVE setup and webhook endpoint are separately reviewed and tested with approved launch process.
- [ ] Customer notifications, refund/chargeback procedures, operational monitoring and alert ownership are staffed.
- [ ] Shipping pricing/package allocation and payout reconciliation scale beyond manual pilot volume.
- [ ] Load/concurrency and security/RLS negative tests cover transaction RPCs.

**Pilot go/no-go: NO-GO now**, principally because of P0-1 and P0-2. After P0 fixes/proofs, the remaining manual processes are viable for a small pilot if owners and SOPs are assigned.

## T. Tests and scope

This PR adds this discovery document only. No migration, runtime code, transaction fixture, test helper, or test was added. Existing repository test/typecheck/lint/build gates are run for PR86 in CI/local verification; results are reported with the PR status. PR86 does not implement PR87 or any launch fix.
