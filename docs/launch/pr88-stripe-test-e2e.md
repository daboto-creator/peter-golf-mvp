# PR88 — Controlled Stripe TEST E2E evidence

Date: 2026-10-28
Repository base: `7becb59191f3a2cb8e5776c030c9093f3c77bfa9`  
Environment: `peter-golf-staging` (`xdulakstgsgdujjylhox`)  
Scope: staging Stripe TEST only; disposable `QA-PR88-STRIPE-*` First Party fixtures. PR84 QA jobs and production were not touched.

## Executive status

**Classification: NOT READY — FIXABLE BLOCKERS.** First Party Stripe TEST checkout, signed webhook processing, payment, inventory commit, duplicate-event replay, provider expiry, decline, and full refund were exercised through the staging application and Stripe TEST provider. The tests exposed a P0 payment/reservation race: a declined card releases the First Party reservation while the hosted Stripe Checkout form still permits a card retry. The test session was allowed to expire before any retry succeeded. Partner and mixed-cart provider transactions were not run, so they remain unproven.

No runtime code or schema was changed. The only repository change in this corrective is this evidence document. No Stripe LIVE credentials, real card, commercial order, payout, shipping label, or production system was used.

## Provider and environment verification

- Stripe CLI version `1.45.1`; selected profile was **Peter Golf Pro Shop sandbox**. CLI event reads and created events were in TEST mode; all matched event/session records reported `livemode=false`.
- Staging DB gates `payments_test_mode_enabled()` and `stripe_checkout_test_mode_enabled()` returned `true`.
- Vercel project is `peter-golf-staging`. Vercel variable names are present, but secret values are withheld by Vercel and were not printed. Deployed runtime accepted a valid provider signature, and the existing staging runtime guard requires `PAYMENTS_MODE=test`, `STRIPE_CHECKOUT_MODE=test`, a `sk_test_` secret, and a configured webhook secret. No secret value was exposed.
- Stripe TEST webhook endpoint `we_1U0wrBDLG0ay9qywjKiw7Bij` is enabled, `livemode=false`, and points to `https://peter-golf-staging.vercel.app/api/webhooks/stripe`.
- Its subscribed events exactly match the implemented set: `checkout.session.completed`, `checkout.session.expired`, `payment_intent.payment_failed`, `refund.created`, `refund.updated`, and `refund.failed`.
- Provider signing-secret coherence is **E2E-PROVEN**: a real TEST Checkout completion was accepted and its signed `checkout.session.completed` event was persisted as processed. An unsigned/invalidly signed POST returned HTTP 400 `invalid_signature`; no matching event row or order/payment mutation was created.

## Architecture map and First Party result

`/productos` → `/carrito` → `/checkout` → `create_customer_checkout_order` → `/cuenta/pedidos/[id]` → `createStripeCheckoutAction` / `prepare_stripe_checkout_session` → Stripe-hosted Checkout → `/api/webhooks/stripe` → `process_stripe_webhook_event` → payment/reservation/inventory state. The charge amount came from the server-prepared order payment in integer minor units; the client did not set the amount.

### E2E-01 — First Party successful checkout

- Buyer A authenticated through the staging UI and completed checkout using the official Stripe TEST card `4242…4242` (expiry/CVC were test-only and are not retained here).
- Order `PG-W-BBB845FE53AA`, order ID `bbb845fe-53aa-4f61-9d4c-66f4c78b3298`; payment ID `3b43d0e1-8418-4fa7-b4a4-13d390ea8ccf`.
- Stripe session `cs_test_a1Gwv9VRAe8uJXthIjGok3S9v5UL2tvcl3IkZOwbu4RUA6nNLQtlql2gLg`; processed event `evt_1UVEtYDLG0ay9qywJzU6OpwT` (`checkout.session.completed`, `livemode=false`, Stripe `pending_webhooks=0`). PaymentIntent `pi_3UVEtXDLG0ay9qyw0q6mIUW6`.
- Server total and Stripe total both `24,900 MXN minor units` (MXN 249.00), including explicit MXN 149.00 shipping.
- One payment became `paid`; the session became `completed`; First Party reservation `447864a2-5b4c-4ba7-b4c4-13d390ea8ccf` became `COMMITTED`; inventory changed from on-hand/reserved `10/0` to `9/0`; exactly one `sale` movement exists.
- No Partner payable or Marketplace ledger entry was created for this First Party item. Buyer order detail showed the paid state based on `order_payments`. Legacy compatibility fields remained `payment_method=none`, `payment_status=pending`; they did not claim bank transfer, and they are stale projections that must not drive financial decisions.
- Order remains `pending_confirmation`, awaiting Operations lifecycle handling. Operations and Partner UI could not be verified because no Operations/Partner session was used.

