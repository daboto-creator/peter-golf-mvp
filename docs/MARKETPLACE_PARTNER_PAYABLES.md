# Marketplace Partner Payables and Ledger

PR7 records the Partner obligation created by a successfully paid Marketplace
order. Payment success creates one payable for each Partner order item, using
the exact `estimated_partner_net` already locked in the PR6 order snapshot.
No current tier, pricing rule, payment-fee configuration, or market analysis is
consulted.

The ledger is append-only. Creation credits `PENDING`; a hold transfers the
remaining amount to `ON_HOLD`; an explicit authorized acceptance or Operations
reconciliation can transfer `PENDING` to `AVAILABLE`; reversals add a negative
compensating movement. Multiple active holds are preserved independently and
the last one must be released before the amount leaves `ON_HOLD`.

`AVAILABLE` means eligible for a future payout process. This PR does not expose
a withdraw action and does not implement payout batches, bank transfers, Stripe
Connect, settlement, Mexican withholding, CFDI, or any movement of real money.
PR8 can add acceptance/claim outcomes through the release-authorization model;
PR9 can associate future payout records without rewriting historical entries.
