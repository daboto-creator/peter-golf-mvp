# Marketplace workflow simplification

## Identity provider

Marketplace depends only on the `IdentityVerificationProvider` contract. The
initial adapter is Didit and uses hosted sessions; no provider secret is sent to
the browser. A provider result is evidence for Operations and never changes a
Partner to `VERIFIED` by itself.

Configure these server-only variables in Vercel staging:

```text
IDENTITY_VERIFICATION_PROVIDER=didit
DIDIT_API_BASE_URL=https://verification.didit.me
DIDIT_API_KEY=<Didit sandbox API key>
DIDIT_KYC_WORKFLOW_ID=<person workflow UUID>
DIDIT_KYB_WORKFLOW_ID=<business workflow UUID>
DIDIT_WEBHOOK_SECRET=<Didit sandbox webhook secret>
```

Configure the Didit webhook URL as:

```text
https://peter-golf-staging.vercel.app/api/webhooks/didit
```

Enable the Didit status/data update events used by the configured workflows.
The route validates `X-Signature-V2` (canonical sorted JSON) or the documented
raw-body `X-Signature`, enforces `X-Timestamp` freshness, hashes the payload,
and processes `event_id` exactly once. Production credentials must not be added
as part of this staging rollout.

For people, the Didit workflow must include identity document, selfie,
liveness, and 1:1 face match. Passport is accepted, including a valid foreign
passport. The business workflow is document-oriented and must not require a
representative selfie/liveness step.

## Document analysis

Every document upload creates a rules-first analysis record and an Operations
alert. Extracted content can later be recorded through the capability-protected
analysis function. Address-proof, CSF/SAT QR, and incorporation rules live in
`src/lib/identity-verification/document-analysis.ts`. No unofficial SAT API or
scraping is used. When extraction or legal authority is uncertain, the result
is review-required rather than an automatic rejection.

## Notifications

The database outbox contains separate `INTERNAL` and `EMAIL` rows with stable
deduplication keys. It is the channel-neutral delivery contract for Partner
verification, evidence alerts, and listing-review readiness. Existing hosted
notification safety remains in force; an SMTP/transactional-email dispatcher
must be configured separately before email delivery is enabled. WhatsApp is
intentionally not implemented.

## Listing and fulfillment

The Partner chooses the public price before submission. Deterministic cents
arithmetic creates the quote, while market analysis is queued independently.
The final submission atomically freezes product data, photos, inventory,
fulfillment, chosen price, quote, rules-first image result, canonical result,
and listing version. Operations then makes one consolidated decision.

At `READY_FOR_CARRIER`, the owning Partner records carrier, tracking number,
handoff time, and an optional note. The versioned RPC transitions to `SHIPPED`
idempotently. The existing Operations-authoritative delivery confirmation and
48-hour acceptance lifecycle are unchanged.