### E2E-04 — duplicate successful webhook

Stripe provider replay sent the exact event `evt_1UVEtYDLG0ay9qywJzU6OpwT` again to the verified staging endpoint. Stripe then reported `pending_webhooks=0`. The database retained one event record; payment remained paid; there was still one committed reservation and one sale movement; inventory stayed `9/0`. Duplicate delivery was E2E-proven idempotent for this First Party success.

### E2E-05 — card decline and P0 retry/reservation race

- Buyer B used Stripe’s official TEST decline card on order `PG-W-3D4454D3AA2D`, order ID `3d4454d3-aa2d-4da6-a6fb-04cfc3dbbaf3`, payment ID `a2065054-4b14-495a-a492-fedc169483a7`, session `cs_test_a1v7yi4U9c40GtS3PYUErSfQMY0OEKj0hghM8Xl3m1xmlc8tL7uBjMOknz`.
- The hosted page showed a card-declined message and remained interactive with the card form available for another attempt. At the same time, staging processed `evt_3UVYGTDLG0ay9qyw2pC2JAuG` (`payment_intent.payment_failed`), set payment `failed`, and changed the reservation to `RELEASED`; inventory remained on-hand/reserved `1/0` with one release movement.
- This leaves an unsafe interval: the existing Stripe Checkout page can still accept another payment attempt after the inventory reservation has been released. If a later attempt succeeds, the paid order may no longer hold the stock it represents. We did not submit a successful retry.
- The TEST session was already expired by the time the safe provider-expire request ran. Stripe event `evt_1UVYjJDLG0ay9qyw4xuUTWjI` (`checkout.session.expired`) was processed. Payment stayed failed, session is expired, reservation is released, inventory remains `1/0`.
- **P0 launch blocker; follow-up PR required.** Make payment failure terminal before releasing stock (for example, safely close the Stripe session before release) or retain the reservation while Stripe can retry. Add an E2E test that declines once, then attempts a successful card on the same Checkout flow and proves there can be no paid order without a reserved unit. This corrective did not change runtime behavior.

### E2E-06 — Checkout expiry and reservation release

Buyer A’s last-unit session `cs_test_a1i4xsfcRZ4oQvWZKDC5DOVIVnXYhOfGZklb3RtmXPhg9qyNPyahqN37BF` expired in Stripe TEST. Event `evt_1UVFcXDLG0ay9qywnBQTaIVV` (`checkout.session.expired`) was processed. Its reservation `714fb302-e4e6-4070-bc6f-0fe88ee274a8` transitioned `ACTIVE → EXPIRED`, with one release movement; inventory returned to `1/0`. A later Buyer B order could reserve the released unit. This proves provider expiry release, while the failure/retry race above remains open.

### E2E-07 — last unit

Buyer A’s active reservation for the single-unit fixture prevented Buyer B from adding that item to Mi Bolsa; the UI returned “La cantidad solicitada ya no está disponible.” This blocked Buyer B before order or Stripe session creation. After Buyer A’s session expired and released stock, Buyer B could add the product and create a new order. This is provider-boundary evidence of the reservation guard, but the conflict occurred at add-to-cart rather than a second authenticated checkout RPC attempt.

### E2E-09 — First Party full refund

- Full TEST refund `re_3UVEtXDLG0ay9qyw0ETQbLKR` for PaymentIntent `pi_3UVEtXDLG0ay9qyw0q6mIUW6` succeeded for `24,900` minor units.
- `refund.created` event `evt_3UVEtXDLG0ay9qyw0D1JVJl0` and `refund.updated` event `evt_3UVEtXDLG0ay9qyw0aujpS8G` were both processed.
- Payment became `refunded`, `refunded_amount=24,900`; the reservation remained `COMMITTED`; inventory remained on-hand/reserved `9/0` with the original single sale movement and no return movement. Order stayed `pending_confirmation` and there was no operational refund/restock transition in the observed flow.
- Refund state is E2E-proven. Restock/cancellation policy is not automated or proven; operations must explicitly handle the physical item and inventory. This is a P1 pilot procedure gap unless a manual audited restock/refund process is established.

