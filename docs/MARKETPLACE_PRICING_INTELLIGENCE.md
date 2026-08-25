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

All persisted values are integer MXN cents. The engine calculates exact
rational numerators with `BigInt`/PostgreSQL `numeric` and applies one
**cumulative ceiling waterfall** to Partner variable deductions. Each component
is the difference between two consecutive rounded cumulative totals. This
prevents independent percentage ceilings from jumping together, conserves
every cent and guarantees that increasing public price by one cent cannot
reduce Partner net for a valid fixed configuration.

```text
R1 = ceil(exact_commission)
R2 = ceil(exact_commission + exact_commission_vat)
R3 = ceil(exact_commission + exact_commission_vat + exact_partner_processing)
R4 = ceil(exact_commission + exact_commission_vat
          + exact_partner_processing + exact_admin_percentage)

commission = R1
commission_vat = R2 - R1
partner_processing = R3 - R2
admin_percentage = R4 - R3
processing_total = ceil(exact_processing_total)
best_round_processing = processing_total - partner_processing
partner_net = public_price - commission - commission_vat
              - partner_processing - admin_percentage - admin_fixed
estimated_best_round_revenue = commission + admin_percentage + admin_fixed
                               - best_round_processing
```

For an odd processing cent, the Partner share is the waterfall amount and Best
Round receives the exact remaining processing cent. Consequently
`partner_processing + best_round_processing = processing_total` always, and no
residual cent is charged twice or lost. Commission VAT remains the configured
tax applied to exact commission inside the same cumulative rounding policy.

Commission VAT is tax pass-through, not Best Round revenue. Withholding, CFDI
and entity-specific tax treatment remain `TBD_LEGAL_REVIEW`.

Desired-net pricing uses a bounded integer binary search over the monotonic
forward engine. Its contract is the exact minimum cent: the selected price
meets the desired net and the immediately preceding valid cent does not. Zero,
negative, overflow and impossible economics fail.

## Versioning and approval

A quote is bound to one `APPROVED` `marketplace_listing_version`. Tier,
commission, payment fee, Marketplace config, market reference and every
financial result are snapshotted. Submitted/approved/rejected quotes are not
edited; a new input creates a new quote version and supersedes editable older
quotes. `APPROVED` pricing is not `PUBLISHED` listing.

An active tier override is resolved atomically when the quote is created. The
quote stores the effective tier, source, override reference and commission; an
expired override is ignored and later tier changes never rewrite old quotes.
Quote market validity ends at the earlier of quote-policy expiry and the
supporting market analysis expiry, so a quote cannot extend research freshness.

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
