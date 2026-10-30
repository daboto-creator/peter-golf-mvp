# PR87 — First Party checkout reservation status

PR86 identified that First Party checkout locked stock only while creating the
order and did not reserve it before payment. PR87 closes that launch blocker by
creating an `ACTIVE` `FIRST_PARTY` row in the existing
`public.inventory_reservations` ledger inside the customer checkout transaction.
The checkout replay path does not create another order, payment, or reservation.

The existing paid-payment transition commits the reservation and decrements
on-hand stock once. Payment rejection/failure, Stripe session expiry, generic
reservation expiry, and pre-payment order cancellation release active stock.
Operations confirmation advances the order after payment and does not decrement
reservation-backed stock again. Marketplace/mixed checkout keeps its existing
reservation and fulfillment path.

`public.order_payments` remains authoritative. For card orders, legacy order
payment fields project to the neutral `pending`/`none` pair because their enums
cannot represent card; bank-transfer orders retain their matching compatibility
projection. Operations confirmation is gated on the current payment aggregate
for web checkout orders.

The migration is additive:
`20261027000000_first_party_checkout_reservations_and_payment_coherence.sql`.
The last-unit concurrency runner uses disposable local Supabase fixtures and is
available as `npm run test:checkout-concurrency`. It creates two authenticated
buyer carts before either checkout, holds the inventory row while both checkout
sessions begin, asserts one payable order and one active reservation, then
removes its fixtures. It does not call Stripe or touch staging/production data.

This status update supplements the unchanged PR86 audit. It does not claim a
Stripe E2E payment, browser checkout, or production transaction test.
