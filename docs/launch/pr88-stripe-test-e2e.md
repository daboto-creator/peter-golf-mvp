# PR88 — Controlled Stripe TEST E2E evidence

Date: 2026-10-27  
Repository base: `7becb59191f3a2cb8e5776c030c9093f3c77bfa9`  
Environment: `peter-golf-staging` (`xdulakstgsgdujjylhox`)  
Scope: evidence collection only; no commercial transaction fixtures or runtime changes have been made.

## Executive status

**Classification: NOT READY — FIXABLE BLOCKERS.** This turn did not achieve Stripe E2E proof. The staging application is reachable, the database test-mode gates are enabled, and the webhook route rejects an unsigned request before processing. The application’s staging environment validation also requires a `sk_test_` key and a non-empty `whsec_` signing secret when Stripe TEST checkout is enabled. Secret values were never displayed.

The connected account/tooling did not provide access to Stripe’s provider dashboard or event delivery/replay controls. Therefore the configured endpoint and subscribed event list could not be verified with Stripe, and no provider event, session, charge, refund, or test card transaction was created. No QA fixtures were created because this provider-side prerequisite could not be independently verified. Do not interpret code or database tests as provider E2E evidence.

## Runtime and implementation map

| Stage | Current implementation | Evidence in this audit |
|---|---|---|
| Buyer cart / checkout | `/checkout`; `src/lib/cart/cart-actions.ts`; `create_customer_checkout_order` for First Party and `create_marketplace_checkout_order` for Marketplace/mixed carts | Code inspection; no authenticated browser checkout |
| Stripe Checkout creation | `src/lib/payments/stripe-actions.ts`; `prepare_stripe_checkout_session` snapshots server-side expected amount and attempt/idempotency data, then creates a Checkout Session with metadata | Code inspection only |
| Webhook ingress | `src/app/api/webhooks/stripe/route.ts`; verifies Stripe signature, rejects `livemode`, normalizes allowlisted event payloads, calls service-role RPC | Code inspection plus staging unsigned POST returned HTTP 400 `invalid_signature` |
| Webhook persistence | `process_stripe_webhook_event`; `stripe_webhook_events`, `stripe_checkout_sessions`, `order_payments`, histories | Schema/RPC found in repository and staging; no signed provider event received |
| Inventory | `inventory`, `inventory_reservations`, `inventory_movements`; PR87 adds First Party checkout reservation parity, shared commit/release lifecycle | Existing automated SQL tests and code; no new live fixture lifecycle run |
| Partner economics | Marketplace pricing snapshot, partner payables, immutable integer-cent ledger entries | Code/database structure only; no new test order |
| Fulfillment | `order_fulfillments`, status history, ownership and deadline fields | Schema and code only; no new order |
| Customer surfaces | `/cuenta/pedidos`, `/cuenta/pedidos/[id]`, `/pedido-confirmado/[id]`, Stripe success page | Route/code inspection; no signed-in test buyer session |
| Operations surfaces | `/operacion/pedidos`, order detail, Marketplace fulfillment/payout areas | Route/code inspection; no test order to inspect |
| Partner surfaces | Marketplace partner order/finance routes | Route/code inspection; no new partner session/order |

The staging database contains `orders`, `order_items`, `order_payments`, `payment_submissions`, `order_idempotency_keys`, `payment_idempotency_keys`, `order_fulfillments`, `inventory`, `inventory_reservations`, `inventory_movements`, `stripe_checkout_sessions`, `stripe_webhook_events`, `stripe_refunds`, `marketplace_partner_payables`, and `marketplace_partner_ledger_entries`.

## Stripe configuration evidence

- `public.payments_test_mode_enabled()` returned `true` in staging.
- `public.stripe_checkout_test_mode_enabled()` returned `true` in staging.
- `src/env/server.ts` validation requires `PAYMENTS_MODE=test`, `STRIPE_CHECKOUT_MODE=test`, a Stripe secret beginning `sk_test_`, and a webhook signing secret beginning `whsec_`; it rejects a live secret in TEST mode.
- The stable webhook URL checked was `https://peter-golf-staging.vercel.app/api/webhooks/stripe`. An unsigned POST returned `400` with `invalid_signature`, demonstrating that the deployed route is reachable and signature verification rejects before database processing.
- **Provider-side verification is UNKNOWN:** no Stripe dashboard/API connection was available to verify that this exact staging URL is registered, that it is enabled, or that it subscribes to the application’s actual event set: `checkout.session.completed`, `checkout.session.expired`, `payment_intent.payment_failed`, `refund.created`, `refund.updated`, `refund.failed`.
- The route’s response does not prove provider delivery, nor does it prove an event was persisted.
- No Stripe secret, signing secret, or card number was exposed or written to the repository.

## Scenario evidence matrix

`CODE-PROVEN` means implementation/tests exist; `DB-PROVEN` means staging schema/state or read-only predicate was inspected. Neither means E2E-PROVEN.

