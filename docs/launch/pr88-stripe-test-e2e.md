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
- One payment became `paid`; the session became `completed`; one First Party reservation `447864a2-5b4c-4ba7-b4c4-13d390ea8ccf` became `COMMITTED` (reservation ID verified separately as `447864a2-5b4c-4ba7-b4c4-13d390ea8ccf`); inventory changed from on-hand/reserved `10/0` to `9/0`; exactly one `sale` movement exists.
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
- Disposable fixtures created: two `QA-PR88-STRIPE-*` First Party products/variants/inventory records and two staging auth buyers. The main product began at on-hand 10 and now has on-hand 9 after its sale; its full refund did not restock it. The last-unit fixture is back at on-hand/reserved 1/0. Its expiry/failure reservations are terminal. Paid/refund/webhook/order records are retained as immutable QA audit evidence. The Stripe TEST hosted session that showed a decline is expired. No partner fixture was created.
- PR84 First Party job `14b73876-fbca-4a07-b32f-f00811ed0dbb` and Partner job `5dd2c1e8-b34b-46ee-8199-50b5f73c3459` were not modified. Production Vercel, Supabase, Stripe LIVE, real payouts and real shipping were untouched.

## Launch blockers and next safe work

1. **P0 — failure/retry reservation race.** Make a Stripe decline unable to remain retryable after the reservation is released, or retain inventory until the Checkout session is closed/expired. Prove failed-card → retry success behavior with a test that checks inventory and order/payment coherence. Do not start pilot transactions before this is resolved.
2. **P1 — refund operations.** Define and test the First Party refund/restock/cancellation lifecycle. Establish a manual auditable process if physical restock is intentionally separate from payment refund.
3. **P1 — Partner and mixed transactions.** Create new isolated QA Partner fixtures and run Partner-only and mixed successful Stripe TEST flows, including economics, seller attribution, fulfillment separation, and refund-before-payout. These remain NOT PROVEN.
4. **P1 — Operations/Partner surfaces.** Verify transaction visibility and actions under actual authorized staff and Partner sessions.
5. **P1 — transient webhook retry and multi-Partner coverage.** Still CODE-PROVEN only / not run.
6. **Partial refund:** not proven and not supported by the full-refund-only operational action observed; classify based on pilot policy before launch.

Historical PR86 audit remains intact. This note updates only PR88 evidence and does not claim pilot readiness.

## Validation

The original candidate's code gates were: `npm run test` 785 passed (87 test files), typecheck PASS, lint PASS, build PASS, `git diff --check` PASS, `npm run supabase:lint` PASS. This corrective changes only this Markdown evidence file; those gates must be re-run on the updated candidate. No migration or SQL/runtime change was made.
