# Marketplace Pricing + Economics + Market Intelligence

PR 5 stops at an approved pricing quote. It does not publish listings, reserve
inventory, create orders, call Stripe, move money, or create Partner balances.
Marketplace remains disabled by default.

## Boundary

```text
Approved listing version
  -> effective Partner tier snapshot
  -> MarketPriceProvider
  -> normalized comparables
  -> deterministic market analysis
  -> deterministic Marketplace Pricing Engine
  -> Partner review
  -> human Operations approval
  -> approved immutable pricing quote
```

Market Intelligence and financial truth are separate. Provider, manual and
future AI/HYBRID analyses may recommend a market reference, confidence and
flags. They cannot define commission, VAT, processing, administration fees,
Partner net or Best Round revenue. Those amounts are recalculated from the
published configuration and stored as an immutable quote snapshot.

The future `MarketplaceIntelligenceInput` / `MarketplaceIntelligenceOutput`
contract can add comparable relevance, anomaly and commentary assistance. It
contains no fields that can become financial truth and PR 5 makes no LLM call.

## Deterministic economics

All values are integer MXN cents. Percentage multiplication rounds up to the
next cent, consistently with the existing `money.ts` helpers.

```text
commission = ceil(public_price * tier_commission_bps / 10000)
commission_vat = ceil(commission * commission_tax_bps / 10000)
processing_total = ceil(public_price * processing_bps / 10000) + fixed
partner_processing = ceil(processing_total * partner_share_bps / 10000)
best_round_processing = processing_total - partner_processing
admin_percentage = ceil(public_price * admin_bps / 10000)
partner_net = public_price - commission - commission_vat
              - partner_processing - admin_percentage - admin_fixed
estimated_best_round_revenue = commission + admin_percentage + admin_fixed
                               - best_round_processing
```

Commission VAT is tax pass-through, not Best Round revenue. Withholding, CFDI
and entity-specific tax treatment remain `TBD_LEGAL_REVIEW`.

Desired-net pricing uses a bounded integer binary search and validates the
solution through the same forward calculation. The first price whose net meets
the target is chosen. Zero, negative, overflow and impossible economics fail.

## Versioning and approval

A quote is bound to one `APPROVED` `marketplace_listing_version`. Tier,
commission, payment fee, Marketplace config, market reference and every
financial result are snapshotted. Submitted/approved/rejected quotes are not
edited; a new input creates a new quote version and supersedes editable older
quotes. `APPROVED` pricing is not `PUBLISHED` listing.

Market analyses are append-only runs. Provider refresh never overwrites prior
research. A manual reference requires Operations capability, evidence and a
reason. Partners see aggregate range/confidence only; raw comparables remain
Operations-only.

## Provider trust and failure

`SERPAPI_API_KEY` remains server-only. Because service-role use is prohibited
in hosted application paths, a Partner creates an idempotent research request;
authorized Operations executes and persists provider results. This prevents a
Partner from forging a median through a direct RPC call. Provider failure is
persisted explicitly and does not block deterministic fee calculation or
manual review.

Staging requirements:

- `MARKETPLACE_ENABLED=true` only when testing this private workflow;
- `MARKET_PRICE_PROVIDER=serpapi` to use SerpApi;
- `SERPAPI_API_KEY` server-only;
- active `payment_fee_configs` row referenced by published Marketplace config.

The technical MVP defaults are seven-day quote expiry and 168-hour market
freshness. Both are versioned/configurable and are not permanent commercial
policy.

## Future checkout

Checkout must copy the approved quote economics into an immutable order/suborder
snapshot. It must never depend on a mutable current tier, current configuration
or a newly recalculated market analysis.