| Scenario | Status | Evidence level | Order / payment / provider reference | Reservation / inventory / fulfillment / ledger | Cleanup |
|---|---|---|---|---|---|
| E2E-01 First Party success | Not run | CODE-PROVEN, DB-PROVEN | None | Not exercised | No fixtures |
| E2E-02 Partner success | Not run | CODE-PROVEN, DB-PROVEN | None | Not exercised | No fixtures |
| E2E-03 First Party + Partner mixed cart | Not run | CODE-PROVEN, DB-PROVEN | None | Not exercised | No fixtures |
| E2E-04 Duplicate webhook replay | Not run against deployed endpoint | CODE-PROVEN (SQL/automated coverage) | No Stripe event ID | No staging effects tested | No fixtures |
| E2E-05 Stripe test payment failure | Not run | CODE-PROVEN | None | No provider-driven release observed | No fixtures |
| E2E-06 Checkout session expiry | Not run | CODE-PROVEN (abandoned-checkout SQL tests) | None | No provider-driven release observed | No fixtures |
| E2E-07 First Party last-unit conflict before Stripe | Not run with buyers/sessions | CODE-PROVEN / DB regression coverage from PR87 | None | No payable order/session comparison | No fixtures |
| E2E-08 Invalid webhook signature | Request rejected | E2E-PROVEN for ingress rejection only | No order/payment/event ID | Route returned 400 `invalid_signature`; no signed processing attempted | No fixture/data cleanup required |
| E2E-09 First Party refund | Not run | CODE-PROVEN only; refund action currently full-refund path | None | Refund/restock behavior not observed | No fixtures |
| E2E-10 Partner refund before payout | Not run | CODE-PROVEN only | None | Payable/ledger hold or reversal not observed | No fixtures |
| E2E-11 Multi-Partner order | Not run | CODE-PROVEN / DB model | None | Not exercised | No fixtures |
| E2E-12 Partial refund | Not run; current action is full refund | PARTIAL | None | No partial-cent reconciliation observed | No fixtures |
| E2E-13 Transient webhook retry | Not provider-tested | CODE-PROVEN (route returns retryable 500 on transient processing failure) | None | Stripe retry attempt/outcome not observed | No fixtures |
| Live-mode event rejection | Not sent to staging | CODE-PROVEN (route rejects `livemode`) | No event | No DB effect tested with signed fixture | No fixtures |

## Reconciliation and safety notes

- No Stripe TEST Session, payment, refund, or webhook event was created in this audit; consequently there are no transaction IDs or before/after inventory counts to report.
- Read-only final sanity check: PR84 First Party job `14b73876-fbca-4a07-b32f-f00811ed0dbb` remains `IMPORTED` (3 imported / 0 skipped / 0 failed); PR84 Partner job `5dd2c1e8-b34b-46ee-8199-50b5f73c3459` remains `IMPORTED` (5 / 0 / 0). Catalog counts remain 18 active brands and 658 active models. These QA records were not changed.
- The card checkout amount is constructed from server-prepared database values in integer minor units; client input does not supply the authoritative charge amount. This is code evidence, not a provider reconciliation.
- PR87 introduced First Party reservations using the shared `inventory_reservations` lifecycle. PR87’s staging concurrency and lifecycle checks are prior evidence and are not repeated or promoted to Stripe E2E evidence here.
- Partner economics, order attribution, and ledger/payable behavior are implemented in Marketplace-specific code/RPCs and integer-cent records. No Stripe-paid Partner order was available to reconcile.
- Buyer, Operations, and Partner pages exist in code. Their visibility and ownership behavior on a new paid order remain unproven in this run.
- Existing PR84 QA jobs were not modified. No new fixtures or orders were created. No production Vercel, Supabase, Stripe LIVE, payout, or shipping-provider action occurred.

## Blockers and next safe steps

1. **P1 provider access prerequisite:** use Stripe TEST dashboard/API access to verify the staging endpoint URL, mode, active status, and subscribed event list. Verify the signing secret belongs to this endpoint without revealing it.
2. With verified endpoint/config and disposable staging buyer/partner fixtures, execute First Party, Partner, and mixed success plus duplicate event, failure, expiry, and last-unit conflict. Record provider event/session IDs and order/payment/reservation/inventory/fulfillment/ledger IDs.
3. Exercise First Party and Partner refunds in Stripe TEST and inspect persisted state. Test partial refund only if the product claims it is supported; current action code exposes full refund only.
4. Verify buyer, Operations, and Partner views against those test records, including ownership isolation.
5. Keep fixture rows tagged `QA-PR88-STRIPE-*`; retain immutable financial/audit history and mark/cancel fixtures using supported lifecycle actions instead of deleting protected records.

The historical PR86 audit remains unchanged. This note records the present evidence limit and does not close its payment/refund/fulfillment E2E gaps.

## Validation

- `npm run test`: **785 passed** (87 test files).
- `npm run typecheck`: **passed**.
- `npm run lint`: **passed**.
- `npm run build`: **passed** with `APP_ENV=development` and non-secret local placeholder `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` values required for prerendering.
- `git diff --check`: **passed**.
- Staging Supabase health and root health are checked separately in the PR run record; no schema or transaction data changes were made.