## Scenario evidence matrix

| Scenario | Status | Evidence level | Provider / domain reference | Reservation, inventory, fulfillment, ledger | Cleanup state |
|---|---|---|---|---|---|
| E2E-01 First Party success | Pass | E2E-PROVEN | Order `bbb845fe-53aa-4f61-9d4c-66f4c78b3298`; payment `3b43d0e1-8418-4fa7-b4a4-13d390ea8ccf`; session `cs_test_a1Gwv9…`; event `evt_1UVEtY…` | `COMMITTED`; 10/0 → 9/0; one sale; no Partner payable/ledger | Retained as QA payment record; fully refunded later |
| E2E-02 Partner success | Not run | CODE/DB-PROVEN only | No QA Partner fixture or transaction | Not exercised | No Partner fixtures |
| E2E-03 mixed First Party + Partner | Not run | CODE/DB-PROVEN only | None | Not exercised | None |
| E2E-04 duplicate webhook replay | Pass | E2E-PROVEN | Same event `evt_1UVEtY…` resent; provider pending hooks 0 | One event row, one sale movement, stock unchanged on replay | Retained audit event |
| E2E-05 payment failure | Decline and release pass; safe retry fails | E2E-PROVEN; P0 blocker | Order `3d4454d3-aa2d-4da6-a6fb-04cfc3dbbaf3`; payment `a2065054-4b14-495a-a492-fedc169483a7`; event `evt_3UVYG…` | Payment failed, reservation released, stock 1/0; hosted form remained retryable | Stripe session expired; event `evt_1UVYj…` processed |
| E2E-06 checkout expiry | Pass | E2E-PROVEN | Event `evt_1UVFc…`; last-unit order `a498aadb-6e5b-4d27-a79c-d4fcd09ad7fc` | `ACTIVE → EXPIRED`; stock 1/1 → 1/0; one release movement | Order and immutable audit retained |
| E2E-07 last-unit conflict | Pass at cart gate | E2E-PROVEN, narrower than checkout-RPC race | Buyer A active session; Buyer B blocked before order/session | One unit reserved only by Buyer A | Buyer A session expired; Buyer B reserved after release, later declined and session expired |
| E2E-08 invalid signature | Pass | E2E-PROVEN ingress | Unsigned request to stable endpoint | HTTP 400 `invalid_signature`; zero DB effects | No fixture needed |
| E2E-09 First Party full refund | Pass | E2E-PROVEN | Refund `re_3UVEtX…`; events `evt_3UVEtX…` and `evt_3UVEtX…` | Payment refunded; committed reservation and sale movement remain; no restock movement | Immutable refund/order audit retained |
| E2E-10 Partner refund before payout | Not run | CODE/DB-PROVEN only | No Partner charge | Payable/ledger reversal not exercised | None |
| E2E-11 multi-Partner | Not run | CODE/DB-PROVEN only | No Partner fixtures | Not exercised | None |
| E2E-12 partial refund | Not run; current operational action is full-refund oriented | PARTIAL | No partial refund ID | No partial-cent reconciliation | None |
| E2E-13 webhook retry on transient failure | Not induced | CODE-PROVEN only | No transient-failure replay | Provider retry outcome not proven | None |
| Live-mode event rejection | Not sent | CODE-PROVEN only | No live credentials or event used | No DB effect tested with a signed fixture | None |

## Other surfaces, economics, and cleanup

