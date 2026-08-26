# Marketplace delivery acceptance and claims

PR8 closes the Marketplace post-delivery decision loop without moving money.
When Operations records delivery, the system snapshots the published
Marketplace configuration and opens a UTC-safe acceptance window. The current
technical baseline is 48 hours from `delivered_at`; it comes from the versioned
`marketplace_operational_rules.acceptance_window_hours` value.

The buyer can accept the delivery or report one of the supported attributable
problems. Remorse returns are not eligible. Both commands lock the same
acceptance row, so acceptance, claim creation and the hourly auto-accept worker
cannot produce conflicting outcomes.

## Financial boundary

Claims never run the Pricing Engine and never read the current Partner tier or
financial configuration. They reference the immutable PR6 order item snapshot
and the PR7 payable. Acceptance delegates to the PR7 release executor; an open
claim creates a claim-specific hold; approved resolutions use PR7 compensating
reversals. Rejected claims release only their own hold, leaving risk or
reconciliation holds intact.

Refund execution is intentionally not implemented. Approved claims are marked
`REFUND_REQUIRES_MANUAL_ACTION`; no Stripe refund, Connect transfer, payout or
bank action is possible in PR8.

## Background processing

The unique pg_cron job
`best-round-marketplace-delivery-auto-accept-hourly` runs at `0 * * * *` in
Supabase's UTC scheduler. It invokes a private `SECURITY DEFINER` executor with
an empty search path and no grants to browser or service roles. The executor
uses an advisory transaction lock, row locks, deterministic idempotency keys
and skips deliveries with claims, fulfillment holds or financial holds.

## Evidence and privacy

Evidence is stored in the private `marketplace-claim-evidence` bucket. The
technical defaults are eight images per claim, 10 MB each, and JPEG, PNG or
WebP only. The application validates MIME and binary signature before upload;
database paths are scoped by buyer and claim UUID. Buyer and Partner never
receive each other's contact or payment data, and Partner evidence access must
be explicitly marked visible.

## Returns and future work

The return entity stores authorization, shipping responsibility, tracking and
inspection state, but PR8 does not purchase labels or invent shipping charges.
AI/HYBRID evaluation fields are schema-ready advisory metadata only; final
decisions remain human. Marketplace remains disabled by default.
