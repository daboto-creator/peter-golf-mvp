# Marketplace Checkout + Orders + Fulfillment

PR6 extends the existing Best Round cart, order, payment and inventory models;
it does not create a seller-specific order system. One customer-facing order
may group first-party items and several Partner offers into independent
fulfillments.

## Transaction boundary

`create_marketplace_checkout_order` validates the current cart, locks inventory
in deterministic order, reserves every line, creates the existing `orders` and
`order_items` records, copies Marketplace economics, groups fulfillments and
creates payment preparation state in one PostgreSQL transaction. Stripe is
called only after that transaction. A retry with the same key returns the same
order.

Checkout eligibility requires the current approved listing version, the latest
approved and unexpired pricing quote, valid inventory, a `VERIFIED` Partner and
no open critical risk flag. Changed price/version is reported as stale; it is
never replaced silently.

## Immutable transaction economics

`marketplace_order_item_snapshots` copies the approved PR5 quote and listing
version. Tier, commission, commission VAT, processing assumptions and split,
admin fees, Partner net, Best Round estimated revenue, config version and
calculation version never recalculate from live configuration. A trigger rejects
updates/deletes.

## Reservations and payment races

First-party and Marketplace inventory remain separate. Rows are locked with
`FOR UPDATE`; `quantity_reserved <= quantity_on_hand` remains enforced. Payment
success commits the reservation once and activates fulfillments. Failure/expiry
releases it idempotently. A success received after expiry places the order and
fulfillments in `MANUAL_RECONCILIATION_REQUIRED`/`ON_HOLD`; inventory is never
silently taken after reassignment.

## Privacy and scope

Partners receive a safe DTO for only their activated fulfillment and Partner net;
they cannot read the order-wide snapshot, another seller, buyer payment data or
Best Round margin. Operations access requires both existing order and Marketplace
listing capabilities. Marketplace stays OFF. PR6 adds no Connect account,
ledger, payout, settlement, refund engine, shipping provider or fund release.

The 24/48-hour SLA baseline is stored in versioned operational configuration.
It currently uses elapsed UTC hours; holiday/business-calendar calculation is a
future extension.