- Buyer surfaces: authenticated account, checkout, order history/detail, success page and paid status were observed for First Party. Stripe showed safe decline messaging. No Partner customer order view was tested.
- Operations UI: not tested with an Operations identity. Paid First Party order remains pending operational confirmation. Do not claim Operations can complete paid/refund handling without SQL.
- Partner UI and ownership isolation: not tested; no Partner fixture was created.
- Marketplace pricing/economics, fulfillment attribution, ledger/payable amounts, and Partner refunds were not exercised through Stripe. PR86 code/schema evidence remains non-E2E evidence.
- Disposable fixtures created: two `QA-PR88-STRIPE-*` First Party products/variants/inventory records and two staging auth buyers. Both products are now unpublished; both buyer accounts are banned from further sign-in. The main product began at on-hand 10 and now has on-hand 9 after its sale; its full refund did not restock it. The last-unit fixture is back at on-hand/reserved 1/0. Its expiry/failure reservations are terminal. Paid/refund/webhook/order records are retained as immutable QA audit evidence. The Stripe TEST hosted session that showed a decline is expired. No partner fixture was created.
- PR84 First Party job `14b73876-fbca-4a07-b32f-f00811ed0dbb` and Partner job `5dd2c1e8-b34b-46ee-8199-50b5f73c3459` were not modified. Production Vercel, Supabase, Stripe LIVE, real payouts and real shipping were untouched.

## Launch blockers and next safe work

1. **P0 — failure/retry reservation race.** Make a Stripe decline unable to remain retryable after the reservation is released, or retain inventory until the Checkout session is closed/expired. Prove failed-card → retry success behavior with a test that checks inventory and order/payment coherence. Do not start pilot transactions before this is resolved.
2. **P1 — refund operations.** Define and test the First Party refund/restock/cancellation lifecycle. Establish a manual auditable process if physical restock is intentionally separate from payment refund.
3. **P1 — Partner and mixed transactions.** Create new isolated QA Partner fixtures and run Partner-only and mixed successful Stripe TEST flows, including economics, seller attribution, fulfillment separation, and refund-before-payout. These remain NOT PROVEN.
4. **P1 — Operations/Partner surfaces.** Verify transaction visibility and actions under actual authorized staff and Partner sessions.
5. **P1 — transient webhook retry and multi-Partner coverage.** Still CODE-PROVEN only / not run.
6. **Partial refund:** not proven and not supported by the full-refund-only operational action observed; classify based on pilot policy before launch.

Historical PR86 audit remains intact. This note updates only PR88 evidence and does not claim pilot readiness.

## Corrective 3 — preserved decline/retry fix and mixed checkout closure

Date: 2026-10-29
Decline/retry implementation SHA: `f6ff851c1a9073eb5ffc2d839fa062de65736725`

The prior corrective was recovered as four uncommitted files, tested locally,
committed, and pushed to PR #89 before this investigation continued. The
candidate adds
`20261028172546_stripe_decline_retry_reservation_safety.sql` plus First Party,
Stripe, and mixed Marketplace SQL regressions. The migration makes
`payment_intent.payment_failed` an auditable retryable attempt while the
Checkout Session remains payable, aligns reservation expiry to the provider
Session, blocks unsafe Operations cancellation, and preserves monotonic paid
state. The real First Party TEST flow already exercised against this exact
migration content was decline -> reservation `ACTIVE` -> same Session success
-> payment `paid` -> reservation `COMMITTED`, with one inventory sale and no
release. The committed regressions additionally cover competitor blocking,
decline -> expiry release once, late failure monotonicity, and expiry alignment.

### Prior mixed failure — exact root cause and classification

**Classification: FIXTURE DEFECT.** The earlier temporary QA wrapper executed
this statement after `SET LOCAL ROLE authenticated`:

```sql
select id into strict qid
from public.marketplace_pricing_quotes
where id = 'd0ff2abe-fda6-4fe5-bd9d-a81801999f42'
  and status = 'APPROVED';
```

Buyer RLS intentionally hides `marketplace_pricing_quotes`, so the fixture's
direct `SELECT INTO STRICT` returned zero rows and PostgreSQL raised SQLSTATE
`P0002`, message `query returned no rows`, context
`PL/pgSQL function inline_code_block line 4 at SQL statement`. The failure was
not raised by `create_marketplace_checkout_order`; that RPC was never invoked.
The original idempotency keys `...271`, `...272`, and `...273` have zero cart
or order rows; the failure window has zero orders and zero checkout audit rows.
Therefore it left no order, payment, fulfillment, reservation, inventory
mutation, payable, or ledger entry.

