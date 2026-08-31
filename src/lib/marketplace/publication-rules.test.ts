import { describe, expect, it } from "vitest";

import {
  getActivationEnvironmentBlockers,
  getMarketplaceCartIssue,
  getPartnerPublicationStatus,
  mapPublicationBlockers,
  MARKETPLACE_BUYER_BADGE,
  marketplaceCartIssueMessage,
  productSourceLabel,
} from "@/lib/marketplace/publication-rules";

describe("Marketplace publication presentation", () => {
  it("maps authoritative blockers without exposing implementation details", () => {
    expect(
      mapPublicationBlockers(["PRICING_EXPIRED", "PARTNER_CRITICAL_HOLD"]),
    ).toEqual([
      "El precio aprobado expiró.",
      "El Partner tiene una restricción crítica.",
    ]);
  });

  it("uses only the buyer-safe verified badge and source labels", () => {
    expect(MARKETPLACE_BUYER_BADGE).toBe("Best Round Partner verificado");
    expect(productSourceLabel).toEqual({
      FIRST_PARTY: "Producto Best Round",
      MARKETPLACE_PARTNER: "Best Round Partner verificado",
    });
  });

  it("derives Partner publication states", () => {
    expect(
      getPartnerPublicationStatus({
        listingStatus: "APPROVED",
        publicationReady: true,
        published: false,
        blockers: ["MARKETPLACE_DISABLED"],
      }),
    ).toBe("Listo para publicar");
    expect(
      getPartnerPublicationStatus({
        listingStatus: "APPROVED",
        publicationReady: false,
        published: false,
        blockers: ["INVENTORY_ZERO"],
      }),
    ).toBe("Agotado");
    expect(
      getPartnerPublicationStatus({
        listingStatus: "APPROVED",
        publicationReady: true,
        published: true,
        blockers: [],
      }),
    ).toBe("Publicado");
  });
});

describe("Marketplace stale cart state", () => {
  it("prioritizes OFF, listing review, price confirmation and availability", () => {
    expect(
      getMarketplaceCartIssue({
        listingVersionChanged: true,
        priceChanged: true,
        available: false,
        blockers: ["MARKETPLACE_DISABLED"],
      }),
    ).toBe("marketplace_disabled");
    expect(
      getMarketplaceCartIssue({
        listingVersionChanged: true,
        priceChanged: true,
        available: true,
        blockers: [],
      }),
    ).toBe("listing_changed");
    expect(marketplaceCartIssueMessage("price_changed")).toBe(
      "El precio de este artículo cambió.",
    );
  });
});

describe("Marketplace activation readiness", () => {
  it("accepts only an explicit safe staging configuration", () => {
    expect(
      getActivationEnvironmentBlockers({
        appEnvironment: "staging",
        supabaseUrl: "https://staging.example.supabase.co",
        marketplaceDeploymentEnabled: true,
        paymentsMode: "test",
        stripeMode: "test",
        stripeSecretKey: "sk_test_safe",
        stripeWebhookSecret: "whsec_safe",
        serviceRoleKey: "staging-only",
      }),
    ).toEqual([]);
  });

  it("blocks production and incomplete Stripe configuration", () => {
    expect(
      getActivationEnvironmentBlockers({
        appEnvironment: "production",
        supabaseUrl: "https://production.example.supabase.co",
        marketplaceDeploymentEnabled: true,
        paymentsMode: "test",
        stripeMode: "test",
        stripeSecretKey: "sk_live_forbidden",
      }),
    ).toEqual([
      "NOT_STAGING",
      "STRIPE_KEY_NOT_TEST",
      "STRIPE_WEBHOOK_MISSING",
      "SERVICE_ROLE_MISSING",
    ]);
  });

  it("allows only loopback databases for local activation tests", () => {
    expect(
      getActivationEnvironmentBlockers({
        appEnvironment: "development",
        supabaseUrl: "http://127.0.0.1:54321",
        marketplaceDeploymentEnabled: true,
        paymentsMode: "test",
        stripeMode: "test",
        stripeSecretKey: "sk_test_safe",
        stripeWebhookSecret: "whsec_safe",
        serviceRoleKey: "local-only",
      }),
    ).toEqual([]);
    expect(
      getActivationEnvironmentBlockers({
        appEnvironment: "development",
        supabaseUrl: "https://unexpected.example.com",
        marketplaceDeploymentEnabled: true,
        paymentsMode: "test",
        stripeMode: "test",
        stripeSecretKey: "sk_test_safe",
        stripeWebhookSecret: "whsec_safe",
        serviceRoleKey: "local-only",
      }),
    ).toContain("NOT_STAGING");
  });
});