The fixture now resolves and validates the protected quote before switching to
the buyer role, then passes only the approved quote ID into authenticated RPCs.
`marketplace_checkout_orders_fulfillment.sql` has an explicit early fixture
assertion for both the approved Partner offer and the active/published First
Party offer, with a clear RLS hint. Runtime invariants were not weakened.

### Valid mixed fixture snapshot before checkout

- Buyer: the same authenticated QA buyer for both lines; cart
  `c36de59e-5620-40b3-9217-2a9e9b94f630`, version `4`, currency `MXN` at the
  authoritative checkout call.
- First Party: product `89000000-0000-4000-8000-000000000101`, variant
  `89000000-0000-4000-8000-000000000102`, inventory
  `89000000-0000-4000-8000-000000000103`; product `active`, published, and
  not archived; variant active, not archived, and owned by that product;
  inventory existed at on-hand/reserved `2/0`; cart `price_seen=2,500` equaled
  `coalesce(variant.price, product.price)=2,500`; currency was `MXN` and one
  unit was available.
- Partner: listing `88000000-0000-4000-8000-000000000231` was `APPROVED`;
  approved version and cart version were both
  `88000000-0000-4000-8000-000000000232`. Quote
  `d0ff2abe-fda6-4fe5-bd9d-a81801999f42` was the latest `APPROVED` quote,
  expired at `2026-11-04 19:21:12.571076+00`, and had public price/cart
  `price_seen=100,000 MXN`. Partner
  `88000000-0000-4000-8000-000000000211` was `VERIFIED`, was not the buyer,
  and had no open critical penalty. Inventory
  `43b8d12e-d375-4866-a6e0-5508412fb76e` was on-hand/reserved `2/0` before
  checkout. Fulfillment/custody were `PARTNER_FULFILLED` / `PARTNER_CUSTODY`;
  canonical model `88000000-0000-4000-8000-000000000221` existed.
- Shipping: method `35aaac42-f2e7-4d4d-850f-beb9312b3282` was active,
  `MXN`, price `14,900`. Published Marketplace config
  `c5d934d3-edd1-45c2-9915-7c83ff218d52` existed with checkout reservation
  `30 minutes`, confirmation `24 hours`, and handoff `48 hours`.

### Partner-only Stripe TEST success

- Order `62e69020-9906-4a02-9450-cc16ca07d348`, payment
  `a248f859-11ca-40ee-a9af-1337036fe4b1`, Checkout Session
  `cs_test_a1qGNSaEuN13KKV9Ae9BdZzqktdhDn0Tt9EdeDX0MtFeh1RollR2EYQ9D8`,
  PaymentIntent `pi_3UVcSUDLG0ay9qyw0gDR1LLd`, processed completion event
  `evt_1UVcSVDLG0ay9qywo6y9gRfE` (`livemode=false`, provider pending hooks 0).
- Partner fulfillment `f382df2d-bdc1-41f2-9fe5-2aae077876d4`, Partner
  `88000000-0000-4000-8000-000000000211`; reservation
  `02bd217e-35ec-4ece-84d2-60195c4546c0` committed. The listing inventory
  moved 3/0 -> 2/0 once at payment.
- Immutable economics: public line 100,000; commission 15,000; commission VAT
  2,400; processing 3,900 split 1,950 Partner / 1,950 Best Round; admin percent
  750; admin fixed 3,900; other fees 0; Partner net 76,000; Best Round revenue
  17,700 minor MXN units. One payable and one `PAYABLE_CREATED` ledger entry
  were created for 76,000.

### Mixed First Party + Partner Stripe TEST success

- Final successful order `1dd6186f-e730-4c08-bc4d-08e604b25871`
  (`PG-W-1DD6186FE730`), payment
  `09542f9a-68a8-435a-85e3-d5f66f5cbf55`, Checkout attempt
  `e76d659a-1de1-4234-84ee-91c5d70c7fe1`, one linked Session
  `cs_test_a11PrJA6C59zapHgob56YM3fhAxHvYi6xE6Kkxk6Fckp8jNKZiBbTRogLA`,
  PaymentIntent `pi_3UVx4aDLG0ay9qyw0t8qdddr`, and processed completion
  event `evt_1UVx4bDLG0ay9qywTpHOxAjW`.
- One order, one payment, one Session, total 117,400 minor MXN units: First
  Party line 2,500 + Partner line 100,000 + shipping 14,900. Payment is `paid`
  and Session is `completed`.
- First Party reservation `5095ed4c-be85-4223-b2c7-f320d0ea5c19` and Partner
  reservation `c9c56f8f-4ab7-4a71-aa6d-c2a421a76555` both changed
  `ACTIVE -> COMMITTED`. First Party inventory 2/1 -> 1/0 with one sale and no
  release; Partner inventory 2/1 -> 1/0 with one sale and no release.
- Fulfillment ownership is separated: BEST_ROUND fulfillment
  `ec9aa2b1-6d35-4309-afe2-9454144544f3` contains only the First Party item;
  PARTNER fulfillment `8536c464-2486-4ca5-b086-89b02b6b33a5` contains only
  the Marketplace item and is bound to Partner
  `88000000-0000-4000-8000-000000000211` with
  `PARTNER_FULFILLED` / `PARTNER_CUSTODY`.
- Partner economics apply only to the Partner line and exactly match its
  approved snapshot: public line 100,000; commission 15,000; commission VAT
  2,400; processing 3,900 split 1,950 / 1,950; payment processing 360 bps + 300
  fixed; Partner share 5,000 bps; admin 75 bps = 750 plus 3,900 fixed; other
  fees 0; Partner net 76,000; Best Round revenue 17,700. The First Party item
  has no Marketplace snapshot or payable.
- Exactly one Partner payable `ebd04e1c-5ced-4043-a451-d42578f06579` and one
  `PAYABLE_CREATED` ledger entry `cdf14d44-2eb5-4492-a089-a1aaeb1cf153` exist,
  both for 76,000. Replaying the exact completion event left one event row,
  two committed reservations, one sale per inventory domain, two fulfillments,
  one payable, and one ledger entry.

Two earlier disposable mixed harness orders expired unpaid while the provider
link/payment automation was being built. Their provider expiry webhooks released
both reservations. They are retained as QA audit evidence and are not counted
as successful E2E transactions.

### Partner refund before payout

Full TEST refund `re_3UVcSUDLG0ay9qyw0qp7L1rB` succeeded for 114,900 minor
MXN units on the Partner-only PaymentIntent. Events
`evt_3UVcSUDLG0ay9qyw0b4vyW4j` (`refund.created`) and
`evt_3UVcSUDLG0ay9qyw0DOggInI` (`refund.updated`) were processed. The payment
is `refunded`; payable `68adbe32-2356-4860-8294-fc53f5ed7cb4` is `REVERSED`
for its full 76,000; exactly one `PAYABLE_REVERSED` ledger entry offsets the
original pending balance; and active payout item count is zero. No payout was
executed. The Partner reservation remains committed and no automatic inventory
return was created; fulfillment remains `PENDING_CONFIRMATION`. This physical
restock/fulfillment handling joins the existing refund operations P1 and does
not reopen the payment/payable correctness result.

### Remaining findings after Corrective 3

- P0: none identified in the exercised decline/retry, Partner-only, or mixed
  TEST paths.
- P1: refund/restock and fulfillment cancellation remain operationally manual
  for both First Party and Partner physical inventory; Operations/Partner UI,
  transient webhook retry, partial refund, and multi-Partner end-to-end coverage
  remain outside this corrective.
- Production, real payouts, real cards, and Stripe LIVE remained untouched.

## Validation

On the Corrective 3 candidate: `npm run test` **785 passed** (87 test
files); `npm run typecheck` **PASS**; `npm run lint` **PASS**; local Next
production build **PASS** using the supported webpack builder and documented
non-secret local public configuration (the sandbox blocks Turbopack's internal
worker port); `npm run supabase:lint` **PASS**; `git diff --check` **PASS**.
The First Party, Stripe TEST, and Marketplace checkout/fulfillment SQL
regressions all pass. Linked migration dry-run reports the remote database up
to date with no migrations pending; local and remote histories both end at
`20261028172546`. GitHub checks, exact staging deployment, candidate parity,
and stable health are recorded in the final PR closeout after the evidence
commit is pushed. Production was untouched.
